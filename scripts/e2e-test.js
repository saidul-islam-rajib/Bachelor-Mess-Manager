require('dotenv').config();

const crypto = require('crypto');
const { promisify } = require('util');
const { PrismaClient } = require('@prisma/client');
const { report, reportError, reportFailure } = require('./reporter');
const { emitSummary } = require('./test-result');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const prisma = new PrismaClient();

const scrypt = promisify(crypto.scrypt);

const SCRYPT_COST = Number(process.env.PASSWORD_SCRYPT_COST) || 16384;
const SCRYPT_BLOCK_SIZE = Number(process.env.PASSWORD_SCRYPT_BLOCK_SIZE) || 8;
const SCRYPT_PARALLELISM = Number(process.env.PASSWORD_SCRYPT_PARALLELISM) || 1;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password.normalize('NFKC'), salt, 64, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELISM,
    maxmem: 256 * SCRYPT_COST * SCRYPT_BLOCK_SIZE
  });
  return ['scrypt', SCRYPT_COST, SCRYPT_BLOCK_SIZE, SCRYPT_PARALLELISM, salt.toString('base64'), derived.toString('base64')].join('$');
}

const results = [];
let currentSection = '';

function section(name) {
  currentSection = name;
  report('');
  report(`--- ${name} ---`);
}

function check(name, passed, detail) {
  results.push({ section: currentSection, name, passed, detail });
  report(`  ${passed ? 'PASS' : 'FAIL'}  ${name}${passed || !detail ? '' : `  (${detail})`}`);
}

function near(a, b, tolerance = 0.011) {
  return Math.abs(a - b) <= tolerance;
}

const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'Asia/Dhaka';
const zonedDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});
function todayKey() {
  const parts = zonedDayFormatter.formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}
