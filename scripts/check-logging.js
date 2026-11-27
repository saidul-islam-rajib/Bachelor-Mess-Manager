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

function loadLog(level) {
  const { outputText } = ts.transpileModule(read('src', 'lib', 'log.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  });
  const module = { exports: {} };
  const lines = [];
  const fakeConsole = { log: (line) => lines.push(line) };
  new Function('module', 'exports', 'require', 'console', 'globalThis', outputText)(
    module,
    module.exports,
    () => ({ logConfig: { level } }),
    fakeConsole,
    { crypto: globalThis.crypto }
  );
  return { lib: module.exports, lines };
}

async function run() {
  report('--- Logging ---');

  const a = loadLog('info');
  a.lib.log.info('test.one', { a: 1 });
  check('one line per call', a.lines.length === 1);
  const parsed = JSON.parse(a.lines[0]);
  check('line has ts, level, event, src', parsed.event === 'test.one' && parsed.level === 'info' && parsed.src === 'api' && !!parsed.ts);
  check('fields are kept', parsed.a === 1);

  a.lib.log.debug('test.debug');
  check('debug dropped at info', a.lines.length === 1);
  a.lib.log.warn('test.warn');
  check('warn passes at info', a.lines.length === 2);

  const w = loadLog('warn');
  w.lib.log.info('x');
  w.lib.log.warn('y');
  check('info dropped at warn', w.lines.length === 1);
  const d = loadLog('debug');
  d.lib.log.debug('x');
  check('debug passes at debug', d.lines.length === 1);

  const keys = ['password', 'newPassword', 'token', 'accessToken', 'secret', 'Authorization', 'cookie', 'otp', 'apiKey', 'p256dh', 'auth', 'code'];
  const nested = {};
  for (const k of keys) nested[k] = 'sensitive-value';
  const l = loadLog('info');
  l.lib.log.info('redact', { top: nested, deep: { list: [{ inner: nested }] }, safe: 'ok' });
  const out = l.lines[0];
  check('no sensitive value leaks', !out.includes('sensitive-value'));
  check('redacted marker present', out.split('[redacted]').length - 1 === keys.length * 2, String(out.split('[redacted]').length - 1));
  check('safe field kept', JSON.parse(out).safe === 'ok');
  check('non-key "authority" is not redacted', JSON.stringify(l.lib.redact({ authority: 'x' })).includes('"x"'));

  l.lib.log.info('bearer', { header: 'sent Bearer abc.def.ghi now' });
  check('Bearer token replaced', !l.lines[1].includes('abc.def.ghi') && l.lines[1].includes('Bearer [redacted]'));

  const long = l.lib.redact({ s: 'x'.repeat(2000) });
  check('long string cut to 500 plus marker', long.s.length <= 501);
  const arr = l.lib.redact({ a: Array.from({ length: 100 }, (_, i) => i) });
  check('array keeps 20 items', arr.a.length === 20);
  let deep = { v: 'bottom' };
  for (let i = 0; i < 10; i++) deep = { v: deep };
  check('depth stops at 6', JSON.stringify(l.lib.redact(deep)).includes('[depth]'));

  const circular = { name: 'c' };
  circular.self = circular;
  let threw = false;
  try {
    l.lib.log.info('circ', circular);
    l.lib.log.info('big', { n: BigInt(5), f() {}, d: new Date(NaN) });
  } catch {
    threw = true;
  }
  check('logger never throws on circular or odd values', !threw);

  const e = loadLog('info');
  const err = new Error('boom');
  err.stack = Array.from({ length: 50 }, (_, i) => `line${i}`).join('\n');
  e.lib.log.error('err', { error: err });
  const eo = JSON.parse(e.lines[0]);
  check('error serialises name, message, stack', eo.error.name === 'Error' && eo.error.message === 'boom');
  check('stack cut to 20 lines', eo.error.stack.split('\n').length === 20);

  const t = loadLog('debug');
  const wrapped = t.lib.traced('math.add', (x, y) => x + y);
  check('traced returns the value', wrapped(2, 3) === 5);
  const awaited = await t.lib.traced('math.async', async () => ({ id: 'abc', status: 'PAID', extra: 1 }))();
  check('traced async returns the value', awaited.id === 'abc');
  const events = t.lines.map((x) => JSON.parse(x));
  const end = events.find((x) => x.event === 'fn.end' && x.fn === 'math.async');
  check('fn.end has ms and id/status summary', end && typeof end.ms === 'number' && end.result.id === 'abc' && end.result.status === 'PAID' && end.result.extra === undefined);
  check('fn.start logged at debug', events.some((x) => x.event === 'fn.start' && x.level === 'debug'));
  let rethrown = null;
  try {
    await t.lib.traced('bad', async () => {
      throw new Error('nope');
    })();
  } catch (x) {
    rethrown = x;
  }
  const failed = t.lines.map((x) => JSON.parse(x)).find((x) => x.event === 'fn.error');
  check('traced rethrows', rethrown && rethrown.message === 'nope');
  check('fn.error logged with ms', failed && failed.level === 'error' && typeof failed.ms === 'number');
  let syncThrown = false;
  try {
    t.lib.traced('syncbad', () => {
      throw new Error('s');
    })();
  } catch {
    syncThrown = true;
  }
  check('traced rethrows sync errors', syncThrown);

  const r = loadLog('info').lib;
  check('valid request id kept', r.resolveRequestId('abcd1234-ef') === 'abcd1234-ef');
  check('short request id replaced', r.resolveRequestId('short') !== 'short');
  check('bad characters replaced', r.resolveRequestId('abcd 1234!!') !== 'abcd 1234!!');
  check('missing request id generated', /^[0-9a-f-]{36}$/.test(r.resolveRequestId(undefined)));
  check('65 character id replaced', r.resolveRequestId('a'.repeat(65)) !== 'a'.repeat(65));

  const ok = { platform: 'ios', entries: [{ level: 'info', event: 'api.call', rid: 'abcd1234ef' }] };
  check('valid client batch accepted', r.parseClientBatch(ok) !== null);
  check('unknown platform rejected', r.parseClientBatch({ ...ok, platform: 'windows' }) === null);
  check('51 entries rejected', r.parseClientBatch({ ...ok, entries: Array.from({ length: 51 }, () => ok.entries[0]) }) === null);
  check('50 entries accepted', r.parseClientBatch({ ...ok, entries: Array.from({ length: 50 }, () => ok.entries[0]) }) !== null);
  check('bad level rejected', r.parseClientBatch({ ...ok, entries: [{ level: 'fatal', event: 'x' }] }) === null);
  check('msg cut to 1000', r.parseClientBatch({ ...ok, entries: [{ level: 'info', event: 'x', msg: 'm'.repeat(5000) }] }).entries[0].msg.length === 1000);

  const c = loadLog('warn');
  const written = c.lib.emitClientBatch({
    platform: 'android',
    entries: [
      { level: 'info', event: 'dropped' },
      { level: 'error', event: 'kept', rid: 'abcd1234ef', ts: '2026-01-01T00:00:00Z', data: { token: 'zzz-secret' } }
    ]
  });
  const co = JSON.parse(c.lines[0]);
  check('client entries below LOG_LEVEL dropped', written === 1 && c.lines.length === 1);
  check('client line marked client with src and clientTs', co.client === true && co.src === 'android' && co.clientTs === '2026-01-01T00:00:00Z' && co.rid === 'abcd1234ef');
  check('client data redacted again', !c.lines[0].includes('zzz-secret'));

  const src = read('src', 'lib', 'with-audit.ts');
  check('withAudit sets x-request-id header', src.includes("'x-request-id'"));
  check('withAudit logs api.start, api.end, api.error', ['api.start', 'api.end', 'api.error'].every((x) => src.includes(x)));
  check('withAudit reads the mobile bearer', src.includes('verifyMobileToken'));
  check('middleware logs api.denied', read('src', 'middleware.ts').includes('api.denied'));
  check('no console.error left in withAudit or bootstrap', !src.includes('console.') && !read('src', 'lib', 'bootstrap', 'index.ts').includes('console.'));

  const failedCount = results.filter((x) => !x.passed).length;
  report(`${results.length - failedCount}/${results.length} passed`);
  if (failedCount) process.exit(1);
}

run().catch((error) => {
  reportError(error.stack || String(error));
  process.exit(1);
});
