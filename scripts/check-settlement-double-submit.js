const fs = require('fs');
const path = require('path');
const { report, reportError } = require('./reporter');

const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'final-settlement.ts'), 'utf8');

const results = [];
function check(name, passed) {
  results.push({ name, passed });
  if (!passed) reportError(`  FAIL  ${name}`);
}

function body(name, next) {
  const start = src.indexOf(`async function ${name}Impl`);
  return src.slice(start, src.indexOf(next, start));
}

report('--- final settlement double submit ---');

const record = src.slice(src.indexOf('async function recordSettlementSubmission'), src.indexOf('const UNIQUE_VIOLATION'));
check('the submission is created, not upserted', /settlementSubmission\.create\(/.test(record) && !/upsert/.test(record));
check('a unique violation becomes an already-settled error', /P2002/.test(src) && /runSettlementTransaction/.test(src));

const cases = [
  ['settleMemberBalance', 'export const settleMemberBalance', 'tx.paymentStatus.create'],
  ['declareMemberSettled', 'export const declareMemberSettled', 'writeSettlementRow(tx'],
  ['settleWholeMonth', 'export const settleWholeMonth', 'writeSettlementRow(tx']
];
for (const [name, next, write] of cases) {
  const fn = body(name, next);
  const claim = fn.indexOf('recordSettlementSubmission(tx');
  const row = fn.indexOf(write);
  check(`${name} runs through runSettlementTransaction`, /runSettlementTransaction\(/.test(fn) && !/prisma\.\$transaction/.test(fn));
  check(`${name} claims the submission before writing ledger rows`, claim !== -1 && row > claim);
}

const passed = results.filter((r) => r.passed).length;
report(`${passed}/${results.length} passed`);
if (passed !== results.length) process.exitCode = 1;
