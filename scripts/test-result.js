const { report } = require('./reporter');

const MARKER = 'TEST_SUMMARY';

function emitSummary(suite, { total, passed, failed, skipped, reason }) {
  report('');
  report('='.repeat(60));
  if (skipped) {
    report(`${suite}:  SKIPPED - ${reason || 'not applicable in this configuration'}`);
  } else {
    report(`${suite}:  TOTAL ${total}   PASSED ${passed}   FAILED ${failed}`);
  }
  report('='.repeat(60));
  report(`${MARKER} ${JSON.stringify({ suite, total, passed, failed, skipped: Boolean(skipped), reason: reason || null })}`);
}

function parseSummaries(output) {
  const summaries = [];
  for (const line of output.split(/\r?\n/)) {
    const index = line.indexOf(MARKER);
    if (index === -1) continue;
    try {
      summaries.push(JSON.parse(line.slice(index + MARKER.length).trim()));
    } catch {
      continue;
    }
  }
  return summaries;
}

module.exports = { MARKER, emitSummary, parseSummaries };
