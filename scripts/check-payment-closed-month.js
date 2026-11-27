const fs = require('fs');
const path = require('path');
const { report, reportError } = require('./reporter');

const file = path.join(__dirname, '..', 'src', 'pages', 'api', 'groups', '[id]', 'payments.ts');
const src = fs.readFileSync(file, 'utf8');
const post = src.slice(src.indexOf("req.method === 'POST'"));

const results = [];
function check(name, passed) {
  results.push({ name, passed });
  if (!passed) reportError(`  FAIL  ${name}`);
}

report('--- Payments into closed months ---');

const lookup = post.indexOf('monthClosing.findFirst');
const create = post.indexOf('paymentStatus.create');
check('POST looks up a live closing for the payment month', lookup !== -1);
check('lookup ignores reopened closings', /reopenedAt:\s*null/.test(post));
check('lookup keys on the month of the payment date', /monthKey:\s*date\.slice\(0,\s*7\)/.test(post));
check('lookup runs before the payment is created', lookup !== -1 && create !== -1 && lookup < create);
check('closed month is rejected with 400', /closing[\s\S]{0,200}badRequest\(res, strings\./.test(post));

const passed = results.filter((r) => r.passed).length;
report(`${passed}/${results.length} passed`);
if (passed !== results.length) process.exitCode = 1;
