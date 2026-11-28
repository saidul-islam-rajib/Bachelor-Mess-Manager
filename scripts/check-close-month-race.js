const fs = require('fs');
const path = require('path');
const { report, reportError } = require('./reporter');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'closings.ts'), 'utf8');
const start = src.indexOf('async function closeMonthImpl');
const body = src.slice(start, src.indexOf('export const closeMonth'));
const tx = body.slice(body.indexOf('prisma.$transaction'));

const results = [];
function check(name, passed) {
  results.push({ name, passed });
  if (!passed) reportError(`  FAIL  ${name}`);
}

report('--- closeMonth race ---');

const outside = body.slice(0, body.indexOf('prisma.$transaction'));
check('existing closings are not read outside the transaction', !/prisma\.monthClosing\.findMany/.test(outside));
check('the group row is locked first', /FOR UPDATE/.test(tx));
const lock = tx.indexOf('FOR UPDATE');
const read = tx.indexOf('tx.monthClosing.findMany');
const create = tx.indexOf('tx.monthClosing.create');
check('existing closings are read after the lock', lock !== -1 && read > lock);
check('the closing is created after the read', read !== -1 && create > read);
check('targets are filtered inside the transaction', tx.indexOf('alreadyClosed.has') > lock && tx.indexOf('alreadyClosed.has') < create);

const passed = results.filter((r) => r.passed).length;
report(`${passed}/${results.length} passed`);
if (passed !== results.length) process.exitCode = 1;
