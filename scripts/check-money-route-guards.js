const fs = require('fs');
const path = require('path');
const { report, reportError } = require('./reporter');

const api = path.join(__dirname, '..', 'src', 'pages', 'api');
const read = (...parts) => fs.readFileSync(path.join(api, ...parts), 'utf8');

const results = [];
function check(name, passed) {
  results.push({ name, passed });
  if (!passed) reportError(`  FAIL  ${name}`);
}

report('--- Closed-group guards on money routes ---');

const payments = read('payments', '[id].ts');
const paymentsGuard = payments.indexOf('isGroupWritable(');
check('payments/[id] checks isGroupWritable', paymentsGuard !== -1);
check(
  'payments/[id] guard runs before PATCH and DELETE branches',
  paymentsGuard !== -1 && paymentsGuard < payments.indexOf("req.method === 'PATCH'", paymentsGuard === -1 ? 0 : payments.indexOf('canManageGroup('))
);

const closings = read('groups', '[id]', 'closings.ts');
const closingsGuard = closings.indexOf('isGroupWritable(');
check('groups/[id]/closings checks isGroupWritable', closingsGuard !== -1);
check(
  'closings guard runs before closeMonth',
  closingsGuard !== -1 && closingsGuard < closings.indexOf('await closeMonth(')
);

const closing = read('closings', '[id].ts');
const closingGuard = closing.indexOf('isGroupWritable(');
check('closings/[id] checks isGroupWritable', closingGuard !== -1);
check(
  'closings/[id] guard runs before reopenMonth',
  closingGuard !== -1 && closingGuard < closing.indexOf('await reopenMonth(')
);

const settlement = read('groups', '[id]', 'final-settlement.ts');
const settlementGuard = settlement.indexOf('isGroupWritable(');
const postAt = settlement.indexOf("req.method === 'POST'");
check('final-settlement checks isGroupWritable', settlementGuard !== -1);
check(
  'final-settlement guard runs inside POST before any action',
  settlementGuard !== -1 && postAt !== -1 && settlementGuard > postAt && settlementGuard < settlement.indexOf("action === 'settleMember'")
);

const passed = results.filter((r) => r.passed).length;
report(`${passed}/${results.length} passed`);
if (passed !== results.length) process.exitCode = 1;
