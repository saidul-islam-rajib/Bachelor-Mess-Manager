require('dotenv').config();

const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { report, reportError, reportFailure } = require('./reporter');
const { emitSummary } = require('./test-result');

const prisma = new PrismaClient();
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';

const tag = crypto.randomBytes(4).toString('hex');
const created = { emails: [] };

let total = 0;
let failures = 0;
let skippedReason = null;

function check(name, passed, detail) {
  total += 1;
  if (!passed) failures += 1;
  report(`  ${passed ? 'PASS' : 'FAIL'}  ${name}${passed || !detail ? '' : `  (${detail})`}`);
}

function session() {
  const jar = new Map();
  return {
    cookies: jar,
    async request(method, path, body) {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {})
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });

      for (const cookie of res.headers.getSetCookie ? res.headers.getSetCookie() : []) {
        const [pair] = cookie.split(';');
        const i = pair.indexOf('=');
        const key = pair.slice(0, i).trim();
        const value = pair.slice(i + 1).trim();
        if (!value || /expires=Thu, 01 Jan 1970/i.test(cookie)) jar.delete(key);
        else jar.set(key, value);
      }

      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (res.status === 429 && path.includes('set-password')) {
        throw new Error(
          [
            'The set-password endpoint is rate limited (20 attempts per 15 minutes per IP, by design).',
            '  This suite uses about 10 of them, so two runs inside the window exhaust it.',
            '  The limiter is in memory - restart the app and run again:',
            '    SMTP_HOST= EMAIL_REQUIRE_MX=false npm run dev'
          ].join('\n')
        );
      }

      return { status: res.status, body: json, text };
    }
  };
}

async function clearOwnThrottleRows() {
  await prisma.loginAttempt.deleteMany({
    where: { reason: 'REGISTRATION', email: { contains: `signup-${tag}` } }
  });
}

function tokenFromLink(link) {
  if (!link) return null;
  try {
    return new URL(link, BASE).searchParams.get('token');
  } catch {
    return null;
  }
}

