const { report } = require('./reporter');

const MARKER = 'TEST_SUMMARY';

function emitSummary(suite, { total, passed, failed }) {
  report('');
  report('='.repeat(60));
  report(`${suite}:  TOTAL ${total}   PASSED ${passed}   FAILED ${failed}`);
  report('='.repeat(60));
  report(`${MARKER} ${JSON.stringify({ suite, total, passed, failed })}`);
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
