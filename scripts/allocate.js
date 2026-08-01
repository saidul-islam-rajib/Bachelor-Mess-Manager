const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'src', 'lib', 'settlement.ts');
const SIGNATURE = 'export function allocate(totalPaisa: number, weights: number[]): number[] {';

function extractAllocate() {
  const source = fs.readFileSync(SOURCE, 'utf8');
  const start = source.indexOf(SIGNATURE);

  if (start === -1) {
    throw new Error(
      `Could not find allocate() in ${SOURCE}.\n` +
        'Its signature changed, so the money invariants are no longer being checked against the real code.'
    );
  }

  let depth = 0;
  let end = -1;

  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = i + 1;
        break;
      }
    }
  }

  if (end === -1) throw new Error('Could not find the end of allocate().');

  const body = source.slice(start + SIGNATURE.length, end);
  const factory = new Function(`return function allocate(totalPaisa, weights) {${body};`);
  return factory();
}

module.exports = { allocate: extractAllocate(), SOURCE };
