const fs = require('fs');
const path = require('path');
const { report, reportError } = require('./reporter');

const file = path.join(__dirname, '..', 'src', 'pages', 'api', 'bills', '[id].ts');
const source = fs.readFileSync(file, 'utf8');

const results = [];
function check(name, passed) {
  results.push({ name, passed });
  if (!passed) reportError(`  FAIL  ${name}`);
}

report('--- Bill route guards ---');

const guardAt = source.indexOf('isGroupWritable(');
const deleteAt = source.indexOf("req.method === 'DELETE'", source.indexOf('canManageGroup('));
const firstWriteAt = source.indexOf('prisma.$transaction');

check('bills/[id] checks isGroupWritable', guardAt !== -1);
check('closed-group guard runs before DELETE branch', guardAt !== -1 && deleteAt !== -1 && guardAt < deleteAt);
check('closed-group guard runs before any write', guardAt !== -1 && guardAt < firstWriteAt);

const passed = results.filter((r) => r.passed).length;
report(`${passed}/${results.length} passed`);
if (passed !== results.length) process.exitCode = 1;
