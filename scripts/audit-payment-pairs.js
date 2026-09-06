require('dotenv').config();

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const args = process.argv.slice(2);

function flag(name) {
  const i = args.indexOf(`--${name}`);
  if (i === -1) return null;
  const value = args[i + 1];
  return value && !value.startsWith('--') ? value : true;
}

const groupArg = flag('group');
const monthArg = flag('month');
const userArg = flag('user');
const billArg = flag('bill');
const verbose = args.includes('--verbose');

const taka = (n) => `${n < 0 ? '-' : ''}৳${Math.abs(n).toFixed(2)}`;
const paisa = (n) => Math.round(n * 100);
const day = (d) => new Date(d).toISOString().slice(0, 10);

function monthRange(key) {
  const [y, m] = key.split('-').map(Number);
  return { start: new Date(Date.UTC(y, m - 1, 1)), nextStart: new Date(Date.UTC(y, m, 1)) };
}

const ROW_SELECT = {
  id: true,
  userId: true,
  groupId: true,
  expenseId: true,
  toUserId: true,
  offsetOfId: true,
  reversalOfId: true,
  fromAdvance: true,
  amountPaid: true,
  amountDue: true,
  status: true,
  dueDate: true,
  createdAt: true,
  user: { select: { name: true, email: true } },
  toUser: { select: { name: true } },
  expense: { select: { id: true, type: true, date: true, amount: true } },
  offsetBy: { select: { id: true, amountPaid: true, reversedBy: { select: { id: true } } } },
  reversedBy: { select: { id: true, amountPaid: true } }
};

async function resolveGroupIds() {
  if (!groupArg || groupArg === true) return null;
  const groups = await prisma.group.findMany({
    where: { OR: [{ id: groupArg }, { name: { contains: groupArg, mode: 'insensitive' } }] },
    select: { id: true, name: true }
  });
  if (groups.length === 0) {
    console.error(`No group matches "${groupArg}".`);
    process.exit(1);
  }
  console.log(`Groups in scope: ${groups.map((g) => `${g.name} [${g.id}]`).join(', ')}\n`);
  return groups.map((g) => g.id);
}

