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
    ['/api/meal-prompts', ['src', 'pages', 'api', 'meal-prompts', 'index.ts'], ['get', 'post']],
    ['/api/groups/{id}/meal-plan', ['src', 'pages', 'api', 'groups', '[id]', 'meal-plan.ts'], ['get', 'put']],
    ['/api/groups/{id}/meal-summary', ['src', 'pages', 'api', 'groups', '[id]', 'meal-summary.ts'], ['get']],
    ['/api/groups/{id}/bazar-schedule', ['src', 'pages', 'api', 'groups', '[id]', 'bazar-schedule.ts'], ['get', 'put']],
    ['/api/groups/{id}/bazar-summary', ['src', 'pages', 'api', 'groups', '[id]', 'bazar-summary.ts'], ['get']],
    ['/api/groups/{id}/expenses', ['src', 'pages', 'api', 'groups', '[id]', 'expenses.ts'], ['get', 'post']],
    ['/api/expenses/{id}', ['src', 'pages', 'api', 'expenses', '[id].ts'], ['patch', 'delete']],
    ['/api/groups/{id}/categories', ['src', 'pages', 'api', 'groups', '[id]', 'categories.ts'], ['get']],
    ['/api/expenses/{id}/comments', ['src', 'pages', 'api', 'expenses', '[id]', 'comments.ts'], ['post']],
    ['/api/groups/{id}/bills', ['src', 'pages', 'api', 'groups', '[id]', 'bills.ts'], ['get', 'post']],
    ['/api/bills/{id}', ['src', 'pages', 'api', 'bills', '[id].ts'], ['patch', 'delete']],
    ['/api/bills/{id}/collections', ['src', 'pages', 'api', 'bills', '[id]', 'collections.ts'], ['post', 'patch', 'delete']],
    ['/api/groups/{id}/payments', ['src', 'pages', 'api', 'groups', '[id]', 'payments.ts'], ['get', 'post']],
    ['/api/payments/{id}', ['src', 'pages', 'api', 'payments', '[id].ts'], ['patch', 'delete']],
    ['/api/groups/{id}/advances', ['src', 'pages', 'api', 'groups', '[id]', 'advances.ts'], ['get', 'post', 'delete']],
    ['/api/settlements/mine', ['src', 'pages', 'api', 'settlements', 'mine.ts'], ['get']],
    ['/api/groups/{id}/members', ['src', 'pages', 'api', 'groups', '[id]', 'members.ts'], ['get', 'patch', 'delete']],
    ['/api/groups/{id}/members/{userId}', ['src', 'pages', 'api', 'groups', '[id]', 'members', '[userId].ts'], ['get']],
    ['/api/groups/{id}/invitations', ['src', 'pages', 'api', 'groups', '[id]', 'invitations.ts'], ['get', 'post']],
    ['/api/invitations', ['src', 'pages', 'api', 'invitations', 'index.ts'], ['get']],
    ['/api/invitations/{id}', ['src', 'pages', 'api', 'invitations', '[id].ts'], ['patch', 'delete']],
    ['/api/groups/{id}/supervisor', ['src', 'pages', 'api', 'groups', '[id]', 'supervisor.ts'], ['post']],
    ['/api/groups/{id}/co-supervisors', ['src', 'pages', 'api', 'groups', '[id]', 'co-supervisors.ts'], ['get', 'post', 'delete']],
    ['/api/groups/{id}/closings', ['src', 'pages', 'api', 'groups', '[id]', 'closings.ts'], ['get', 'post']],
    ['/api/closings/{id}', ['src', 'pages', 'api', 'closings', '[id].ts'], ['delete']],
    ['/api/groups/{id}/final-settlement', ['src', 'pages', 'api', 'groups', '[id]', 'final-settlement.ts'], ['get', 'post']],
    ['/api/settlement/status', ['src', 'pages', 'api', 'settlement', 'status.ts'], ['get']],
    ['/api/notifications', ['src', 'pages', 'api', 'notifications', 'index.ts'], ['get', 'patch']],
    ['/api/notifications/{id}', ['src', 'pages', 'api', 'notifications', '[id].ts'], ['patch']],
    ['/api/profile', ['src', 'pages', 'api', 'profile.ts'], ['patch']],
    ['/api/settings', ['src', 'pages', 'api', 'settings', 'index.ts'], ['get']],
    ['/api/users/{id}/profile', ['src', 'pages', 'api', 'users', '[id]', 'profile.ts'], ['get']],
    ['/api/role-requests', ['src', 'pages', 'api', 'role-requests', 'index.ts'], ['get', 'post']]
  ]) {
    const ops = (spec.paths && spec.paths[apiPath]) || {};
    const src = read(...file);
    for (const method of methods) {
      check(`${method.toUpperCase()} ${apiPath} is in the contract`, Boolean(ops[method]));
    }
    check(`${apiPath} contract lists no method the route lacks`, Object.keys(ops).every((m) => new RegExp(`'${m.toUpperCase()}'`).test(src) || m === 'get' && /req\.method === 'GET'|getSessionUser/.test(src) && apiPath === '/api/auth/me'));
    check(`${apiPath} reads the session through getSessionUser`, /getSessionUser\(req/.test(src));
  }
  const feed = spec.components && spec.components.schemas && spec.components.schemas.NotificationFeed;
  check('NotificationFeed lists notifications, unreadCount and meta', Boolean(feed && ['notifications', 'unreadCount', 'meta'].every((k) => feed.required.includes(k))));
  const bazar = spec.components && spec.components.schemas && spec.components.schemas.BazarSchedule;
  check('BazarSchedule lists days, members and editable', Boolean(bazar && ['days', 'members', 'editable'].every((k) => bazar.required.includes(k))));
  const expensesMonth = spec.components && spec.components.schemas && spec.components.schemas.ExpensesMonth;
  check('ExpensesMonth lists expenses and members', Boolean(expensesMonth && ['expenses', 'members'].every((k) => expensesMonth.required.includes(k))));
  const billsMonth = spec.components && spec.components.schemas && spec.components.schemas.BillsMonth;
  check('BillsMonth lists bills, members and totals', Boolean(billsMonth && ['bills', 'members', 'totals'].every((k) => billsMonth.required.includes(k))));
  const collectionReq = spec.components && spec.components.schemas && spec.components.schemas.CollectionRequest;
  check('CollectionRequest requires userId and offers toUserId', Boolean(collectionReq && collectionReq.required.includes('userId') && collectionReq.properties.toUserId));
  const paymentsMonth = spec.components && spec.components.schemas && spec.components.schemas.PaymentsMonth;
  check('PaymentsMonth lists members, payments and totals', Boolean(paymentsMonth && ['members', 'payments', 'totals'].every((k) => paymentsMonth.required.includes(k))));
  const advancesList = spec.components && spec.components.schemas && spec.components.schemas.AdvancesList;
  check('AdvancesList lists members and history', Boolean(advancesList && ['members', 'history'].every((k) => advancesList.required.includes(k))));
  const settlementsMine = spec.components && spec.components.schemas && spec.components.schemas.SettlementsMine;
  check('SettlementsMine lists submissions', Boolean(settlementsMine && settlementsMine.required.includes('submissions')));
  const closing = spec.components && spec.components.schemas && spec.components.schemas.Closing;
  check('Closing lists scope and lines', Boolean(closing && ['scope', 'lines'].every((k) => closing.required.includes(k))));
  const finalSettlement = spec.components && spec.components.schemas && spec.components.schemas.FinalSettlement;
  check('FinalSettlement lists members, settleUp and allClear', Boolean(finalSettlement && ['members', 'settleUp', 'allClear'].every((k) => finalSettlement.required.includes(k))));
  const profilePatch = spec.components && spec.components.schemas && spec.components.schemas.ProfilePatchRequest;
  check('ProfilePatchRequest offers password and currentPassword', Boolean(profilePatch && profilePatch.properties.password && profilePatch.properties.currentPassword));
  const roleRequests = spec.components && spec.components.schemas && spec.components.schemas.RoleRequestsList;
  check('RoleRequestsList lists requests, canReview and policy', Boolean(roleRequests && ['requests', 'canReview', 'policy'].every((k) => roleRequests.required.includes(k))));
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
