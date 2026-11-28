const fs = require('fs');
const path = require('path');
const { report, reportError } = require('./reporter');

const file = path.join(__dirname, '..', 'src', 'lib', 'bill-collections.ts');
const src = fs.readFileSync(file, 'utf8');
const start = src.indexOf('async function updatePaymentDetailsImpl');
const body = src.slice(start, src.indexOf('export const updatePaymentDetails', start));

const results = [];
function check(name, passed) {
  results.push({ name, passed });
  if (!passed) reportError(`  FAIL  ${name}`);
}

report('--- Payment edit amount ---');

const guard = body.search(/amount < 0 && original\.amountPaid >= 0/);
check('zero amount is rejected', /amount === 0/.test(body));
check(
  'negative amount is rejected unless the row is already a refund',
  /amount < 0 && original\.amountPaid >= 0[\s\S]{0,120}ok: false/.test(body)
);
check('negative guard runs before the amount is written', guard !== -1 && guard < body.indexOf('data.amountPaid'));

const passed = results.filter((r) => r.passed).length;
report(`${passed}/${results.length} passed`);
if (passed !== results.length) process.exitCode = 1;
