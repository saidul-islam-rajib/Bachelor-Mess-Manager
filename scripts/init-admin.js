require('dotenv').config();

const crypto = require('crypto');
const { promisify } = require('util');
const { PrismaClient } = require('@prisma/client');
const { report, reportError, reportFailure } = require('./reporter');

const prisma = new PrismaClient();
const scrypt = promisify(crypto.scrypt);

const SCRYPT_COST = Number(process.env.PASSWORD_SCRYPT_COST) || 16384;
const SCRYPT_BLOCK_SIZE = Number(process.env.PASSWORD_SCRYPT_BLOCK_SIZE) || 8;
const SCRYPT_PARALLELISM = Number(process.env.PASSWORD_SCRYPT_PARALLELISM) || 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_LENGTH = 16;
const PASSWORD_MIN_LENGTH = Number(process.env.PASSWORD_MIN_LENGTH) || 8;

const ROLE_ADMIN = 'ADMIN';
const STATUS_APPROVED = 'APPROVED';

async function hashPassword(password) {
  const salt = crypto.randomBytes(SCRYPT_SALT_LENGTH);
  const derived = await scrypt(password.normalize('NFKC'), salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELISM,
    maxmem: 256 * SCRYPT_COST * SCRYPT_BLOCK_SIZE
  });
  return ['scrypt', SCRYPT_COST, SCRYPT_BLOCK_SIZE, SCRYPT_PARALLELISM, salt.toString('base64'), derived.toString('base64')].join('$');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const [key, inlineValue] = token.slice(2).split('=');
    args[key] = inlineValue !== undefined ? inlineValue : argv[++i];
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const email = (args.email || process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = args.password || process.env.ADMIN_PASSWORD || '';
  const name = args.name || process.env.ADMIN_NAME || 'System Administrator';
  const phone = args.phone || process.env.ADMIN_PHONE || null;
  const resetPassword = args.reset === 'true' || args.reset === '' || args['reset-password'] !== undefined;

  if (!email || !password) {
    reportError('Missing administrator credentials.');
    reportError('');
    reportError('Set them in .env:');
    reportError('  ADMIN_EMAIL="admin@yourdomain.com"');
    reportError('  ADMIN_PASSWORD="a-long-password"');
    reportError('');
    reportError('Or pass them directly:');
    reportError('  npm run admin:init -- --email admin@yourdomain.com --password "a-long-password"');
    process.exitCode = 1;
    return;
  }

  if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(email)) {
    reportError(`ADMIN_EMAIL is not a valid email address: ${email}`);
    process.exitCode = 1;
    return;
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    reportError(`ADMIN_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters.`);
    process.exitCode = 1;
    return;
  }

  const roleExists = await prisma.role.findUnique({ where: { code: ROLE_ADMIN } });
  if (!roleExists) {
    reportError('The ADMIN role is missing. Run "npm run db:sync-roles" first.');
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    const alreadyAdmin = existing.role === ROLE_ADMIN && existing.status === STATUS_APPROVED;

    if (alreadyAdmin && !resetPassword) {
      report(`Administrator ${email} already exists. Nothing changed.`);
      report('Pass --reset-password to set a new password for this account.');
      return;
    }

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: ROLE_ADMIN,
        status: STATUS_APPROVED,
        publishedAt: existing.publishedAt || new Date(),
        unpublishedAt: null,
        tokenVersion: { increment: 1 },
        ...(resetPassword ? { password: await hashPassword(password) } : {})
      }
    });

    report(
      resetPassword
        ? `Administrator ${email} updated and password reset. All existing sessions were revoked.`
        : `Existing account ${email} promoted to administrator.`
    );
    return;
  }

  await prisma.user.create({
    data: {
      name,
      email,
      password: await hashPassword(password),
      phone,
      role: ROLE_ADMIN,
      status: STATUS_APPROVED,
      publishedAt: new Date()
    }
  });

  report(`Administrator account created for ${email}.`);
  report('Sign in at /auth/login with that email and the configured password.');
}

main()
  .catch((error) => {
    reportFailure(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
