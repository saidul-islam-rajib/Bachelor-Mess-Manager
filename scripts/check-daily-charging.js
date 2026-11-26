const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { allocate } = require('./allocate');
const { report, reportError, reportFailure } = require('./reporter');
const { emitSummary } = require('./test-result');

const results = [];

function check(name, passed, detail) {
  results.push({ name, passed, detail });
  if (!passed) reportError(`  FAIL  ${name}${detail ? `  (${detail})` : ''}`);
}

function loadMealCost() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'meal-cost.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } });
  const module = { exports: {} };
  new Function('module', 'exports', 'require', outputText)(module, module.exports, () => ({ allocate }));
  return module.exports.allocateMealCosts;
}

function run() {
  report('--- DAILY meal charging ---');
  const allocateMealCosts = loadMealCost();
  const sum = (list) => list.reduce((a, b) => a + b, 0);

  const unitsByDay = new Map([
    ['2026-08-01', new Map([[0, 5000]])],
    ['2026-08-02', new Map([[1, 5000]])]
  ]);
  const pricedByDay = new Map([
    ['2026-08-01', 52000],
    ['2026-08-02', 52000]
  ]);
  const costs = allocateMealCosts(2, 104000, true, pricedByDay, unitsByDay, [5000, 5000]);
  check('each member pays for the days they ate', costs[0] === 52000 && costs[1] === 52000, JSON.stringify(costs));

  const uneven = new Map([
    ['2026-08-01', 30000],
    ['2026-08-02', 74000]
  ]);
  const unevenCosts = allocateMealCosts(2, 104000, true, uneven, unitsByDay, [5000, 5000]);
  check('a dearer day is charged to whoever ate on it', unevenCosts[0] === 30000 && unevenCosts[1] === 74000, JSON.stringify(unevenCosts));
  check('daily charges add back to the bazar', sum(unevenCosts) === 104000, String(sum(unevenCosts)));

  const mixedDay = new Map([['2026-08-01', new Map([[0, 3000], [1, 1000]])]]);
  const mixed = allocateMealCosts(2, 4000, true, new Map([['2026-08-01', 4000]]), mixedDay, [3000, 1000]);
  check('a day is split by that day meals', mixed[0] === 3000 && mixed[1] === 1000, JSON.stringify(mixed));

  const pooled = allocateMealCosts(2, 1000, true, new Map(), unitsByDay, [5000, 5000]);
  check('unplaced bazar is pooled over all meals', pooled[0] === 500 && pooled[1] === 500, JSON.stringify(pooled));

  const partial = allocateMealCosts(2, 1500, true, new Map([['2026-08-01', 1000]]), unitsByDay, [5000, 5000]);
  check('daily plus pooled still adds back to the bazar', sum(partial) === 1500 && partial[0] === 1250 && partial[1] === 250, JSON.stringify(partial));

  const monthly = allocateMealCosts(2, 1000, false, new Map(), unitsByDay, [3000, 1000]);
  check('monthly mode splits by member meals', monthly[0] === 750 && monthly[1] === 250, JSON.stringify(monthly));

  const noMeals = allocateMealCosts(3, 100, false, new Map(), new Map(), [0, 0, 0]);
  check('no meals splits equally', sum(noMeals) === 100, JSON.stringify(noMeals));

  const engine = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'settlement.ts'), 'utf8');
  check('the settlement engine charges members through allocateMealCosts', engine.includes('allocateMealCosts('));
  check('the engine no longer pools all bazar by member meals', !engine.includes('allocate(totalBazarPaisa, [...unitsByMember])'));

  const passed = results.filter((r) => r.passed).length;
  report(`  ${passed} of ${results.length} checks held`);
  emitSummary('daily-charging', { total: results.length, passed, failed: results.length - passed });
  if (passed !== results.length) process.exitCode = 1;
}

try {
  run();
} catch (error) {
  reportError('Daily charging checks aborted.');
  reportFailure(error);
  emitSummary('daily-charging', { total: results.length + 1, passed: results.filter((r) => r.passed).length, failed: 1 });
  process.exitCode = 1;
}