async function run() {
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => null);
  report(`Testing ${BASE}`);

  const probe = await session().request('POST', '/api/auth/register', {
    name: 'Mail Mode Probe',
    email: `signup-${tag}-probe@example.com`
  });
  created.emails.push(`signup-${tag}-probe@example.com`);

  if (!probe.body?.setupLink) {
    report('');
    report('SMTP is configured on this server, so the setup link is not returned in the API');
    report('response - that is correct behaviour, the link is a development convenience only.');
    report('');
    report('This suite cannot read a link out of a real inbox, and it must not send mail to');
    report('made-up addresses. To run it, start the app with mail disabled:');
    report('');
    report('  SMTP_HOST= EMAIL_REQUIRE_MX=false npm run dev');
    report('');
    report('Credentials themselves are checked separately by: npm run test:mail');
    skippedReason = 'app is running with SMTP configured';
    return;
  }

  const email = `signup-${tag}@example.com`;
  const password = 'MemberPass!2026';
  created.emails.push(email);

  report('--- 1. Registration ---');

  const s = session();
  const reg = await s.request('POST', '/api/auth/register', {
    name: 'Signup Flow Member',
    email,
    phone: '+8801711111111'
  });

  check('registration accepted', reg.status === 200 || reg.status === 201, `got ${reg.status} ${reg.text.slice(0, 160)}`);
  check('registration returns a message', Boolean(reg.body?.message), JSON.stringify(reg.body));

  const user = await prisma.user.findUnique({ where: { email } });
  check('user row created', Boolean(user), 'no user');
  check('user starts with no password set', user?.password === '', `password="${user?.password}"`);
  check('user starts UNVERIFIED', user?.status === 'UNVERIFIED', String(user?.status));
  check('user gets the MEMBER role', user?.role === 'MEMBER', String(user?.role));
  check('phone was stored', Boolean(user?.phone), String(user?.phone));

  report('');
  report('--- 2. The setup link / email ---');

  const setupLink = reg.body?.setupLink;
  check('setup link returned when SMTP is not configured', Boolean(setupLink), 'no setupLink in response');
  check(
    'setup link points at the set-password page',
    Boolean(setupLink) && setupLink.includes('/auth/set-password?token='),
    String(setupLink)
  );

  const token = tokenFromLink(setupLink);
  check('setup link carries a token', Boolean(token) && token.length >= 20, `token length ${token ? token.length : 0}`);

  const tokenRows = await prisma.passwordToken.findMany({ where: { userId: user.id } });
  check('exactly one token issued', tokenRows.length === 1, `got ${tokenRows.length}`);
  check('token is unused', tokenRows[0] && tokenRows[0].usedAt === null, String(tokenRows[0]?.usedAt));
  check('token purpose is SETUP', tokenRows[0]?.purpose === 'SETUP', String(tokenRows[0]?.purpose));
  check('token has a future expiry', tokenRows[0] && tokenRows[0].expiresAt > new Date(), String(tokenRows[0]?.expiresAt));
  check(
    'token is stored hashed, never in plain text',
    Boolean(token) && tokenRows[0] && tokenRows[0].tokenHash !== token && tokenRows[0].tokenHash.length === 64,
    tokenRows[0] ? `stored value: ${String(tokenRows[0].tokenHash).slice(0, 24)}...` : 'no token row'
  );

  const expectedHash = crypto.createHash('sha256').update(token || '').digest('hex');
  check('stored hash matches the emailed token', tokenRows[0]?.tokenHash === expectedHash);

  report('');
  report('--- 3. Opening the link ---');

  const bad = await s.request('GET', '/api/auth/set-password?token=not-a-real-token');
  check('a bogus token is rejected', bad.status >= 400 && bad.body?.valid === false, `got ${bad.status}`);

  const lookup = await s.request('GET', `/api/auth/set-password?token=${encodeURIComponent(token)}`);
  check('valid token is accepted', lookup.status === 200 && lookup.body?.valid === true, `got ${lookup.status} ${lookup.text.slice(0, 120)}`);
  check('link shows the right name', lookup.body?.name === 'Signup Flow Member', String(lookup.body?.name));
  check('link shows the right email', lookup.body?.email === email, String(lookup.body?.email));

  const page = await fetch(`${BASE}/auth/set-password?token=${encodeURIComponent(token)}`);
  check('set-password page loads without signing in', page.status === 200, `got ${page.status}`);

  report('');
  report('--- 4. Creating the password ---');

  const weak = await s.request('POST', '/api/auth/set-password', { token, password: 'abc' });
  check('a too-short password is rejected', weak.status === 400, `got ${weak.status}`);

  const stillUnused = await prisma.passwordToken.findFirst({ where: { userId: user.id } });
  check('a rejected attempt does not burn the token', stillUnused?.usedAt === null, String(stillUnused?.usedAt));

  const setRes = await s.request('POST', '/api/auth/set-password', { token, password });
  check('password is accepted', setRes.status === 200, `got ${setRes.status} ${setRes.text.slice(0, 160)}`);
  check('user is signed in straight away', setRes.body?.signedIn === true, JSON.stringify(setRes.body).slice(0, 160));
  check('a session cookie was issued', s.cookies.size > 0, `${s.cookies.size} cookies`);

  const afterSet = await prisma.user.findUnique({ where: { email } });
  check('password is now stored', Boolean(afterSet?.password) && afterSet.password.length > 20);
  check('password is hashed with scrypt', String(afterSet?.password).startsWith('scrypt$'), String(afterSet?.password).slice(0, 12));
  check('plain password is never stored', !String(afterSet?.password).includes(password));
  check('status became APPROVED', afterSet?.status === 'APPROVED', String(afterSet?.status));

  const usedToken = await prisma.passwordToken.findFirst({ where: { userId: user.id } });
  check('token is consumed after use', usedToken?.usedAt !== null, String(usedToken?.usedAt));

  const replay = await s.request('POST', '/api/auth/set-password', { token, password: 'AnotherPass!99' });
  check('the same link cannot be used twice', replay.status === 400, `got ${replay.status}`);
  check('replay says the link was already used', /already been used/i.test(replay.text), replay.text.slice(0, 120));

  report('');
  report('--- 5. The session it handed back ---');

  const me = await s.request('GET', '/api/auth/me');
  check('session resolves to the new member', me.body?.user?.email === email, JSON.stringify(me.body?.user?.email));

  const dash = await fetch(`${BASE}/dashboard`, {
    headers: { Cookie: [...s.cookies].map(([k, v]) => `${k}=${v}`).join('; ') },
    redirect: 'manual'
  });
  check('the new member can reach the dashboard', dash.status === 200, `got ${dash.status}`);

  await s.request('POST', '/api/auth/logout');
  const afterLogout = await s.request('GET', '/api/auth/me');
  check('logout clears the session', afterLogout.status === 401 || !afterLogout.body?.user, `got ${afterLogout.status}`);

  report('');
  report('--- 6. Logging back in ---');

  const fresh = session();
  const wrong = await fresh.request('POST', '/api/auth/login', { email, password: 'WrongPassword!1' });
  check('wrong password is refused', wrong.status === 401, `got ${wrong.status}`);

  const login = await fresh.request('POST', '/api/auth/login', { email, password });
  check('correct password logs in', login.status === 200, `got ${login.status} ${login.text.slice(0, 160)}`);
  check('login issues a session', fresh.cookies.size > 0, `${fresh.cookies.size} cookies`);

  const meAgain = await fresh.request('GET', '/api/auth/me');
  check('logged-in session is the right member', meAgain.body?.user?.email === email, String(meAgain.body?.user?.email));
  check('member has the MEMBER role', meAgain.body?.user?.role === 'MEMBER', String(meAgain.body?.user?.role));

  report('');
  report('--- 7. Edge cases ---');

  const dupe = await session().request('POST', '/api/auth/register', {
    name: 'Someone Else',
    email,
    phone: '+8801722222222'
  });
  check('registering an existing email still returns 2xx', dupe.status === 200 || dupe.status === 201, `got ${dupe.status}`);
  check('it does not leak that the account exists', !/already|exists|taken/i.test(dupe.text), dupe.text.slice(0, 140));
  check('it does not issue a new token for a completed account', !dupe.body?.setupLink, 'a setup link was handed out');

  const nameCheck = await prisma.user.findUnique({ where: { email } });
  check(
    'a completed account is not overwritten by re-registration',
    nameCheck?.name === 'Signup Flow Member',
    `name is now "${nameCheck?.name}"`
  );

  await clearOwnThrottleRows();

  const resendEmail = `signup-${tag}-resend@example.com`;
  created.emails.push(resendEmail);

  const first = await session().request('POST', '/api/auth/register', { name: 'Resend Member', email: resendEmail });
  const second = await session().request('POST', '/api/auth/register', { name: 'Resend Member', email: resendEmail });
  check('re-registering before setting a password resends a link', Boolean(second.body?.setupLink), 'no new link');

  const firstToken = tokenFromLink(first.body?.setupLink);
  const secondToken = tokenFromLink(second.body?.setupLink);
  check('the resent link is a different token', Boolean(firstToken && secondToken) && firstToken !== secondToken);

  const oldTokenTry = await session().request('GET', `/api/auth/set-password?token=${encodeURIComponent(firstToken)}`);
  check('the superseded link stops working', oldTokenTry.status >= 400, `got ${oldTokenTry.status}`);

  const newTokenTry = await session().request('GET', `/api/auth/set-password?token=${encodeURIComponent(secondToken)}`);
  check('the newest link works', newTokenTry.status === 200 && newTokenTry.body?.valid === true, `got ${newTokenTry.status}`);

  await clearOwnThrottleRows();

  const expiredEmail = `signup-${tag}-expired@example.com`;
  created.emails.push(expiredEmail);
  const expiredReg = await session().request('POST', '/api/auth/register', { name: 'Expired Member', email: expiredEmail });
  check('registration for the expiry case succeeded', expiredReg.status === 200 || expiredReg.status === 201, `got ${expiredReg.status} ${expiredReg.text.slice(0, 120)}`);

  const expiredToken = tokenFromLink(expiredReg.body?.setupLink);
  const expiredUser = await prisma.user.findUnique({ where: { email: expiredEmail } });
  check('expiry-case user exists', Boolean(expiredUser), 'user was not created');
  if (!expiredUser) return;

  await prisma.passwordToken.updateMany({
    where: { userId: expiredUser.id },
    data: { expiresAt: new Date(Date.now() - 60_000) }
  });

  const expiredTry = await session().request('GET', `/api/auth/set-password?token=${encodeURIComponent(expiredToken)}`);
  check('an expired link is refused', expiredTry.status >= 400, `got ${expiredTry.status}`);
  check('expiry message says so', /expired/i.test(expiredTry.text), expiredTry.text.slice(0, 120));

  const unverified = await session().request('POST', '/api/auth/login', {
    email: expiredEmail,
    password: 'AnythingAtAll!1'
  });
  check('an account with no password cannot log in', unverified.status >= 400, `got ${unverified.status}`);

  report('');
  report('--- 8. Signup abuse throttle ---');

  await clearOwnThrottleRows();

  let throttledAt = 0;
  for (let i = 1; i <= 8 && throttledAt === 0; i++) {
    const spamEmail = `signup-${tag}-spam${i}@example.com`;
    created.emails.push(spamEmail);
    const res = await session().request('POST', '/api/auth/register', { name: `Spam ${i}`, email: spamEmail });
    if (res.status === 429) throttledAt = i;
  }

  check('repeated signups from one IP get throttled', throttledAt > 0, 'never throttled after 8 attempts');
  check('throttle allows a reasonable number first', throttledAt === 0 || throttledAt > 1, `blocked at attempt ${throttledAt}`);

  await clearOwnThrottleRows();
}

async function cleanup() {
  for (const email of created.emails) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) continue;
    await prisma.passwordToken.deleteMany({ where: { userId: user.id } });
    await prisma.notification.deleteMany({ where: { OR: [{ userId: user.id }, { actorId: user.id }] } });
    await prisma.roleRequest.deleteMany({ where: { OR: [{ userId: user.id }, { decidedById: user.id }] } });
    await prisma.membership.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
  await prisma.loginAttempt.deleteMany({ where: { email: { contains: `signup-${tag}` } } });
}

run()
  .catch((error) => {
    failures += 1;
    total += 1;
    reportError('Signup flow aborted.');
    reportFailure(error);
  })
  .finally(async () => {
    emitSummary('signup-flow', {
      total,
      passed: total - failures,
      failed: failures,
      skipped: Boolean(skippedReason),
      reason: skippedReason
    });
    if (failures > 0) process.exitCode = 1;
    await cleanup();
    await prisma.$disconnect();
  });
