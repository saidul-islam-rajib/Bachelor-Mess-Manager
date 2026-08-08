require('dotenv').config();

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { report, reportError, reportFailure } = require('./reporter');

const ARCHIVE_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
const SKIP_TABLES = new Set(['_prisma_migrations']);

const quoteIdentifier = (name) => `"${String(name).replace(/"/g, '""')}"`;

function quoteValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (value instanceof Date) return `'${value.toISOString()}'::timestamptz`;
  if (Buffer.isBuffer(value)) return `'\\x${value.toString('hex')}'::bytea`;
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

function parseArgs(argv) {
  const args = { file: '', targetDatabase: '', confirm: false, dryRun: false };
  for (const arg of argv) {
    if (arg === '--yes' || arg === '-y') args.confirm = true;
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg.startsWith('--target-database=')) args.targetDatabase = arg.split('=')[1];
    else if (!arg.startsWith('-')) args.file = arg;
  }
  return args;
}

async function latestBackup() {
  const entries = await fs.promises.readdir(ARCHIVE_DIR).catch(() => []);
  const backups = entries.filter((name) => name.endsWith('.json.gz')).sort();
  if (backups.length === 0) return '';
  return path.join(ARCHIVE_DIR, backups[backups.length - 1]);
}

async function verifyChecksum(file) {
  const sidecar = `${file}.sha256`;
  if (!fs.existsSync(sidecar)) {
    report('  no .sha256 sidecar found, skipping integrity check');
    return;
  }

  const expected = (await fs.promises.readFile(sidecar, 'utf8')).trim().split(/\s+/)[0];
  const actual = crypto.createHash('sha256').update(await fs.promises.readFile(file)).digest('hex');

  if (expected !== actual) {
    throw new Error(`Checksum mismatch. The backup file is corrupt or truncated.\n  expected ${expected}\n  actual   ${actual}`);
  }
  report('  checksum verified');
}

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

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const file = args.file || (await latestBackup());

  if (!file) throw new Error(`No backup found in ${ARCHIVE_DIR}. Run "npm run backup:db" first.`);
  if (!fs.existsSync(file)) throw new Error(`Backup file not found: ${file}`);

  report(`Reading ${path.basename(file)}`);
  await verifyChecksum(file);

  const payload = JSON.parse(zlib.gunzipSync(await fs.promises.readFile(file)).toString('utf8'));
  if (payload.format !== 'bachelor-point-logical-backup') {
    throw new Error('That file is not a Bachelor Point logical backup.');
  }

  const tableNames = Object.keys(payload.tables);
  report(`  taken ${payload.takenAt} from ${payload.database}`);
  report(`  ${payload.rowCount} rows across ${tableNames.length} tables`);

  if (args.dryRun) {
    report('');
    report('Dry run, nothing was written. Tables in this backup:');
    for (const name of tableNames) report(`  ${name}: ${payload.tables[name].length}`);
    return;
  }

  const target = args.targetDatabase;
  const label = target || payload.database;

  if (!args.confirm) {
    reportError('');
    reportError(`This REPLACES every row in "${label}". Re-run with --yes to confirm.`);
    reportError(`  node scripts/restore-db.js ${path.basename(file)} --yes`);
    reportError('');
    reportError('To restore into a scratch database instead (safe):');
    reportError(`  node scripts/restore-db.js ${path.basename(file)} --target-database=scratch_db --yes`);
    process.exitCode = 1;
    return;
  }

  const prisma = new PrismaClient({ datasources: { db: { url: connectionFor(target) } } });

  try {
    report('');
    report(`Restoring into ${label}`);

    const allLive = await prisma.$queryRawUnsafe(
      `SELECT table_schema AS s, table_name AS t
       FROM information_schema.tables
       WHERE table_type = 'BASE TABLE'
         AND table_schema NOT IN ('pg_catalog', 'information_schema')`
    );
    const live = allLive.filter((row) => !SKIP_TABLES.has(row.t));
    const liveNames = new Set(allLive.map((row) => row.t));

    const missing = tableNames.filter((name) => !liveNames.has(name) && !SKIP_TABLES.has(name));
    if (missing.length > 0) {
      throw new Error(
        `The target database is missing ${missing.length} table(s): ${missing.join(', ')}.\n` +
          'Run "npm run prisma:deploy" against it first so the schema matches.'
      );
    }

    let inserted = 0;

    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL session_replication_role = 'replica'");

        for (const row of live) {
          await tx.$executeRawUnsafe(`DELETE FROM ${quoteIdentifier(row.s)}.${quoteIdentifier(row.t)}`);
        }

        for (const { s: schema, t: table } of live) {
          const rows = payload.tables[table];
          if (!rows || rows.length === 0) continue;

          const columns = Object.keys(rows[0]);
          const columnList = columns.map(quoteIdentifier).join(', ');

          for (let i = 0; i < rows.length; i += 100) {
            const chunk = rows.slice(i, i + 100);
            const values = chunk
              .map((record) => `(${columns.map((column) => quoteValue(record[column])).join(', ')})`)
              .join(', ');

            await tx.$executeRawUnsafe(
              `INSERT INTO ${quoteIdentifier(schema)}.${quoteIdentifier(table)} (${columnList}) VALUES ${values}`
            );
          }

          inserted += rows.length;
          report(`  ${table}: ${rows.length}`);
        }
      },
      { maxWait: 30000, timeout: 600000 }
    );

    report('');
    report(`Restored ${inserted} rows into ${label}.`);
    report(`Left ${[...SKIP_TABLES].join(', ')} untouched so the target keeps its own migration history.`);
  } finally {
    await prisma.$disconnect();
  }
}

run().catch((error) => {
  reportError('Restore failed.');
  reportFailure(error);
  process.exitCode = 1;
});
