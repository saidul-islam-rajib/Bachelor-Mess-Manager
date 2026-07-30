function write(stream, message) {
  stream.write(`${message}\n`);
}

function report(message = '') {
  write(process.stdout, message);
}

function reportError(message = '') {
  write(process.stderr, message);
}

function reportFailure(error) {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  write(process.stderr, message);
}

module.exports = { report, reportError, reportFailure };
