require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { report, reportError, reportFailure } = require('./reporter');

const SKIP = new Set(['_prisma_migrations']);

function connectionFor(database) {
  const url = process.env.DATABASE_URL || '';
  if (!database) return url;
  try {
    const parsed = new URL(url);
    parsed.pathname = `/${encodeURIComponent(database)}`;
    return parsed.toString();
  } catch (error) {
    return url.replace(/([;?]database=)[^;&]+/i, `$1${database}`);
  }
}

async function counts(url) {
  const prisma = new PrismaClient({ datasources: { db: { url } } });
  try {
    const tables = await prisma.$queryRawUnsafe(
      `SELECT table_schema AS s, table_name AS t
       FROM information_schema.tables
       WHERE table_type = 'BASE TABLE'
         AND table_schema NOT IN ('pg_catalog', 'information_schema')
       ORDER BY table_name`
    );

    const result = {};
    for (const { s, t } of tables) {
      if (SKIP.has(t)) continue;
      const rows = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) AS n FROM "${String(s).replace(/"/g, '""')}"."${String(t).replace(/"/g, '""')}"`
      );
      result[t] = Number(rows[0].n);
    }
    return result;
  } finally {
    await prisma.$disconnect();
  }
}

async function run() {
  const [sourceDb, targetDb] = process.argv.slice(2);
  if (!sourceDb || !targetDb) {
    throw new Error('Usage: node scripts/verify-restore.js <sourceDatabase> <targetDatabase>');
  }

  report(`Comparing ${sourceDb} against ${targetDb}`);

  const [source, target] = await Promise.all([counts(connectionFor(sourceDb)), counts(connectionFor(targetDb))]);

  const names = [...new Set([...Object.keys(source), ...Object.keys(target)])].sort();
  let mismatches = 0;
  let totalSource = 0;

  for (const name of names) {
    const a = source[name] ?? 0;
    const b = target[name] ?? 0;
    totalSource += a;
    if (a !== b) {
      mismatches += 1;
      reportError(`  MISMATCH ${name}: source ${a}, restored ${b}`);
    } else if (a > 0) {
      report(`  ok ${name}: ${a}`);
    }
  }

  report('');
  if (mismatches === 0) {
    report(`PASS. ${totalSource} rows across ${names.length} tables match exactly.`);
  } else {
    reportError(`FAIL. ${mismatches} table(s) differ.`);
    process.exitCode = 1;
  }
}

run().catch((error) => {
  reportError('Verification failed.');
  reportFailure(error);
  process.exitCode = 1;
});
