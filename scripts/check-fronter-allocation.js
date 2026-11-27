const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { report, reportError } = require('./reporter');

const results = [];

function check(name, passed, detail) {
  results.push({ name, passed, detail });
  if (!passed) reportError(`  FAIL  ${name}${detail ? `  (${detail})` : ''}`);
}

function load() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'lib', 'bill-collections.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
  });
  const module = { exports: {} };
  const stub = new Proxy({}, { get: () => () => ({}) });
  const stubs = {
    '@/lib/log': { traced: (name, fn) => fn },
    '@/lib/month': { round2: (n) => Math.round(n * 100) / 100, dayToUtcDate: (d) => new Date(d), utcDateToDay: (d) => d }
  };
  const req = (name) => stubs[name] || stub;
  new Function('module', 'exports', 'require', outputText)(module, module.exports, req);
  return module.exports.allocateToFronters;
}

function run() {
  report('--- Fronter allocation writes one offset row per payment ---');
  const allocate = load();
  const shares = [
    { userId: 'imran', advance: 500 },
    { userId: 'sajib', advance: 400 },
    { userId: 'limon', advance: 0 }
  ];
  const split = allocate(shares, 'limon', 360);
  check('payment covered by the largest fronter gives one allocation', split.length === 1 && split[0].userId === 'imran' && split[0].amount === 360, JSON.stringify(split));
  const big = allocate(shares, 'limon', 800);
  check('never more than one allocation', big.length <= 1, JSON.stringify(big));
  check('allocation never exceeds the advance', big.every((a) => a.amount <= 500), JSON.stringify(big));
  check('no fronter gives no allocation', allocate([{ userId: 'limon', advance: 0 }], 'limon', 100).length === 0);

  const passed = results.filter((r) => r.passed).length;
  report(`${passed}/${results.length} passed`);
  if (passed !== results.length) process.exitCode = 1;
}

run();
