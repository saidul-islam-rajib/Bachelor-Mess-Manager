const fs = require('fs');
const path = require('path');
const { report, reportError } = require('./reporter');

const plan = {
  bills: ['computeShares', 'billSharesByUser', 'billTotalsByType'],
  'bill-collections': ['reversePayment', 'hardDeletePayment', 'updatePaymentDetails', 'groupBillCollectionTotals'],
  advances: ['recordAdvanceDeposit', 'reverseAdvanceDeposit', 'applyAdvanceToShares', 'refundAdvanceForBill'],
  settlement: ['buildSettlement'],
  'final-settlement': [
    'ensureFinalSettlement',
    'getFinalSettlement',
    'settleMemberBalance',
    'declareMemberSettled',
    'settleWholeMonth',
    'markFinalSettlementSettled'
  ],
  closings: ['closeMonth', 'reopenMonth', 'markSettled'],
  'meal-cost': ['allocateMealCosts']
};

let failed = 0;
let total = 0;
function check(name, passed) {
  total += 1;
  if (!passed) {
    failed += 1;
    reportError(`  FAIL  ${name}`);
  }
}

report('--- Money lib tracing ---');
for (const [file, names] of Object.entries(plan)) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', `${file}.ts`), 'utf8');
  check(`${file} imports traced`, source.includes("import { traced } from '@/lib/log';"));
  for (const name of names) {
    check(`${file}.${name} is exported through traced`, source.includes(`export const ${name} = traced('${name}', ${name}Impl);`));
    check(`${file}.${name} has no untraced export`, !new RegExp(`export (async )?function ${name}\\b`).test(source));
  }
}
report(`  ${total - failed} of ${total} checks held`);
if (failed) process.exitCode = 1;
