const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const HOURS = Number(process.env.CLEANUP_UNVERIFIED_AFTER_HOURS || 24);
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const cutoff = new Date(Date.now() - HOURS * 3600_000);

  const stale = await prisma.user.findMany({
    where: {
      status: 'UNVERIFIED',
      password: '',
      createdAt: { lt: cutoff }
    },
    select: { id: true, email: true, createdAt: true }
  });

  const expiredTokens = await prisma.passwordToken.count({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] }
  });

  console.log(`cutoff                : ${cutoff.toISOString()} (${HOURS}h)`);
  console.log(`unverified to remove  : ${stale.length}`);
  console.log(`spent tokens to prune : ${expiredTokens}`);

  for (const user of stale) {
    console.log(`  - ${user.email}  (created ${user.createdAt.toISOString()})`);
  }

  if (DRY_RUN) {
    console.log('\ndry run, nothing deleted');
    return;
  }

  if (stale.length > 0) {
    const removed = await prisma.user.deleteMany({ where: { id: { in: stale.map((u) => u.id) } } });
    console.log(`\ndeleted users  : ${removed.count}`);
  }

  const prunedTokens = await prisma.passwordToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] }
  });
  console.log(`pruned tokens  : ${prunedTokens.count}`);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
