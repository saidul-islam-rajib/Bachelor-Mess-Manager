const fs = require('fs');
const path = require('path');
const { report, reportError } = require('./reporter');

const file = path.join(__dirname, '..', 'src', 'pages', 'api', 'groups', '[id]', 'members.ts');
const source = fs.readFileSync(file, 'utf8');

const results = [];
function check(name, passed) {
  results.push({ name, passed });
  if (!passed) reportError(`  FAIL  ${name}`);
}

report('--- Member route guards ---');

const patchAt = source.indexOf("req.method === 'PATCH'");
const deleteAt = source.indexOf("req.method === 'DELETE'");
const patchBlock = source.slice(patchAt, deleteAt);
const deleteBlock = source.slice(deleteAt);

check('PATCH checks MEMBERSHIP_ADD', patchBlock.includes('PERMISSIONS.MEMBERSHIP_ADD'));
check('PATCH checks MEMBERSHIP_REMOVE', patchBlock.includes('PERMISSIONS.MEMBERSHIP_REMOVE'));
check('PATCH checks isGroupWritable', patchBlock.includes('isGroupWritable('));
check('PATCH guards run before any write', (() => {
  const writeAt = patchBlock.indexOf('activateMembership(');
  const w = patchBlock.indexOf('isGroupWritable(');
  return w !== -1 && w < writeAt;
})());
check('DELETE checks MEMBERSHIP_REMOVE for other members', deleteBlock.includes('PERMISSIONS.MEMBERSHIP_REMOVE'));
check('DELETE checks isGroupWritable for other members', deleteBlock.includes('isGroupWritable('));
check('DELETE guards run before the write', (() => {
  const writeAt = deleteBlock.indexOf('prisma.membership.update');
  const w = deleteBlock.indexOf('isGroupWritable(');
  const p = deleteBlock.indexOf('PERMISSIONS.MEMBERSHIP_REMOVE');
  return w !== -1 && p !== -1 && w < writeAt && p < writeAt;
})());

const passed = results.filter((r) => r.passed).length;
report(`${passed}/${results.length} passed`);
if (passed !== results.length) process.exitCode = 1;
