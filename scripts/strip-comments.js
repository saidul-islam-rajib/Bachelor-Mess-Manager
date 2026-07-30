const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { report, reportError } = require('./reporter');

const ROOTS = ['src', 'scripts', 'prisma'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs']);
const SKIP_DIRECTORIES = new Set(['node_modules', '.next', 'migrations', 'out', 'build', '.git']);
const SKIP_FILES = new Set(['strip-comments.js']);
const NEWLINE = '\n';

function collectFiles(directory, found = []) {
  if (!fs.existsSync(directory)) return found;

  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRECTORIES.has(entry.name)) continue;
      collectFiles(path.join(directory, entry.name), found);
      continue;
    }
    if (SKIP_FILES.has(entry.name)) continue;
    if (EXTENSIONS.has(path.extname(entry.name))) {
      found.push(path.join(directory, entry.name));
    }
  }

  return found;
}

function commentRanges(text, fileName) {
  const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true, undefined);
  const ranges = [];
  const seen = new Set();

  function add(range) {
    const key = `${range.pos}:${range.end}`;
    if (seen.has(key)) return;
    seen.add(key);
    ranges.push(range);
  }

  function visit(node) {
    for (const child of node.getChildren(source)) {
      const leading = ts.getLeadingCommentRanges(text, child.pos) || [];
      const trailing = ts.getTrailingCommentRanges(text, child.end) || [];
      leading.forEach(add);
      trailing.forEach(add);
      visit(child);
    }
  }

  visit(source);
  return ranges.sort((a, b) => a.pos - b.pos);
}

function removeRanges(text, ranges) {
  let output = '';
  let cursor = 0;

  for (const range of ranges) {
    let start = range.pos;
    let end = range.end;

    let lineStart = start;
    while (lineStart > 0 && text[lineStart - 1] !== NEWLINE) lineStart -= 1;
    const nothingBefore = text.slice(lineStart, start).trim() === '';

    let lineEnd = end;
    while (lineEnd < text.length && text[lineEnd] !== NEWLINE) lineEnd += 1;
    const nothingAfter = text.slice(end, lineEnd).trim() === '';

    if (nothingBefore && nothingAfter) {
      start = lineStart;
      end = lineEnd < text.length ? lineEnd + 1 : lineEnd;
    }

    if (start < cursor) continue;

    output += text.slice(cursor, start);
    cursor = end;
  }

  return output + text.slice(cursor);
}

function tidy(text) {
  const lines = text.split(NEWLINE);
  const kept = [];

  for (const line of lines) {
    const trimmedEnd = line.replace(/[ \t]+$/, '');
    const isBlank = trimmedEnd.trim() === '';
    const previousBlank = kept.length > 0 && kept[kept.length - 1].trim() === '';

    if (isBlank && (previousBlank || kept.length === 0)) continue;
    kept.push(trimmedEnd);
  }

  while (kept.length > 0 && kept[kept.length - 1].trim() === '') kept.pop();

  return `${kept.join(NEWLINE)}${NEWLINE}`;
}

const MEMBER_PATTERN = /^\s*(readonly\s+)?[A-Za-z_$][\w$]*\??\s*:/;
const CONTINUES_PATTERN = /[;,{([]$/;

function dropOrphanBlankLines(text) {
  const lines = text.split(NEWLINE);
  const kept = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (line.trim() === '') {
      const previous = kept.length > 0 ? kept[kept.length - 1] : '';
      const next = lines[index + 1] ?? '';

      const previousIndent = previous.length - previous.trimStart().length;
      const nextIndent = next.length - next.trimStart().length;

      const insideLiteral =
        previousIndent > 0 &&
        previousIndent === nextIndent &&
        CONTINUES_PATTERN.test(previous.trimEnd()) &&
        MEMBER_PATTERN.test(next);

      if (insideLiteral) continue;
    }

    kept.push(line);
  }

  return kept.join(NEWLINE);
}

function processFile(filePath, { blankLinesOnly = false } = {}) {
  const original = fs.readFileSync(filePath, 'utf8');

  let next = original;
  if (!blankLinesOnly) {
    const ranges = commentRanges(original, filePath);
    if (ranges.length > 0) {
      next = tidy(removeRanges(original, ranges));
    }
  }

  next = dropOrphanBlankLines(next);

  if (next === original) return false;

  const before = ts.createSourceFile(filePath, original, ts.ScriptTarget.Latest, true);
  const after = ts.createSourceFile(filePath, next, ts.ScriptTarget.Latest, true);

  if (before.statements.length !== after.statements.length) {
    reportError(`SKIPPED (statement count changed): ${filePath}`);
    return false;
  }

  fs.writeFileSync(filePath, next, 'utf8');
  return true;
}

function main() {
  const blankLinesOnly = process.argv.includes('--blank-lines-only');
  const files = ROOTS.flatMap((root) => collectFiles(root));
  let changed = 0;

  for (const file of files) {
    if (processFile(file, { blankLinesOnly })) {
      changed += 1;
      report(`cleaned ${file}`);
    }
  }

  report(`Scanned ${files.length} files, changed ${changed}.`);
}

main();