function shiftDayKey(dayKey, days) {
  return new Date(new Date(`${dayKey}T00:00:00.000Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

class Session {
  constructor(label) {
    this.label = label;
    this.cookies = new Map();
  }

  header() {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }

  absorb(res) {
    const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    for (const cookie of raw) {
      const [pair] = cookie.split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value === '' || /expires=Thu, 01 Jan 1970/i.test(cookie)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  async request(method, path, body) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.cookies.size ? { Cookie: this.header() } : {})
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'manual'
    });
    this.absorb(res);

    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { status: res.status, body: json, text };
  }

  get(path) {
    return this.request('GET', path);
  }
  post(path, body) {
    return this.request('POST', path, body);
  }
  patch(path, body) {
    return this.request('PATCH', path, body);
  }
  put(path, body) {
    return this.request('PUT', path, body);
  }
  del(path) {
    return this.request('DELETE', path);
  }
}

const tag = crypto.randomBytes(4).toString('hex');
const created = { userIds: [], groupIds: [] };

function email(name) {
  return `e2e-${tag}-${name}@example.com`;
}

async function approveUser(userEmail) {
  await prisma.user.update({
    where: { email: userEmail },
    data: { status: 'APPROVED' }
  });
}

async function makeSupervisor(userEmail) {
  await prisma.user.update({ where: { email: userEmail }, data: { role: 'SUPERVISOR' } });
}

async function registerAndLogin(label, name, password) {
  const session = new Session(label);
  const userEmail = email(label);

  const reg = await session.post('/api/auth/register', { name, email: userEmail, password, confirmPassword: password });
  if (reg.status !== 200 && reg.status !== 201) {
    throw new Error(`register ${label} failed: ${reg.status} ${reg.text.slice(0, 200)}`);
  }

  const user = await prisma.user.findUnique({ where: { email: userEmail } });
  if (!user) throw new Error(`user ${userEmail} not created`);
  created.userIds.push(user.id);

  await prisma.user.update({
    where: { email: userEmail },
    data: { password: await hashPassword(password), status: 'APPROVED' }
  });

  return { session, userEmail, userId: user.id };
}

async function login(session, userEmail, password) {
  const res = await session.post('/api/auth/login', { email: userEmail, password });
  return res;
}

async function run() {
  const password = 'E2ePassw0rd!x9';

  section('Health and public routes');
  {
    const anon = new Session('anon');
    const health = await anon.get('/api/health');
    check('GET /api/health returns 200', health.status === 200, `got ${health.status}`);

    const guide = await fetch(`${BASE}/guide`);
    const guideHtml = await guide.text();
    check('GET /guide is public (200)', guide.status === 200, `got ${guide.status}`);
    check('guide renders real content', guideHtml.includes('How') && guideHtml.length > 20000, `${guideHtml.length} bytes`);
    check(
      'guide has no error-component failure',
      !guideHtml.includes('missing required error components')
    );

    const protectedApi = await anon.get('/api/groups');
    check('unauthenticated API is rejected (401)', protectedApi.status === 401, `got ${protectedApi.status}`);
  }

  section('PWA assets');
  {
    const manifestRes = await fetch(`${BASE}/manifest.json`);
    check('manifest.json is public (200)', manifestRes.status === 200, `got ${manifestRes.status}`);

    let manifest = null;
    try {
      manifest = await manifestRes.json();
    } catch {
      manifest = null;
    }

    check('manifest is valid JSON', manifest !== null);
    check('manifest has a name', Boolean(manifest && manifest.name), String(manifest && manifest.name));
    check('manifest is standalone', manifest?.display === 'standalone', String(manifest?.display));
    check('manifest has a start_url', Boolean(manifest?.start_url), String(manifest?.start_url));
    check('manifest has a theme colour', Boolean(manifest?.theme_color), String(manifest?.theme_color));

    const icons = manifest?.icons ?? [];
    check('manifest declares a 192px icon', icons.some((i) => i.sizes === '192x192'), JSON.stringify(icons.map((i) => i.sizes)));
    check('manifest declares a 512px icon', icons.some((i) => i.sizes === '512x512'));
    check('manifest declares a maskable icon', icons.some((i) => String(i.purpose).includes('maskable')));

    for (const icon of icons) {
      const iconRes = await fetch(`${BASE}${icon.src}`);
      check(`icon ${icon.src} is served`, iconRes.status === 200, `got ${iconRes.status}`);
      check(
        `icon ${icon.src} is a PNG`,
        (iconRes.headers.get('content-type') || '').includes('image/png'),
        iconRes.headers.get('content-type') || 'no content-type'
      );
    }

    const swRes = await fetch(`${BASE}/sw.js`);
    const swBody = await swRes.text();
    check('service worker is served (200)', swRes.status === 200, `got ${swRes.status}`);
    check(
      'service worker is javascript',
      (swRes.headers.get('content-type') || '').includes('javascript'),
      swRes.headers.get('content-type') || 'none'
    );
    check('service worker is not cached', (swRes.headers.get('cache-control') || '').includes('no-cache'), swRes.headers.get('cache-control') || 'none');
    check('service worker never caches API responses', swBody.includes("url.pathname.startsWith('/api/')"));
    check('service worker handles push events', swBody.includes("addEventListener('push'"));

    const offlineRes = await fetch(`${BASE}/offline.html`);
    check('offline fallback page is served', offlineRes.status === 200, `got ${offlineRes.status}`);

    const appleIcon = await fetch(`${BASE}/icons/apple-touch-icon.png`);
    check('apple touch icon is served (iOS)', appleIcon.status === 200, `got ${appleIcon.status}`);

    const home = await fetch(`${BASE}/`);
    const html = await home.text();
    check('pages link the manifest', html.includes('rel="manifest"'));
    check('pages set apple-mobile-web-app-capable (iOS)', html.includes('apple-mobile-web-app-capable'));
    check('pages set a theme colour', html.includes('name="theme-color"'));
    check('pages link the apple touch icon', html.includes('apple-touch-icon'));
  }

  section('Registration, approval and login');
  const supervisor = await registerAndLogin('sup', 'E2E Supervisor', password);
  await makeSupervisor(supervisor.userEmail);
  const memberA = await registerAndLogin('mema', 'E2E Member A', password);
  const memberB = await registerAndLogin('memb', 'E2E Member B', password);

  {
    const loginRes = await login(supervisor.session, supervisor.userEmail, password);
    check('supervisor can log in', loginRes.status === 200, `got ${loginRes.status} ${loginRes.text.slice(0, 120)}`);

    const me = await supervisor.session.get('/api/auth/me');
    check('session resolves to the right user', me.body?.user?.email === supervisor.userEmail, JSON.stringify(me.body?.user?.email));

    const bad = await new Session('bad').post('/api/auth/login', { email: supervisor.userEmail, password: 'wrong-password' });
    check('wrong password is rejected', bad.status >= 400, `got ${bad.status}`);

    await login(memberA.session, memberA.userEmail, password);
    await login(memberB.session, memberB.userEmail, password);
    const meA = await memberA.session.get('/api/auth/me');
    check('member A logged in', meA.body?.user?.email === memberA.userEmail);
  }

  section('Group creation and membership');
  let groupId;
  {
    const res = await supervisor.session.post('/api/groups', { name: `E2E Mess ${tag}` });
    check('supervisor creates a group', res.status === 200 || res.status === 201, `got ${res.status} ${res.text.slice(0, 200)}`);
    groupId = res.body?.group?.id;
    if (!groupId) throw new Error('no group id returned');
    created.groupIds.push(groupId);

    const memberDenied = await memberA.session.post('/api/groups', { name: 'should fail' });
    check('plain member cannot create a group (403)', memberDenied.status === 403, `got ${memberDenied.status}`);

    for (const m of [memberA, memberB]) {
      const invite = await supervisor.session.post(`/api/groups/${groupId}/invitations`, { email: m.userEmail });
      check(`invited ${m.userEmail.split('@')[0]}`, invite.status === 200 || invite.status === 201, `got ${invite.status} ${invite.text.slice(0, 160)}`);

      const list = await m.session.get('/api/invitations');
      const invitation = (list.body?.invitations ?? [])[0];
      check('invitation appears for invitee', Boolean(invitation), JSON.stringify(list.body).slice(0, 160));

      if (invitation) {
        const accept = await m.session.patch(`/api/invitations/${invitation.id}`, { status: 'ACCEPTED' });
        check('invitee accepts invitation', accept.status === 200, `got ${accept.status} ${accept.text.slice(0, 160)}`);
      }
    }

    const members = await supervisor.session.get(`/api/groups/${groupId}/members`);
    const count = (members.body?.members ?? []).length;
    check('group has 3 active members', count === 3, `got ${count}`);
  }

  section('Group settings: meal rate mode and carry-forward');
  {
    const daily = await supervisor.session.patch(`/api/groups/${groupId}`, { mealRateMode: 'DAILY' });
    check('supervisor sets DAILY rate mode', daily.status === 200, `got ${daily.status}`);
    check('rate mode persisted', daily.body?.group?.mealRateMode === 'DAILY', String(daily.body?.group?.mealRateMode));

    const bad = await supervisor.session.patch(`/api/groups/${groupId}`, { mealRateMode: 'HOURLY' });
    check('invalid rate mode rejected (400)', bad.status === 400, `got ${bad.status}`);

    const monthly = await supervisor.session.patch(`/api/groups/${groupId}`, { mealRateMode: 'MONTHLY' });
    check('supervisor sets MONTHLY rate mode', monthly.body?.group?.mealRateMode === 'MONTHLY');

    const outsider = await memberA.session.patch(`/api/groups/${groupId}`, { name: 'hacked' });
    check('member cannot change group settings (403)', outsider.status === 403, `got ${outsider.status}`);
  }

  const month = todayKey().slice(0, 7);
  const daysAgo = (n) => shiftDayKey(todayKey(), -n);
  const pastDay = daysAgo(1);
  const pastDay2 = daysAgo(2);
  const pastDay3 = daysAgo(3);
  const pastMonth = pastDay.slice(0, 7);
  report(`  (server today is ${todayKey()} in ${APP_TIME_ZONE}; using ${pastDay} as a past day)`);

  section('Meals');
  {
    const today = todayKey();
    const mine = await memberA.session.put(`/api/groups/${groupId}/meals`, {
      date: today,
      breakfast: 1,
      lunch: 1,
      dinner: 1
    });
    check('member logs today meals', mine.status === 200, `got ${mine.status} ${mine.text.slice(0, 160)}`);
    check('meal applied immediately', mine.body?.applied === true, JSON.stringify(mine.body).slice(0, 120));

    const other = await memberA.session.put(`/api/groups/${groupId}/meals`, {
      date: today,
      userId: memberB.userId,
      breakfast: 5,
      lunch: 5,
      dinner: 5
    });
    const applied = other.body?.entry;
    check(
      "member cannot log another member's meals",
      other.status === 403 || applied?.userId === memberA.userId,
      `status ${other.status}, wrote for ${applied?.userId}`
    );

    const clamp = await memberA.session.put(`/api/groups/${groupId}/meals`, {
      date: today,
      breakfast: 99,
      lunch: -5,
      dinner: 2
    });
    check(
      'meal counts are clamped to sane values',
      clamp.body?.entry?.breakfast === 9 && clamp.body?.entry?.lunch === 0,
      JSON.stringify(clamp.body?.entry)
    );

    await memberA.session.put(`/api/groups/${groupId}/meals`, { date: today, breakfast: 1, lunch: 1, dinner: 1 });

    const pastEdit = await memberA.session.put(`/api/groups/${groupId}/meals`, {
      date: pastDay,
      breakfast: 1,
      lunch: 1,
      dinner: 1
    });
    check('past day locked without unlock (403)', pastEdit.status === 403, `got ${pastEdit.status}`);
  }

  section('Past-meal edit window and approval');
  {
    const open = await memberA.session.post(`/api/groups/${groupId}/meal-edit-window`);
    check('member opens edit window', open.status === 200, `got ${open.status}`);
    check('window reports open', open.body?.window?.open === true, JSON.stringify(open.body?.window));

    const request = await memberA.session.put(`/api/groups/${groupId}/meals`, {
      date: pastDay2,
      breakfast: 1,
      lunch: 1,
      dinner: 0,
      reason: 'forgot to log'
    });
    check('past edit becomes a pending request', request.body?.pending === true, JSON.stringify(request.body).slice(0, 160));
    check('past edit is NOT applied yet', request.body?.applied !== true);

    const feed = await supervisor.session.get(`/api/groups/${groupId}/meals?month=${pastMonth}`);
    const pending = (feed.body?.pendingChanges ?? []).filter((c) => c.userId === memberA.userId);
    check('supervisor sees the pending request', pending.length === 1, `got ${pending.length}`);

    const entriesBefore = (feed.body?.entries ?? []).filter((e) => e.userId === memberA.userId && e.date === pastDay2);
    check('meal table unchanged before approval', entriesBefore.length === 0, JSON.stringify(entriesBefore));

    const requestId = pending[0]?.id;
    if (requestId) {
      const memberTriesApprove = await memberA.session.patch(`/api/meal-changes/${requestId}`, { status: 'APPROVED' });
      check('member cannot approve their own request (403)', memberTriesApprove.status === 403, `got ${memberTriesApprove.status}`);

      const approve = await supervisor.session.patch(`/api/meal-changes/${requestId}`, { status: 'APPROVED' });
      check('supervisor approves the request', approve.status === 200, `got ${approve.status} ${approve.text.slice(0, 160)}`);

      const after = await supervisor.session.get(`/api/groups/${groupId}/meals?month=${pastDay2.slice(0, 7)}`);
      const entry = (after.body?.entries ?? []).find((e) => e.userId === memberA.userId && e.date === pastDay2);
      check('approval applies the change to the meal table', entry?.breakfast === 1 && entry?.lunch === 1, JSON.stringify(entry));

      const again = await supervisor.session.patch(`/api/meal-changes/${requestId}`, { status: 'APPROVED' });
      check('a decided request cannot be decided twice (409)', again.status === 409, `got ${again.status}`);
    }

    const notif = await memberB.session.get('/api/notifications');
    const titles = (notif.body?.notifications ?? []).map((n) => n.title).filter(Boolean);
    check(
      'other members are notified of the meal change',
      titles.some((t) => t && t.includes('meals')),
      JSON.stringify(titles).slice(0, 200)
    );

    const close = await memberA.session.del(`/api/groups/${groupId}/meal-edit-window`);
    check('member closes edit window', close.body?.window?.open === false, JSON.stringify(close.body?.window));

    const afterClose = await memberA.session.put(`/api/groups/${groupId}/meals`, {
      date: pastDay3,
      breakfast: 1,
      lunch: 0,
      dinner: 0
    });
    check('past edits locked again after closing', afterClose.status === 403, `got ${afterClose.status}`);
  }

  section('Expense categories');
  {
    const list = await supervisor.session.get(`/api/groups/${groupId}/categories`);
    check('categories seeded for new group', (list.body?.categories ?? []).length >= 7, `got ${(list.body?.categories ?? []).length}`);

    const add = await supervisor.session.post(`/api/groups/${groupId}/categories`, { label: 'Gas cylinder' });
    check('supervisor adds a cost type', add.status === 200 || add.status === 201, `got ${add.status} ${add.text.slice(0, 160)}`);
    check('code derived from label', add.body?.category?.code === 'GAS_CYLINDER', String(add.body?.category?.code));

    const dupe = await supervisor.session.post(`/api/groups/${groupId}/categories`, { label: 'Gas cylinder' });
    check('duplicate cost type rejected (409)', dupe.status === 409, `got ${dupe.status}`);

    const bazar = await supervisor.session.post(`/api/groups/${groupId}/categories`, { label: 'Bazar' });
    check('BAZAR reserved code rejected (400)', bazar.status === 400, `got ${bazar.status}`);

    const memberAdd = await memberA.session.post(`/api/groups/${groupId}/categories`, { label: 'Sneaky' });
    check('member cannot add cost types (403)', memberAdd.status === 403, `got ${memberAdd.status}`);

    const xss = await supervisor.session.post(`/api/groups/${groupId}/categories`, { label: '<script>alert(1)</script>' });
    check('XSS in category label rejected', xss.status === 400, `got ${xss.status}`);

    const categoryId = add.body?.category?.id;
    if (categoryId) {
      const rename = await supervisor.session.patch(`/api/expense-categories/${categoryId}`, { label: 'Gas bottle' });
      check('supervisor renames a cost type', rename.body?.category?.label === 'Gas bottle', String(rename.body?.category?.label));

      const remove = await supervisor.session.del(`/api/expense-categories/${categoryId}`);
      check('unused cost type is deleted outright', remove.body?.deleted === true, JSON.stringify(remove.body));
    }
  }

  section('Bazar and bills');
  {
    const today = todayKey();

    const bazar = await supervisor.session.post(`/api/groups/${groupId}/expenses`, {
      date: today,
      items: [{ name: 'Rice', amount: 600 }, { name: 'Chicken', amount: 400 }],
      note: 'e2e bazar'
    });
    check('bazar recorded', bazar.status === 200 || bazar.status === 201, `got ${bazar.status} ${bazar.text.slice(0, 200)}`);

    const bill = await supervisor.session.post(`/api/groups/${groupId}/bills`, {
      type: 'RENT',
      amount: 3000,
      date: today,
      splitMethod: 'EQUAL'
    });
    check('bill recorded and split equally', bill.status === 200 || bill.status === 201, `got ${bill.status} ${bill.text.slice(0, 200)}`);

    const shares = bill.body?.bill?.shares ?? [];
    const total = shares.reduce((a, s) => a + s.amount, 0);
    check('equal split sums exactly to the bill', near(total, 3000), `sum ${total}`);
    check('equal split covers all 3 members', shares.length === 3, `got ${shares.length}`);

    const badType = await supervisor.session.post(`/api/groups/${groupId}/bills`, {
      type: 'NOT_A_TYPE',
      amount: 100,
      date: today,
      splitMethod: 'EQUAL'
    });
    check('unknown cost type rejected (400)', badType.status === 400, `got ${badType.status}`);

    const memberBill = await memberA.session.post(`/api/groups/${groupId}/bills`, {
      type: 'RENT',
      amount: 50,
      date: today,
      splitMethod: 'EQUAL'
    });
    check('member cannot record bills (403)', memberBill.status === 403, `got ${memberBill.status}`);

    const custom = await supervisor.session.post(`/api/groups/${groupId}/bills`, {
      type: 'WIFI',
      amount: 900,
      date: today,
      splitMethod: 'CUSTOM',
      shares: [
        { userId: memberA.userId, amount: 500 },
        { userId: memberB.userId, amount: 300 }
      ]
    });
    check('custom split that does not add up is rejected', custom.status === 400, `got ${custom.status}`);

    const customOk = await supervisor.session.post(`/api/groups/${groupId}/bills`, {
      type: 'WIFI',
      amount: 900,
      date: today,
      splitMethod: 'CUSTOM',
      shares: [
        { userId: memberA.userId, amount: 600 },
        { userId: memberB.userId, amount: 300 }
      ]
    });
    check('valid custom split accepted', customOk.status === 200 || customOk.status === 201, `got ${customOk.status} ${customOk.text.slice(0, 160)}`);
  }

  section('Settlement maths');
  let payments;
  {
    const res = await supervisor.session.get(`/api/groups/${groupId}/payments?month=${month}`);
    payments = res.body;
    check('payments report loads', res.status === 200, `got ${res.status}`);

    const members = payments?.members ?? [];
    check('report includes all 3 members', members.length === 3, `got ${members.length}`);

    const mealShareSum = members.reduce((a, m) => a + m.mealCost, 0);
    check(
      'meal shares sum exactly to bazar spend',
      near(mealShareSum, payments.totals.bazar),
      `shares ${mealShareSum.toFixed(2)} vs bazar ${payments.totals.bazar}`
    );

    const billShareSum = members.reduce((a, m) => a + m.billShare, 0);
    check(
      'bill shares sum exactly to bills total',
      near(billShareSum, payments.totals.bills),
      `shares ${billShareSum.toFixed(2)} vs bills ${payments.totals.bills}`
    );

    for (const m of members) {
      const expected = m.carryIn + m.mealCost + m.billShare - m.bazarPaid - m.collected;
      check(`due formula holds for ${m.name}`, near(m.due, expected), `due ${m.due} vs computed ${expected.toFixed(2)}`);
    }

    const supervisorRow = members.find((m) => m.id === supervisor.userId);
    check(
      'grocery buyer is credited what they paid',
      supervisorRow && near(supervisorRow.bazarPaid, 1000),
      `bazarPaid ${supervisorRow?.bazarPaid}`
    );

    check('no bazar left unallocated', near(payments.totals.unallocatedBazar ?? 0, 0), String(payments.totals.unallocatedBazar));

    check('category labels returned for the breakdown', Boolean(payments.categoryLabels), 'missing categoryLabels');

    for (const m of members) {
      const typeSum = Object.values(m.billShareByType ?? {}).reduce((x, y) => x + y, 0);
      check(`${m.name} per-type shares match their bill share`, near(typeSum, m.billShare), `${typeSum} vs ${m.billShare}`);
    }

    const perTypeTotal = members.reduce(
      (acc, m) => acc + Object.values(m.billShareByType ?? {}).reduce((x, y) => x + y, 0),
      0
    );
    check('per-type shares sum to the bills total', near(perTypeTotal, payments.totals.bills), `${perTypeTotal} vs ${payments.totals.bills}`);

    const dayCostSum = (payments.days ?? []).reduce((acc, d) => acc + (d.cost ?? 0), 0);
    check('day charges add back to total bazar', near(dayCostSum, payments.totals.bazar, 0.05), `${dayCostSum} vs ${payments.totals.bazar}`);
    check(
      'no day with meals is priced at zero',
      (payments.days ?? []).every((d) => d.meals === 0 || d.rate > 0),
      JSON.stringify((payments.days ?? []).filter((d) => d.meals > 0 && d.rate <= 0))
    );
  }

  section('Payments');
  {
    const today = todayKey();
    const before = (payments?.members ?? []).find((m) => m.id === memberA.userId);

    const pay = await supervisor.session.post(`/api/groups/${groupId}/payments`, {
      userId: memberA.userId,
      amount: 500,
      date: today
    });
    check('supervisor records a payment', pay.status === 200 || pay.status === 201, `got ${pay.status} ${pay.text.slice(0, 160)}`);

    const memberPay = await memberA.session.post(`/api/groups/${groupId}/payments`, {
      userId: memberA.userId,
      amount: 10,
      date: today
    });
    check('member cannot record payments (403)', memberPay.status === 403, `got ${memberPay.status}`);

    const negative = await supervisor.session.post(`/api/groups/${groupId}/payments`, {
      userId: memberA.userId,
      amount: -100,
      date: today
    });
    check('negative payment rejected (400)', negative.status === 400, `got ${negative.status}`);

    const after = await supervisor.session.get(`/api/groups/${groupId}/payments?month=${month}`);
    const row = (after.body?.members ?? []).find((m) => m.id === memberA.userId);
    check('cash paid recorded on the member row', near(row?.collected ?? 0, 500), `collected ${row?.collected}`);
    check(
      'due drops by exactly the amount paid',
      before && near(row.due, before.due - 500),
      `before ${before?.due} after ${row?.due}`
    );
  }

  section('Month closing and carry-forward');
  {
    const lastDay = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);

    const memberClose = await memberA.session.post(`/api/groups/${groupId}/closings`, { month, through: lastDay });
    check('member cannot close the month (403)', memberClose.status === 403, `got ${memberClose.status}`);

    const badDate = await supervisor.session.post(`/api/groups/${groupId}/closings`, { month, through: '2001-01-05' });
    check('closing date outside the month rejected (409)', badDate.status === 409, `got ${badDate.status}`);

    const close = await supervisor.session.post(`/api/groups/${groupId}/closings`, { month, through: lastDay });
    check('supervisor closes the month', close.status === 200 || close.status === 201, `got ${close.status} ${close.text.slice(0, 200)}`);
    check('closing covers all 3 members', close.body?.members === 3, `got ${close.body?.members}`);

    const again = await supervisor.session.post(`/api/groups/${groupId}/closings`, { month, through: lastDay });
    check('closing twice is refused (409)', again.status === 409, `got ${again.status}`);

    const reportAfter = await supervisor.session.get(`/api/groups/${groupId}/payments?month=${month}`);
    check('report shows the month as closed', Boolean(reportAfter.body?.closing), JSON.stringify(reportAfter.body?.closing));

    const nextMonthDate = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 1));
    const nextMonth = nextMonthDate.toISOString().slice(0, 7);
    const nextReport = await supervisor.session.get(`/api/groups/${groupId}/payments?month=${nextMonth}`);
    const carried = (nextReport.body?.members ?? []).reduce((a, m) => a + Math.abs(m.carryIn), 0);
    check('unpaid balances carry into next month', carried > 0, `carried ${carried}`);

    const closings = await supervisor.session.get(`/api/groups/${groupId}/closings?month=${month}`);
    const closingId = (closings.body?.closings ?? [])[0]?.id;
    if (closingId) {
      const reopen = await supervisor.session.del(`/api/closings/${closingId}`);
      check('supervisor can reopen a month', reopen.status === 200, `got ${reopen.status}`);

      const afterReopen = await supervisor.session.get(`/api/groups/${groupId}/payments?month=${nextMonth}`);
      const carriedAfter = (afterReopen.body?.members ?? []).reduce((a, m) => a + Math.abs(m.carryIn), 0);
      check('reopening stops the carry-forward', near(carriedAfter, 0), `carried ${carriedAfter}`);
    }
  }

  section('Closed group behaviour');
  {
    const deactivate = await supervisor.session.patch(`/api/groups/${groupId}`, { status: 'INACTIVE' });
    check('supervisor closes the group', deactivate.status === 200, `got ${deactivate.status}`);

    const today = todayKey();
    const write = await supervisor.session.post(`/api/groups/${groupId}/expenses`, {
      date: today,
      items: [{ name: 'Late', amount: 10 }]
    });
    check('writes blocked in a closed group (403)', write.status === 403, `got ${write.status}`);

    const mealWrite = await memberA.session.put(`/api/groups/${groupId}/meals`, {
      date: today,
      breakfast: 1,
      lunch: 0,
      dinner: 0
    });
    check('meal writes blocked in a closed group (403)', mealWrite.status === 403, `got ${mealWrite.status}`);

    const stillReadable = await supervisor.session.get(`/api/groups/${groupId}/payments?month=${month}`);
    check('closed group history stays readable', stillReadable.status === 200, `got ${stillReadable.status}`);

    const defaultList = await supervisor.session.get('/api/groups');
    const visible = (defaultList.body?.groups ?? []).some((g) => g.id === groupId);
    check('closed group hidden from default list', !visible, 'still visible');
    check('hiddenInactive count reported', (defaultList.body?.hiddenInactive ?? 0) >= 1, String(defaultList.body?.hiddenInactive));

    const withInactive = await supervisor.session.get('/api/groups?includeInactive=true');
    const nowVisible = (withInactive.body?.groups ?? []).some((g) => g.id === groupId);
    check('closed group visible with includeInactive=true', nowVisible);

    await supervisor.session.patch(`/api/groups/${groupId}`, { status: 'ACTIVE' });
  }

  section('Access control across groups');
  {
    const outsider = await registerAndLogin('out', 'E2E Outsider', password);
    await login(outsider.session, outsider.userEmail, password);

    const peek = await outsider.session.get(`/api/groups/${groupId}/payments?month=${month}`);
    check('non-member cannot read another group (403)', peek.status === 403, `got ${peek.status}`);

    const meals = await outsider.session.get(`/api/groups/${groupId}/meals?month=${month}`);
    check('non-member cannot read meals (403)', meals.status === 403, `got ${meals.status}`);

    const write = await outsider.session.put(`/api/groups/${groupId}/meals`, {
      date: todayKey(),
      breakfast: 1
    });
    check('non-member cannot write meals (403)', write.status === 403, `got ${write.status}`);
  }

  section('Notifications');
  {
    const feed = await memberB.session.get('/api/notifications');
    check('notification feed loads', feed.status === 200, `got ${feed.status}`);
    check('feed reports an unread count', typeof feed.body?.unreadCount === 'number', JSON.stringify(feed.body?.unreadCount));

    const items = feed.body?.notifications ?? [];
    check('member received notifications', items.length > 0, `got ${items.length}`);
    check('notifications carry a link', items.every((n) => typeof n.link === 'string' && n.link.length > 0));

    if (items.length > 0) {
      const markAll = await memberB.session.patch('/api/notifications', {});
      check('mark-all-read works', markAll.status === 200, `got ${markAll.status}`);
      check('unread count drops to zero', markAll.body?.unreadCount === 0, String(markAll.body?.unreadCount));
    }
  }

  section('Dashboard');
  {
    const sup = await supervisor.session.get(`/api/reports/dashboard?month=${month}`);
    check('supervisor dashboard loads', sup.status === 200, `got ${sup.status}`);
    check('supervisor role reported', sup.body?.role === 'SUPERVISOR', String(sup.body?.role));

    const mem = await memberA.session.get(`/api/reports/dashboard?month=${month}`);
    check('member dashboard loads', mem.status === 200, `got ${mem.status}`);
    check('member sees their own figures', mem.body?.member?.current !== undefined);
  }
}

function summarise() {
  const failed = results.filter((r) => !r.passed);

  if (failed.length > 0) {
    report('');
    report('Failures:');
    for (const f of failed) report(`  [${f.section}] ${f.name}${f.detail ? `  -> ${f.detail}` : ''}`);
    process.exitCode = 1;
  }

  emitSummary('e2e', {
    total: results.length,
    passed: results.length - failed.length,
    failed: failed.length
  });
}

async function cleanup() {
  try {
    for (const groupId of created.groupIds) {
      await prisma.closingLine.deleteMany({ where: { closing: { groupId } } });
      await prisma.monthClosing.deleteMany({ where: { groupId } });
      await prisma.mealChangeRequest.deleteMany({ where: { groupId } });
      await prisma.mealEditWindow.deleteMany({ where: { groupId } });
      await prisma.notification.deleteMany({ where: { groupId } });
      await prisma.expenseCategory.deleteMany({ where: { groupId } });
      await prisma.expenseShare.deleteMany({ where: { expense: { groupId } } });
      await prisma.expenseItem.deleteMany({ where: { expense: { groupId } } });
      await prisma.expenseComment.deleteMany({ where: { expense: { groupId } } });
      await prisma.expenseHistory.deleteMany({ where: { groupId } });
      await prisma.expenseEntry.deleteMany({ where: { groupId } });
      await prisma.paymentStatus.deleteMany({ where: { groupId } });
      await prisma.mealEntry.deleteMany({ where: { groupId } });
      await prisma.mealPlanDay.deleteMany({ where: { plan: { groupId } } });
      await prisma.mealPlan.deleteMany({ where: { groupId } });
      await prisma.commentReply.deleteMany({ where: { comment: { groupId } } });
      await prisma.comment.deleteMany({ where: { groupId } });
      await prisma.invitation.deleteMany({ where: { groupId } });
      await prisma.groupOrder.deleteMany({ where: { groupId } });
      await prisma.membership.deleteMany({ where: { groupId } });
      await prisma.group.deleteMany({ where: { id: groupId } });
    }

    for (const userId of created.userIds) {
      await prisma.notification.deleteMany({ where: { OR: [{ userId }, { actorId: userId }] } });
      await prisma.passwordToken.deleteMany({ where: { userId } });
      await prisma.roleRequest.deleteMany({ where: { OR: [{ userId }, { decidedById: userId }] } });
      await prisma.user.deleteMany({ where: { id: userId } });
    }
    await prisma.loginAttempt.deleteMany({ where: { email: { contains: `e2e-${tag}` } } });
    report('');
    report('Cleaned up test data.');
  } catch (error) {
    reportError(`Cleanup incomplete: ${error.message}`);
  }
}

run()
  .catch((error) => {
    reportError('');
    reportError('Test run aborted.');
    reportFailure(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    summarise();
    await cleanup();
    await prisma.$disconnect();
  });
