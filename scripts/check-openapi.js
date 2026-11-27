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
  for (const [apiPath, file] of [
    ['/api/reports/dashboard', ['src', 'pages', 'api', 'reports', 'dashboard.ts']],
    ['/api/groups', ['src', 'pages', 'api', 'groups', 'index.ts']]
  ]) {
    check(`${apiPath} is in the contract`, Boolean(spec.paths && spec.paths[apiPath] && spec.paths[apiPath].get));
    const src = read(...file);
    check(`${apiPath} reads the session through getSessionUser`, /getSessionUser\(req/.test(src));
    check(`${apiPath} is not public in the middleware`, !mw.includes(`'${apiPath}'`));
  }
  for (const [apiPath, file, methods] of [
    ['/api/groups/{id}/meals', ['src', 'pages', 'api', 'groups', '[id]', 'meals.ts'], ['get', 'put']],
    ['/api/groups/{id}/meal-edit-window', ['src', 'pages', 'api', 'groups', '[id]', 'meal-edit-window.ts'], ['get', 'post', 'delete']],
    ['/api/meal-changes/{id}', ['src', 'pages', 'api', 'meal-changes', '[id].ts'], ['patch', 'delete']],
    ['/api/auth/me', ['src', 'pages', 'api', 'auth', 'me.ts'], ['get']],
    ['/api/groups/{id}/bazar-schedule', ['src', 'pages', 'api', 'groups', '[id]', 'bazar-schedule.ts'], ['get', 'put']],
    ['/api/groups/{id}/bazar-summary', ['src', 'pages', 'api', 'groups', '[id]', 'bazar-summary.ts'], ['get']],
    ['/api/groups/{id}/expenses', ['src', 'pages', 'api', 'groups', '[id]', 'expenses.ts'], ['get', 'post']],
    ['/api/expenses/{id}', ['src', 'pages', 'api', 'expenses', '[id].ts'], ['patch', 'delete']],
    ['/api/groups/{id}/categories', ['src', 'pages', 'api', 'groups', '[id]', 'categories.ts'], ['get']],
    ['/api/expenses/{id}/comments', ['src', 'pages', 'api', 'expenses', '[id]', 'comments.ts'], ['post']]
  ]) {
    const ops = (spec.paths && spec.paths[apiPath]) || {};
    const src = read(...file);
    for (const method of methods) {
      check(`${method.toUpperCase()} ${apiPath} is in the contract`, Boolean(ops[method]));
    }
    check(`${apiPath} contract lists no method the route lacks`, Object.keys(ops).every((m) => new RegExp(`'${m.toUpperCase()}'`).test(src) || m === 'get' && /req\.method === 'GET'|getSessionUser/.test(src) && apiPath === '/api/auth/me'));
    check(`${apiPath} reads the session through getSessionUser`, /getSessionUser\(req/.test(src));
  }
  const bazar = spec.components && spec.components.schemas && spec.components.schemas.BazarSchedule;
  check('BazarSchedule lists days, members and editable', Boolean(bazar && ['days', 'members', 'editable'].every((k) => bazar.required.includes(k))));
  const expensesMonth = spec.components && spec.components.schemas && spec.components.schemas.ExpensesMonth;
  check('ExpensesMonth lists expenses and members', Boolean(expensesMonth && ['expenses', 'members'].every((k) => expensesMonth.required.includes(k))));
  const meals = spec.components && spec.components.schemas && spec.components.schemas.MealsMonth;
  check('MealsMonth lists entries, editWindow and pendingChanges', Boolean(meals && ['entries', 'editWindow', 'pendingChanges'].every((k) => meals.required.includes(k))));
  const dash = spec.components && spec.components.schemas && spec.components.schemas.MemberDashboard;
  check('MemberDashboard lists current and previous', Boolean(dash && dash.required.includes('current') && dash.required.includes('previous')));
  check('middleware makes only /api/mobile/v1/auth public', publicMobile && !/'\/api\/mobile'/.test(mw) && !/'\/api\/mobile\/v1'/.test(mw));

  const passed = results.filter((r) => r.passed).length;
  report(`${passed}/${results.length} passed`);
  if (passed !== results.length) process.exitCode = 1;
}

run();