async function main() {
  const groupIds = await resolveGroupIds();

  const where = {};
  if (groupIds) where.groupId = { in: groupIds };
  if (billArg && billArg !== true) where.expenseId = billArg;
  if (monthArg && monthArg !== true) {
    const { start, nextStart } = monthRange(monthArg);
    where.OR = [
      { expenseId: null, dueDate: { gte: start, lt: nextStart } },
      { expense: { date: { gte: start, lt: nextStart } } }
    ];
  }
  if (userArg && userArg !== true) {
    where.user = {
      OR: [
        { name: { contains: userArg, mode: 'insensitive' } },
        { email: { contains: userArg, mode: 'insensitive' } }
      ]
    };
  }

  const rows = await prisma.paymentStatus.findMany({ where, select: ROW_SELECT, orderBy: { createdAt: 'asc' } });

  const known = new Map(rows.map((r) => [r.id, r]));
  const wanted = new Set();
  for (const r of rows) {
    for (const id of [r.offsetOfId, r.reversalOfId, r.offsetBy && r.offsetBy.id, r.reversedBy && r.reversedBy.id]) {
      if (id && !known.has(id)) wanted.add(id);
    }
  }
  if (wanted.size > 0) {
    const extra = await prisma.paymentStatus.findMany({ where: { id: { in: [...wanted] } }, select: ROW_SELECT });
    for (const r of extra) known.set(r.id, r);
  }

  const all = [...known.values()];
  const nameOf = (userId) => {
    const hit = all.find((x) => x.userId === userId);
    return hit ? hit.user.name : userId;
  };

  const findings = [];
  const note = (severity, row, message) => findings.push({ severity, row, message });

  for (const r of rows) {
    if (r.offsetOfId && !known.has(r.offsetOfId)) {
      note('ERROR', r, `is an offset of ${r.offsetOfId}, which no longer exists — nothing balances this row`);
    }
    if (r.reversalOfId && !known.has(r.reversalOfId)) {
      note('ERROR', r, `is a reversal of ${r.reversalOfId}, which no longer exists`);
    }
    if (r.reversedBy && r.offsetBy && !r.offsetBy.reversedBy) {
      note(
        'ERROR',
        r,
        `payer leg was reversed, but its paired offset row ${r.offsetBy.id} ` +
          `(${nameOf((known.get(r.offsetBy.id) || {}).userId)}, ${taka(r.offsetBy.amountPaid)}) was left in place`
      );
    }
    if (r.offsetOfId && r.reversedBy) {
      const parent = known.get(r.offsetOfId);
      if (parent && !parent.reversedBy) {
        note('ERROR', r, `offset leg was reversed, but its payer row ${r.offsetOfId} was left in place`);
      }
    }
    if (r.toUserId && !r.offsetOfId && !r.reversalOfId && !r.offsetBy) {
      note('WARN', r, `names a recipient (${(r.toUser && r.toUser.name) || r.toUserId}) but has no paired offset row`);
    }
    if (r.offsetBy && !r.reversedBy && !r.offsetBy.reversedBy) {
      const sum = paisa(r.amountPaid) + paisa(r.offsetBy.amountPaid);
      if (Math.abs(sum) > 1) {
        note('WARN', r, `payer ${taka(r.amountPaid)} + offset ${taka(r.offsetBy.amountPaid)} = ${taka(sum / 100)}, expected 0`);
      }
    }
  }

  const bills = new Map();
  for (const r of rows) {
    if (!r.expenseId) continue;
    if (!bills.has(r.expenseId)) bills.set(r.expenseId, { expense: r.expense, perMember: new Map() });
    const b = bills.get(r.expenseId);
    b.perMember.set(r.userId, (b.perMember.get(r.userId) || 0) + paisa(r.amountPaid));
  }

  console.log('=== Per-bill payment ledger (sum of every payment row, incl. offsets & reversals) ===\n');
  for (const [billId, b] of bills) {
    const label = b.expense ? `${b.expense.type} ${day(b.expense.date)} (bill ${taka(b.expense.amount)})` : billId;
    const collected = [...b.perMember.values()].reduce((a, n) => a + n, 0) / 100;
    console.log(`${label}  [${billId}]`);
    for (const [userId, p] of b.perMember) {
      console.log(`   ${nameOf(userId).padEnd(26)} ${taka(p / 100).padStart(12)}`);
    }
    console.log(`   ${'-'.repeat(26)} ${'-'.repeat(12)}`);
    console.log(`   ${'net collected'.padEnd(26)} ${taka(collected).padStart(12)}${b.expense ? `   (bill ${taka(b.expense.amount)})` : ''}`);
    console.log('');
  }

  if (verbose) {
    console.log('=== Every row in scope ===\n');
    for (const r of rows) {
      const role = r.reversalOfId
        ? `reversal-of ${r.reversalOfId}`
        : r.offsetOfId
          ? `offset-of ${r.offsetOfId}`
          : r.toUserId
            ? `transfer to ${(r.toUser && r.toUser.name) || r.toUserId}`
            : 'payment';
      console.log(
        `${day(r.dueDate)}  ${r.user.name.padEnd(24)} ${taka(r.amountPaid).padStart(12)}  ${String(r.status).padEnd(8)} ${role}` +
          `${r.reversedBy ? '  [reversed]' : ''}${r.fromAdvance ? '  [fromAdvance]' : ''}`
      );
      console.log(`             id ${r.id}${r.expenseId ? `  bill ${r.expenseId}` : ''}`);
    }
    console.log('');
  }

  console.log('=== Integrity findings ===\n');
  if (findings.length === 0) {
    console.log('None. Every offset and reversal has its matching partner.');
  } else {
    for (const f of findings) {
      console.log(`[${f.severity}] ${day(f.row.dueDate)}  ${f.row.user.name}  ${taka(f.row.amountPaid)}`);
      console.log(`        ${f.message}`);
      console.log(`        row id ${f.row.id}${f.row.expenseId ? `   bill ${f.row.expenseId}` : ''}`);
      console.log('');
    }
    console.log(`${findings.filter((f) => f.severity === 'ERROR').length} error(s), ${findings.filter((f) => f.severity === 'WARN').length} warning(s).`);
  }

  process.exitCode = findings.some((f) => f.severity === 'ERROR') ? 1 : 0;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
