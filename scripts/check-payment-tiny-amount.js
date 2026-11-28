const fs = require('fs');
const path = require('path');
const { report, reportError } = require('./reporter');

const root = path.join(__dirname, '..', 'src');
const post = fs.readFileSync(path.join(root, 'pages', 'api', 'groups', '[id]', 'payments.ts'), 'utf8');
const postBody = post.slice(post.indexOf("req.method === 'POST'"));
const lib = fs.readFileSync(path.join(root, 'lib', 'bill-collections.ts'), 'utf8');
const edit = lib.slice(lib.indexOf('if (amount !== undefined)'));

const results = [];
function check(name, passed) {
  results.push({ name, passed });
  if (!passed) reportError(`  FAIL  ${name}`);
}

report('--- Payment amounts that round to zero ---');

check('POST rounds the amount before validating', /const value = round2\(Number\(amount\)\)/.test(postBody));
check('POST requires at least one paisa', /value < 0\.01/.test(postBody));
check('POST stores the rounded value', /amountPaid: value,/.test(postBody));
const rounded = edit.indexOf('round2(amount)');
const guard = edit.search(/Math\.abs\(rounded\) < 0\.01/);
check('PATCH rounds before validating', rounded !== -1 && guard !== -1 && rounded < guard);

const passed = results.filter((r) => r.passed).length;
report(`${passed}/${results.length} passed`);
if (passed !== results.length) process.exitCode = 1;
