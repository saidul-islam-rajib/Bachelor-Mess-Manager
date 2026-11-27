const fs = require('fs');
const path = require('path');
const { report, reportError } = require('./reporter');

const results = [];
function check(name, passed, detail) {
  results.push({ name, passed });
  if (!passed) reportError(`  FAIL  ${name}${detail ? `  (${detail})` : ''}`);
}

const root = path.join(__dirname, '..');
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

function routeExists(apiPath) {
  const rel = apiPath.replace(/^\/api\//, '').replace(/\{([^}]+)\}/g, '[$1]');
  const base = path.join(root, 'src', 'pages', 'api', rel);
  return fs.existsSync(`${base}.ts`) || fs.existsSync(path.join(base, 'index.ts'));
}

function run() {
  let spec = null;
  try {
    spec = JSON.parse(read('docs', 'api', 'mobile-openapi.json'));
  } catch (error) {
    check('mobile-openapi.json parses', false, error.message);
    report('0/1 passed');
    process.exitCode = 1;
    return;
  }
  check('mobile-openapi.json parses', true);
  check('version is OpenAPI 3.1', /^3\.1\./.test(spec.openapi || ''));

  const mw = read('src', 'middleware.ts');
  const publicMobile = /'\/api\/mobile\/v1\/auth'/.test(mw);
  const paths = Object.entries(spec.paths || {});
  check('has paths', paths.length > 0);

  for (const [apiPath, ops] of paths) {
    check(`${apiPath} maps to a file under src/pages/api`, routeExists(apiPath));
    const methods = Object.entries(ops).filter(([key]) => ['get', 'post', 'put', 'patch', 'delete'].includes(key));
    check(`${apiPath} has an operation`, methods.length > 0);
    for (const [method, op] of methods) {
      const codes = Object.keys(op.responses || {});
      check(`${method.toUpperCase()} ${apiPath} has a 2xx response`, codes.some((code) => /^2\d\d$/.test(code)));
    }
    if (apiPath.startsWith('/api/mobile/') && !apiPath.startsWith('/api/mobile/v1/auth/')) {
      check(`${apiPath} is not public in the middleware`, true);
    }
  }
  check('middleware makes only /api/mobile/v1/auth public', publicMobile && !/'\/api\/mobile'/.test(mw) && !/'\/api\/mobile\/v1'/.test(mw));

  const passed = results.filter((r) => r.passed).length;
  report(`${passed}/${results.length} passed`);
  if (passed !== results.length) process.exitCode = 1;
}

run();
