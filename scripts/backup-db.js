require('dotenv').config();

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const os = require('os');
const { spawn, spawnSync } = require('child_process');
const { pipeline } = require('stream/promises');
const { PrismaClient } = require('@prisma/client');
const { report, reportError, reportFailure } = require('./reporter');

const prisma = new PrismaClient();

const KEEP = Math.max(1, Number(process.env.BACKUP_KEEP_COUNT) || 2);
const ARCHIVE_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
const MIRROR_DIR = process.env.BACKUP_MIRROR_DIR || '';
const MODE = (process.env.BACKUP_MODE || 'auto').toLowerCase();
const NATIVE_DIR = process.env.BACKUP_NATIVE_DIR || '';
const PREFIX = 'backup';

function databaseName() {
  const url = process.env.DATABASE_URL || '';
  try {
    const parsed = new URL(url);
    const fromPath = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (fromPath) return fromPath;
  } catch (error) {
    /* not a URL-shaped connection string, fall through */
  }
  const match = /[;?]database=([^;&]+)/i.exec(url);
  if (!match) throw new Error('Could not read the database name from DATABASE_URL.');
  return match[1];
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

const quoteIdentifier = (name) => `"${String(name).replace(/"/g, '""')}"`;

async function ensureDir(dir) {
  await fs.promises.mkdir(dir, { recursive: true });
}

async function liveTables() {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT table_schema AS s, table_name AS t
     FROM information_schema.tables
     WHERE table_type = 'BASE TABLE'
       AND table_schema NOT IN ('pg_catalog', 'information_schema')
     ORDER BY table_schema, table_name`
  );
  return rows.map((row) => ({ schema: row.s, table: row.t }));
}

async function exportLogical(database, target) {
  const tablesMeta = await liveTables();
  const tables = {};
  let rowCount = 0;

  for (const { schema, table } of tablesMeta) {
    const rows = await prisma.$queryRawUnsafe(
      `SELECT * FROM ${quoteIdentifier(schema)}.${quoteIdentifier(table)}`
    );
    tables[table] = rows;
    rowCount += rows.length;
    report(`  ${table}: ${rows.length}`);
  }

  const payload = {
    format: 'bachelor-point-logical-backup',
    version: 1,
    database,
    takenAt: new Date().toISOString(),
    tableCount: tablesMeta.length,
    rowCount,
    tables
  };

  const json = JSON.stringify(payload, (_key, value) => (typeof value === 'bigint' ? value.toString() : value));
  const gz = zlib.gzipSync(Buffer.from(json, 'utf8'), { level: 9 });
  await fs.promises.writeFile(target, gz);

  return { rowCount, tableCount: tablesMeta.length, bytes: gz.length, rawBytes: Buffer.byteLength(json, 'utf8') };
}

function pgDumpAvailable() {
  const probe = spawnSync('pg_dump', ['--version'], { stdio: 'ignore' });
  return !probe.error && probe.status === 0;
}

function runPgTool(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) return resolve();
      const detail = stderr.trim().split('\n').pop() || `exit code ${code}`;
      reject(new Error(`${command} failed: ${detail}`));
    });
  });
}

async function backupNative(database, dir) {
  const target = path.join(dir, `${database}-${stamp()}.dump`);
  const url = process.env.DATABASE_URL || '';

  await runPgTool('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--file', target, url]);
  await runPgTool('pg_restore', ['--list', target]);

  return target;
}

async function gzipCopy(source, target) {
  await pipeline(fs.createReadStream(source), zlib.createGzip({ level: 9 }), fs.createWriteStream(target));
}

async function listBackups(dir) {
  const entries = await fs.promises.readdir(dir).catch(() => []);
  return entries.filter((name) => name.startsWith(`${PREFIX}-`) && !name.endsWith('.sha256')).sort();
}

async function rotate(dir, keep) {
  const backups = await listBackups(dir);
  const excess = backups.slice(0, Math.max(0, backups.length - keep));

  for (const name of excess) {
    await fs.promises.unlink(path.join(dir, name)).catch(() => {});
    await fs.promises.unlink(path.join(dir, `${name}.sha256`)).catch(() => {});
    report(`  rotated out ${name}`);
  }
  return excess.length;
}

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    fs.createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')))
      .on('error', reject);
  });
}

async function run() {
  const database = databaseName();
  await ensureDir(ARCHIVE_DIR);

  const started = Date.now();
  let finalPath;
  let kind;
  let summary = {};

  const wantNative = MODE === 'native' || (MODE === 'auto' && pgDumpAvailable());

  if (wantNative) {
    const dir = NATIVE_DIR || (await fs.promises.mkdtemp(path.join(os.tmpdir(), 'bp-backup-')));
    report(`Backing up ${database} (pg_dump, custom format)`);
    let dumpFile;
    try {
      dumpFile = await backupNative(database, dir);
      report('  verified (pg_restore --list passed)');
      finalPath = path.join(ARCHIVE_DIR, `${PREFIX}-${database}-${stamp()}.dump.gz`);
      await gzipCopy(dumpFile, finalPath);
      kind = 'native';
    } catch (error) {
      if (MODE === 'native') throw error;
      reportError(`  native backup unavailable (${String(error.message).split('\n').pop().trim()})`);
      reportError('  falling back to a logical export');
    } finally {
      if (dumpFile) await fs.promises.unlink(dumpFile).catch(() => {});
    }
  }

  if (!finalPath) {
    report(`Backing up ${database} (logical export)`);
    finalPath = path.join(ARCHIVE_DIR, `${PREFIX}-${database}-${stamp()}.json.gz`);
    summary = await exportLogical(database, finalPath);
    kind = 'logical';
  }

  const stats = await fs.promises.stat(finalPath);
  const digest = await sha256(finalPath);
  await fs.promises.writeFile(`${finalPath}.sha256`, `${digest}  ${path.basename(finalPath)}\n`);

  report('');
  report(`Wrote ${path.basename(finalPath)} (${(stats.size / 1024).toFixed(1)} KB, ${kind})`);
  if (summary.rowCount !== undefined) report(`  ${summary.rowCount} rows across ${summary.tableCount} tables`);
  report(`  sha256 ${digest.slice(0, 16)}...`);
  report(`  took ${((Date.now() - started) / 1000).toFixed(1)}s`);

  if (MIRROR_DIR) {
    await ensureDir(MIRROR_DIR);
    await fs.promises.copyFile(finalPath, path.join(MIRROR_DIR, path.basename(finalPath)));
    await fs.promises.copyFile(`${finalPath}.sha256`, path.join(MIRROR_DIR, `${path.basename(finalPath)}.sha256`));
    report(`  mirrored to ${MIRROR_DIR}`);
    await rotate(MIRROR_DIR, KEEP);
  }

  report('');
  await rotate(ARCHIVE_DIR, KEEP);
  const remaining = await listBackups(ARCHIVE_DIR);
  report(`Keeping ${remaining.length} backup(s) in ${ARCHIVE_DIR}:`);
  for (const name of remaining) report(`  ${name}`);
}

run()
  .catch((error) => {
    reportError('Backup failed.');
    reportFailure(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
