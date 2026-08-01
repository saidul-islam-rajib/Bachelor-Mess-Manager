const fs = require('fs');
const path = require('path');
const { allocate } = require('./allocate');
const { report, reportError, reportFailure } = require('./reporter');
const { emitSummary } = require('./test-result');

const results = [];

function check(name, passed, detail) {
  results.push({ name, passed, detail });
  if (!passed) reportError(`  FAIL  ${name}${detail ? `  (${detail})` : ''}`);
}

function run() {
  report('--- Money allocation invariants ---');

  const cases = [
    { total: 100, weights: [1, 1, 1], label: 'three equal shares of 1.00' },
    { total: 1000, weights: [3, 0, 7], label: 'a member with zero meals' },
    { total: 59500, weights: [1000, 0], label: 'the reported screenshot split' },
    { total: 1, weights: [1, 1, 1, 1], label: 'a single paisa across four members' },
    { total: 0, weights: [5, 5], label: 'nothing to share' },
    { total: 999999, weights: [1, 2, 3, 4, 5, 6, 7], label: 'seven uneven shares' },
    { total: 12345, weights: [500, 500, 500], label: 'a remainder that will not divide' },
    { total: 7, weights: [1000, 1000, 1000], label: 'fewer paisa than members' },
    { total: 260000, weights: [1, 1], label: 'an equal bill split' }
  ];

  for (const { total, weights, label } of cases) {
    const shares = allocate(total, weights);
    const sum = shares.reduce((a, b) => a + b, 0);

    check(`shares add back to the whole: ${label}`, sum === total, `got ${sum}, expected ${total}`);
    check(`no negative share: ${label}`, shares.every((s) => s >= 0), JSON.stringify(shares));
    check(
      `zero weight is charged nothing: ${label}`,
      weights.every((w, i) => w !== 0 || shares[i] === 0),
      JSON.stringify(shares)
    );
  }

  const ITERATIONS = 20000;
  let fuzzFailure = null;

  for (let i = 0; i < ITERATIONS && !fuzzFailure; i++) {
    const count = 1 + Math.floor(Math.random() * 8);
    const weights = Array.from({ length: count }, () => Math.floor(Math.random() * 5000));
    const total = Math.floor(Math.random() * 10_000_00);

    const shares = allocate(total, weights);
    const sum = shares.reduce((a, b) => a + b, 0);
    const expected = weights.reduce((a, b) => a + b, 0) > 0 ? total : 0;

    if (sum !== expected) fuzzFailure = { total, weights, shares, sum, expected };
    else if (shares.some((s) => s < 0)) fuzzFailure = { total, weights, shares, reason: 'negative share' };
  }

  check(
    `${ITERATIONS} random allocations always add back to the whole`,
    fuzzFailure === null,
    fuzzFailure ? JSON.stringify(fuzzFailure) : ''
  );

  report('');
  report('--- Brand assets stay in sync ---');

  const svg = fs.readFileSync(path.join(__dirname, '..', 'public', 'logo.svg'), 'utf8');
  const component = fs.readFileSync(path.join(__dirname, '..', 'src', 'components', 'Logo.tsx'), 'utf8');

  const ringPath = /LOGO_RING_PATH = '([^']+)'/.exec(component)?.[1];
  const portionPath = /LOGO_PORTION_PATH = '([^']+)'/.exec(component)?.[1];

  check('Logo component exposes its ring path', Boolean(ringPath));
  check('Logo component exposes its portion path', Boolean(portionPath));
  check(
    'nav logo matches public/logo.svg (ring)',
    Boolean(ringPath) && svg.includes(ringPath),
    'Logo.tsx and logo.svg have drifted - regenerate icons and sync the component'
  );
  check(
    'nav logo matches public/logo.svg (portion)',
    Boolean(portionPath) && svg.includes(portionPath),
    'Logo.tsx and logo.svg have drifted - regenerate icons and sync the component'
  );

  for (const icon of [
    'icon-192.png',
    'icon-512.png',
    'icon-192-maskable.png',
    'icon-512-maskable.png',
    'apple-touch-icon.png',
    'favicon-32.png',
    'icon-monochrome-512.png'
  ]) {
    const file = path.join(__dirname, '..', 'public', 'icons', icon);
    check(`icon ${icon} exists`, fs.existsSync(file));
  }

  const passed = results.filter((r) => r.passed).length;
  report('');
  report(`  ${passed} of ${results.length} invariants held`);

  emitSummary('allocation', {
    total: results.length,
    passed,
    failed: results.length - passed
  });

  if (passed !== results.length) process.exitCode = 1;
}

try {
  run();
} catch (error) {
  reportError('Allocation checks aborted.');
  reportFailure(error);
  emitSummary('allocation', { total: results.length + 1, passed: results.filter((r) => r.passed).length, failed: 1 });
  process.exitCode = 1;
}
