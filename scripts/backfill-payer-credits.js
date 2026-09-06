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
const dryRun = args.includes('--dry-run');

const taka = (n) => `৳${Number(n).toFixed(2)}`;
const round2 = (n) => Math.round(n * 100) / 100;
const paisa = (n) => Math.round(n * 100);

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

  const where = { type: { not: 'BAZAR' }, splitMethod: 'CUSTOM', payerId: { not: null } };
  if (groupIds) where.groupId = { in: groupIds };

  const bills = await prisma.expenseEntry.findMany({
    where,
    select: {
      id: true,
      groupId: true,
      type: true,
      amount: true,
      date: true,
      payerId: true,
      note: true,
      shares: { select: { userId: true } },
      payments: {
        where: { fromPayer: true },
        select: { id: true, userId: true, amountPaid: true, dueDate: true }
      }
    },
    orderBy: { date: 'asc' }
  });

  const userNames = new Map(
    (
      await prisma.user.findMany({
        where: { id: { in: [...new Set(bills.flatMap((b) => [b.payerId, ...b.shares.map((s) => s.userId)]))] } },
        select: { id: true, name: true }
      })
    ).map((u) => [u.id, u.name])
  );
  const nameOf = (id) => userNames.get(id) || id;

  let created = 0;
  let fixed = 0;
  let removed = 0;
  let alreadyGood = 0;

  for (const bill of bills) {
    const isSingle = bill.shares.length === 1;
    const sole = isSingle ? bill.shares[0].userId : null;
    const shouldCredit = isSingle && bill.payerId && bill.payerId !== sole;

    const existing = bill.payments;
    const label = `${bill.type} ${bill.date.toISOString().slice(0, 10)} ${taka(bill.amount)}  [${bill.id}]`;

    if (!shouldCredit) {
      for (const row of existing) {
        console.log(`REMOVE  ${label}\n        stale payer credit for ${nameOf(row.userId)} (${taka(row.amountPaid)})`);
        if (!dryRun) await prisma.paymentStatus.delete({ where: { id: row.id } });
        removed += 1;
      }
      continue;
    }

    const match = existing.find((r) => r.userId === bill.payerId);
    const stale = existing.filter((r) => r.id !== match?.id);
    for (const row of stale) {
      console.log(`REMOVE  ${label}\n        stale payer credit for ${nameOf(row.userId)} (${taka(row.amountPaid)})`);
      if (!dryRun) await prisma.paymentStatus.delete({ where: { id: row.id } });
      removed += 1;
    }

    if (!match) {
      console.log(
        `CREATE  ${label}\n        credit ${taka(bill.amount)} to ${nameOf(bill.payerId)} (paid, charged to ${nameOf(sole)})`
      );
      if (!dryRun) {
        await prisma.paymentStatus.create({
          data: {
            userId: bill.payerId,
            groupId: bill.groupId,
            expenseId: bill.id,
            fromPayer: true,
            amountDue: 0,
            amountPaid: round2(bill.amount),
            status: 'PAID',
            dueDate: bill.date,
            publishedAt: new Date()
          }
        });
      }
      created += 1;
      continue;
    }

    const amountOff = paisa(match.amountPaid) !== paisa(bill.amount);
    const dateOff = match.dueDate.getTime() !== bill.date.getTime();
    if (amountOff || dateOff) {
      console.log(
        `FIX     ${label}\n        payer credit for ${nameOf(bill.payerId)}: ${taka(match.amountPaid)} -> ${taka(bill.amount)}`
      );
      if (!dryRun) {
        await prisma.paymentStatus.update({
          where: { id: match.id },
          data: { amountPaid: round2(bill.amount), amountDue: 0, status: 'PAID', dueDate: bill.date }
        });
      }
      fixed += 1;
      continue;
    }

    alreadyGood += 1;
  }

  console.log('');
  console.log(
    `${dryRun ? '[dry run] ' : ''}${created} created, ${fixed} fixed, ${removed} removed, ${alreadyGood} already correct.`
  );
  if (dryRun) console.log('Re-run without --dry-run to apply.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
