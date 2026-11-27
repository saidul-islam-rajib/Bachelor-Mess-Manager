const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { report, reportError } = require('./reporter');
const { emitSummary } = require('./test-result');

const results = [];

function check(name, passed, detail) {
  results.push({ name, passed, detail });
  if (!passed) reportError(`  FAIL  ${name}${detail ? `  (${detail})` : ''}`);
}

function read(...parts) {
  return fs.readFileSync(path.join(__dirname, '..', ...parts), 'utf8');
}

function loadSplitEqually() {
  const { outputText } = ts.transpileModule(read('src', 'lib', 'bills.ts'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  });
  const module = { exports: {} };
  const stubs = {
    '@/lib/log': { traced: (name, fn) => fn },
    '@/lib/prisma': { prisma: {} },
    '@/lib/constants': { BILL_TYPE_FILTER: {}, EXPENSE_TYPES: { BAZAR: 'BAZAR' }, SPLIT_METHODS: { EQUAL: 'EQUAL', CUSTOM: 'CUSTOM' } },
    '@/lib/month': { round2: (n) => Math.round(n * 100) / 100 }
  };
  new Function('module', 'exports', 'require', outputText)(module, module.exports, (name) => stubs[name]);
  return module.exports.splitEqually;
}

function run() {
  report('--- Bill edit keeps original share holders ---');
  const splitEqually = loadSplitEqually();
  const shares = splitEqually(1000, ['A', 'B']);
  check('split across the two holders only', shares.length === 2 && shares[0].userId === 'A' && shares[1].userId === 'B');
  check('shares add up to the total', Math.round(shares.reduce((a, s) => a + s.amount, 0) * 100) === 100000);

  const handler = read('src', 'pages', 'api', 'bills', '[id].ts');
  const start = handler.indexOf('if (mustRecompute)');
  const block = handler.slice(start, handler.indexOf('const updated', start));
  check('amount edit re-splits across existing holders', /splitEqually\(/.test(block) && /expenseShare\.findMany\(\{\s*where: \{ expenseId: billId \}/.test(block));
  check('holders are read before the active-member split', block.indexOf('splitEqually(') !== -1 && block.indexOf('splitEqually(') < block.indexOf('computeShares('));

  const failed = results.filter((r) => !r.passed);
  report(failed.length ? `${failed.length} failed` : `All ${results.length} checks passed`);
  emitSummary('bill-edit-shares', { total: results.length, passed: results.length - failed.length, failed: failed.length });
  if (failed.length) process.exit(1);
}

run();
