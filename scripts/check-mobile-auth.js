const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { report, reportError } = require('./reporter');

const results = [];
function check(name, passed, detail) {
  results.push({ name, passed });
  if (!passed) reportError(`  FAIL  ${name}${detail ? `  (${detail})` : ''}`);
}

const root = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

function loadSession() {
  const { outputText } = ts.transpileModule(read('src', 'lib', 'session.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  });
  const config = {
    isProduction: false,
    sessionConfig: {
      cookieName: 'bachelor_point_session',
      impersonationCookieName: 'bachelor_point_impersonation',
      impersonationMaxAgeSeconds: 3600,
      maxAgeSeconds: 2592000,
      refreshAfterSeconds: 86400,
      minSecretLength: 32,
      secret: 'a-test-secret-that-is-long-enough-for-the-check'
    }
  };
  const module = { exports: {} };
  new Function('module', 'exports', 'require', 'crypto', outputText)(module, module.exports, () => config, globalThis.crypto);
  return module.exports;
}

function forge(token, mutate) {
  const dot = token.indexOf('.');
  const payload = JSON.parse(Buffer.from(token.slice(0, dot), 'base64url').toString());
  mutate(payload);
  return `${Buffer.from(JSON.stringify(payload)).toString('base64url')}.${token.slice(dot + 1)}`;
}

async function run() {
  report('--- Mobile bearer auth ---');
  const s = loadSession();

  const cookie = await s.createSessionToken('u1', 3);
  const imp = await s.createImpersonationToken('admin', 'u1', 3);
  const mob = await s.createMobileToken('u1', 3);

  const payload = await s.verifyMobileToken(mob);
  check('mobile token verifies as mobile', payload && payload.uid === 'u1' && payload.sv === 3 && payload.typ === 'mob');
  check('mobile token expires in 30 days', payload && payload.exp - payload.iat === 2592000);
  check('cookie token fails mobile verifier', (await s.verifyMobileToken(cookie)) === null);
  check('impersonation token fails mobile verifier', (await s.verifyMobileToken(imp)) === null);
  check('mobile token fails cookie verifier', (await s.verifySessionToken(mob)) === null);
  check('mobile token fails impersonation verifier', (await s.verifyImpersonationToken(mob)) === null);
  check('mobile token fails cookie claim reader', s.readSessionClaims(mob) === null);
  check('mobile claim reader accepts mobile token', s.readMobileClaims(mob) !== null);
  check('mobile claim reader rejects cookie token', s.readMobileClaims(cookie) === null);
  check('mobile claim reader rejects impersonation token', s.readMobileClaims(imp) === null);

  const tampered = forge(mob, (p) => {
    p.uid = 'u2';
  });
  check('tampered mobile token fails', (await s.verifyMobileToken(tampered)) === null);

  const expired = forge(mob, (p) => {
    p.exp = Math.floor(Date.now() / 1000) - 10;
  });
  check('expired mobile token fails verifier', (await s.verifyMobileToken(expired)) === null);
  check('expired mobile token fails claim reader', s.readMobileClaims(expired) === null);

  const untyped = forge(mob, (p) => {
    delete p.typ;
  });
  check('mobile token with typ removed fails', (await s.verifyMobileToken(untyped)) === null);

  check('bearer header parsed', s.readBearerToken('Bearer abc.def') === 'abc.def');
  check('bearer scheme is case-insensitive', s.readBearerToken('bearer abc.def') === 'abc.def');
  check('non-bearer header ignored', s.readBearerToken('Basic abc') === undefined);
  check('missing header ignored', s.readBearerToken(undefined) === undefined);

  const authUtils = read('src', 'lib', 'auth-utils.ts');
  const realAt = authUtils.indexOf('export async function getRealSessionUser');
  const bearerAt = authUtils.indexOf('isBearerRequest(req)', realAt);
  const adoptAt = authUtils.indexOf('adoptFromIdentity(req)', realAt);
  check('bearer branch runs before identity adoption', bearerAt !== -1 && bearerAt < adoptAt);
  check('bearer requests skip impersonation', /isBearerRequest\(req\)\) return realUser/.test(authUtils));
  check('bearer is read only when no session cookie', /!readSessionToken\(req\) && Boolean\(readMobileBearer\(req\)\)/.test(authUtils));

  const mw = read('src', 'middleware.ts');
  check('middleware lets mobile auth routes through', mw.includes("'/api/mobile/v1/auth'"));
  check('middleware accepts mobile bearer claims on api only', /isApi && !token && readMobileClaims\(/.test(mw));

  for (const name of ['login', 'refresh', 'logout']) {
    check(`mobile ${name} route exists`, fs.existsSync(path.join(root, 'src', 'pages', 'api', 'mobile', 'v1', 'auth', `${name}.ts`)));
  }
  const mobileLogin = read('src', 'pages', 'api', 'mobile', 'v1', 'auth', 'login.ts');
  check('mobile login sets no cookie', !/Cookie/.test(mobileLogin));
  check('mobile login records device APP', mobileLogin.includes('MOBILE_DEVICE') && read('src', 'lib', 'login.ts').includes('DEVICES.APP'));
  const webLogin = read('src', 'pages', 'api', 'auth', 'login.ts');
  check('web login uses the shared login function', webLogin.includes('authenticateLogin(req, res)'));

  const passed = results.filter((r) => r.passed).length;
  report(`${passed}/${results.length} passed`);
  if (passed !== results.length) process.exitCode = 1;
}

run();
