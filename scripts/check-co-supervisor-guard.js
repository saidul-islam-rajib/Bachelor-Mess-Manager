const fs = require('fs');
const path = require('path');
const { report, reportError } = require('./reporter');

const root = path.join(__dirname, '..');
const route = fs.readFileSync(path.join(root, 'src', 'pages', 'api', 'groups', '[id]', 'co-supervisors.ts'), 'utf8');
const auth = fs.readFileSync(path.join(root, 'src', 'lib', 'auth-utils.ts'), 'utf8');

const results = [];
function check(name, passed) {
  results.push({ name, passed });
  if (!passed) reportError(`  FAIL  ${name}`);
}

report('--- Co-supervisor change guard ---');

const helperAt = auth.indexOf('export async function isMainSupervisor(');
const helperEnd = auth.indexOf('\nexport ', helperAt + 1);
const helper = helperAt === -1 ? '' : auth.slice(helperAt, helperEnd === -1 ? undefined : helperEnd);

check('isMainSupervisor helper exists', helperAt !== -1);
check('helper lets admins through', /requireAdmin\(user\)/.test(helper));
check('helper compares supervisorId only', /supervisorId:\s*user\.id/.test(helper) && !/coSupervisors/.test(helper));
check('co-supervisors route uses isMainSupervisor', /isMainSupervisor\(groupId, sessionUser\)/.test(route));
check('co-supervisors route no longer uses canManageGroup', !/canManageGroup/.test(route));

const passed = results.filter((r) => r.passed).length;
report(`${passed}/${results.length} passed`);
if (passed !== results.length) process.exitCode = 1;
