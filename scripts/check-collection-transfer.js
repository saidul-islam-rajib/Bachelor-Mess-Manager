const fs = require('fs');
const path = require('path');
const { report, reportError } = require('./reporter');

const file = path.join(__dirname, '..', 'src', 'pages', 'api', 'bills', '[id]', 'collections.ts');
const source = fs.readFileSync(file, 'utf8');

const results = [];
function check(name, passed) {
  results.push({ name, passed });
  if (!passed) reportError(`  FAIL  ${name}`);
}

report('--- Collection transfer permission ---');

const parseAt = source.indexOf("typeof toUserId === 'string'");
const manageAt = source.lastIndexOf('if (manages', parseAt);
const guard = source.slice(manageAt, parseAt);
const recipientBlock = source.slice(parseAt, source.indexOf('recipientId = toUserId', parseAt));

check('recipient parsing found', parseAt !== -1 && manageAt !== -1);
check('non-supervisors are rejected when toUserId is set', /!manages/.test(recipientBlock) && /forbidden\(/.test(recipientBlock));

const passed = results.filter((r) => r.passed).length;
report(`${passed}/${results.length} passed`);
if (passed !== results.length) process.exitCode = 1;
