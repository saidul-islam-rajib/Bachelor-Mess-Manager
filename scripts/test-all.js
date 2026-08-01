require('dotenv').config();

const { spawn } = require('child_process');
const path = require('path');
const { report, reportError } = require('./reporter');
const { parseSummaries } = require('./test-result');

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const QUIET = process.argv.includes('--quiet');

const SUITES = [
  { name: 'allocation', script: 'check-allocation.js', needsServer: false, describe: 'money allocation invariants' },
  { name: 'mail', script: 'check-mail.js', needsServer: false, describe: 'SMTP connectivity and credentials' },
  { name: 'signup-flow', script: 'check-signup-flow.js', needsServer: true, describe: 'register, set password, log in' },
  { name: 'meal-rate', script: 'check-meal-rate.js', needsServer: true, describe: 'meal rate and cost split scenario' },
  { name: 'e2e', script: 'e2e-test.js', needsServer: true, describe: 'end-to-end API behaviour' }
];

function runSuite(script) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [path.join(__dirname, script)], {
      cwd: path.join(__dirname, '..'),
      env: process.env
    });

    let output = '';

    const capture = (chunk) => {
      const text = chunk.toString();
      output += text;
      if (!QUIET) process.stdout.write(text);
    };

    child.stdout.on('data', capture);
    child.stderr.on('data', capture);

    child.on('close', (code) => resolve({ code, output }));
    child.on('error', (error) => resolve({ code: 1, output: `${output}\n${error.message}` }));
  });
}

async function serverIsUp() {
  try {
    const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function run() {
  const started = Date.now();
  const up = await serverIsUp();

  if (!up) {
    reportError('');
    reportError(`No application responding at ${BASE}.`);
    reportError('Start it first, in another terminal:');
    reportError('');
    reportError('  EMAIL_REQUIRE_MX=false npm run dev');
    reportError('');
    reportError('Suites that need the server will be skipped.');
  }

  const rows = [];

  for (const suite of SUITES) {
    if (suite.needsServer && !up) {
      rows.push({ suite: suite.name, describe: suite.describe, noServer: true, total: 0, passed: 0, failed: 0 });
      continue;
    }

    if (!QUIET) {
      report('');
      report(`########## ${suite.name} — ${suite.describe} ##########`);
    }

    const { code, output } = await runSuite(suite.script);
    const summaries = parseSummaries(output);

    if (summaries.length === 0) {
      rows.push({
        suite: suite.name,
        describe: suite.describe,
        total: 0,
        passed: 0,
        failed: 1,
        crashed: true,
        exitCode: code
      });
      continue;
    }

    for (const summary of summaries) {
      rows.push({ ...summary, describe: suite.describe, exitCode: code });
    }
  }

  const total = rows.reduce((a, r) => a + r.total, 0);
  const passed = rows.reduce((a, r) => a + r.passed, 0);
  const failed = rows.reduce((a, r) => a + r.failed, 0);
  const noServer = rows.filter((r) => r.noServer);
  const skipped = rows.filter((r) => r.skipped);

  const pad = (value, width) => String(value).padStart(width);
  const name = (value, width) => String(value).padEnd(width);

  report('');
  report('='.repeat(64));
  report('  TEST SUMMARY');
  report('='.repeat(64));
  report(`  ${name('SUITE', 14)}${pad('TOTAL', 7)}${pad('PASSED', 8)}${pad('FAILED', 8)}   RESULT`);
  report('  ' + '-'.repeat(60));

  for (const row of rows) {
    const result = row.noServer
      ? 'SKIPPED (no server)'
      : row.skipped
        ? `SKIPPED (${row.reason || 'not applicable'})`
        : row.crashed
          ? `CRASHED (exit ${row.exitCode})`
          : row.failed === 0
            ? 'PASS'
            : 'FAIL';
    report(`  ${name(row.suite, 14)}${pad(row.total, 7)}${pad(row.passed, 8)}${pad(row.failed, 8)}   ${result}`);
  }

  report('  ' + '-'.repeat(60));
  report(`  ${name('TOTAL', 14)}${pad(total, 7)}${pad(passed, 8)}${pad(failed, 8)}`);
  report('='.repeat(64));

  const rate = total > 0 ? ((passed / total) * 100).toFixed(1) : '0.0';
  report(`  ${passed} of ${total} checks passed (${rate}%) in ${((Date.now() - started) / 1000).toFixed(1)}s`);

  if (noServer.length > 0) {
    report(`  ${noServer.length} suite(s) skipped because the app was not running.`);
  }
  for (const row of skipped) {
    report(`  ${row.suite} skipped: ${row.reason}`);
  }

  report('');

  if (failed > 0) {
    reportError(`FAILED — ${failed} check(s) did not pass.`);
    process.exitCode = 1;
  } else if (noServer.length > 0) {
    reportError('INCOMPLETE - the app was not running, so some suites never executed.');
    process.exitCode = 1;
  } else if (skipped.length > 0) {
    report('ALL TESTS PASSED (with configuration-driven skips noted above)');
  } else {
    report('ALL TESTS PASSED');
  }
}

run().catch((error) => {
  reportError('Test runner failed.');
  reportError(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
