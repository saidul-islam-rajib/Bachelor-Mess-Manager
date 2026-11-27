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

function loadClientLog(win) {
  const { outputText } = ts.transpileModule(read('src', 'lib', 'client-log.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  });
  const module = { exports: {} };
  new Function('module', 'exports', 'window', 'navigator', 'fetch', 'Blob', 'setInterval', 'clearInterval', outputText)(
    module,
    module.exports,
    win.window,
    win.navigator,
    win.fetch,
    Blob,
    () => 1,
    () => undefined
  );
  return module.exports;
}

function makeWin() {
  const calls = [];
  const beacons = [];
  const listeners = {};
  const win = {
    calls,
    beacons,
    listeners,
    window: {
      addEventListener: (name, fn) => (listeners[name] = fn),
      removeEventListener: (name) => delete listeners[name]
    },
    navigator: { sendBeacon: (url, blob) => beacons.push({ url, blob }) },
    fetch: async (url, init) => {
      calls.push({ url, body: JSON.parse(init.body) });
      return { ok: true };
    }
  };
  return win;
}

async function run() {
  const route = read('src', 'pages', 'api', 'logs.ts');
  const mw = read('src', 'middleware.ts');
  const app = read('src', 'pages', '_app.tsx');
  const client = read('src', 'lib', 'api-client.ts');

  check('/api/logs route exists and is wrapped in withAudit', /export default withAudit\(handler/.test(route));
  check('route is POST only', /method !== 'POST'/.test(route));
  check('route returns 204 and 400', /noContent\(res\)/.test(route) && /badRequest\(res\)/.test(route));
  check('route caps the body at 32 KB', /32 \* 1024/.test(route) && /sizeLimit: MAX_LOG_BODY_BYTES/.test(route));
  check('/api/logs is public in the middleware', /'\/api\/logs'/.test(mw));
  check('logger is mounted in _app', /<ClientLogger \/>/.test(app));
  check('apiRequest reports failures', /logApiFailure\(method, path, 0, null\)/.test(client) && /x-request-id/.test(client));

  const w = makeWin();
  const lib = loadClientLog(w);
  lib.logClient('info', 'a');
  check('info entry waits', w.calls.length === 0);
  lib.logClient('error', 'b');
  await new Promise((r) => setImmediate(r));
  check('error flushes at once', w.calls.length === 1 && w.calls[0].url === '/api/logs');
  check('batch holds both entries as web', w.calls[0].body.platform === 'web' && w.calls[0].body.entries.length === 2);

  const w2 = makeWin();
  const lib2 = loadClientLog(w2);
  for (let i = 0; i < 20; i += 1) lib2.logClient('info', `e${i}`);
  await new Promise((r) => setImmediate(r));
  check('20 entries flush', w2.calls.length === 1 && w2.calls[0].body.entries.length === 20);

  lib2.logApiFailure('POST', '/api/logs', 500, 'abcdefgh');
  lib2.logApiFailure('GET', '/api/x?token=1', 502, 'abcdefgh');
  await lib2.flushClientLog();
  const last = w2.calls[w2.calls.length - 1];
  check('own endpoint failures are not reported', last && last.body.entries.length === 1);
  check('api.fail keeps status, rid and drops the query', last.body.entries[0].rid === 'abcdefgh' && last.body.entries[0].data.path === '/api/x' && last.body.entries[0].data.status === 502);

  const w3 = makeWin();
  w3.fetch = async () => {
    throw new Error('offline');
  };
  const lib3 = loadClientLog(w3);
  let threw = false;
  try {
    lib3.logClient('error', 'x');
    await lib3.flushClientLog();
  } catch {
    threw = true;
  }
  check('failed flush neither throws nor logs itself', !threw);

  const w4 = makeWin();
  const lib4 = loadClientLog(w4);
  lib4.logClient('warn', 'p');
  await lib4.flushClientLog(true);
  check('pagehide uses sendBeacon', w4.beacons.length === 1 && w4.calls.length === 0);

  const w5 = makeWin();
  const lib5 = loadClientLog(w5);
  lib5.installClientLog();
  check('registers error, rejection and pagehide', ['error', 'unhandledrejection', 'pagehide'].every((n) => w5.listeners[n]));
  w5.listeners.error({ message: 'boom', filename: 'f.js', lineno: 1, colno: 2, error: new Error('boom') });
  await new Promise((r) => setImmediate(r));
  check('window error is sent', w5.calls.length === 1 && w5.calls[0].body.entries[0].event === 'window.error');

  const passed = results.filter((r) => r.passed).length;
  report(`${passed}/${results.length} passed`);
  if (passed !== results.length) process.exitCode = 1;
}

run();
