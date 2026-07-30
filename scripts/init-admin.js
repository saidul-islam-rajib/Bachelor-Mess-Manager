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
const ROLE_MEMBER = 'MEMBER';
const STATUS_APPROVED = 'APPROVED';
const STATUS_REJECTED = 'REJECTED';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

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
    const next = argv[i + 1];
    if (inlineValue !== undefined) {
      args[key] = inlineValue;
    } else if (next !== undefined && !next.startsWith('--')) {
      args[key] = next;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function hasFlag(args, ...names) {
  return names.some((name) => args[name] !== undefined && args[name] !== 'false');
}

function showUsage() {
  report('Administrator management');
  report('');
  report('  npm run admin:init                                  create or promote from .env');
  report('  npm run admin:init -- --list                        list every administrator');
  report('  npm run admin:init -- --email you@x.com --password "secret"');
  report('  npm run admin:init -- --reset-password              rotate the password');
  report('  npm run admin:init -- --replace                     make this the ONLY administrator');
  report('  npm run admin:init -- --remove --email old@x.com    remove one administrator');
  report('');
  report('Options: --email --password --name --phone --list --reset-password --replace --remove');
}

async function listAdmins() {
  const admins = await prisma.user.findMany({
    where: { role: ROLE_ADMIN },
    select: { email: true, name: true, status: true, lastLoginAt: true, createdAt: true },
    orderBy: { createdAt: 'asc' }
  });

  if (admins.length === 0) {
    report('No administrator accounts exist.');
    report('Create one with: npm run admin:init -- --email you@example.com --password "a-long-password"');
    return admins;
  }

  report(`Administrator accounts (${admins.length}):`);
  admins.forEach((admin) => {
    const lastLogin = admin.lastLoginAt ? admin.lastLoginAt.toISOString().slice(0, 16).replace('T', ' ') : 'never';
    report(`  ${admin.email}  (${admin.name}, ${admin.status}, last login ${lastLogin})`);
  });
  return admins;
}

async function demoteOtherAdmins(keepEmail) {
  const others = await prisma.user.findMany({
    where: { role: ROLE_ADMIN, email: { not: keepEmail } },
    select: { id: true, email: true }
  });

  if (others.length === 0) return [];

  await prisma.user.updateMany({
    where: { id: { in: others.map((admin) => admin.id) } },
    data: { role: ROLE_MEMBER, status: STATUS_REJECTED, unpublishedAt: new Date() }
  });

  for (const admin of others) {
    await prisma.user.update({ where: { id: admin.id }, data: { tokenVersion: { increment: 1 } } });
  }

  return others.map((admin) => admin.email);
}

async function removeAdmin(email) {
  const target = await prisma.user.findUnique({ where: { email }, select: { id: true, role: true } });
  if (!target) {
    reportError(`No account found with email ${email}.`);
    process.exitCode = 1;
    return;
  }

  const adminCount = await prisma.user.count({ where: { role: ROLE_ADMIN, status: STATUS_APPROVED } });
  if (target.role === ROLE_ADMIN && adminCount <= 1) {
    reportError('Refusing to remove the only administrator. Create another one first.');
    process.exitCode = 1;
    return;
  }

  try {
    await prisma.user.delete({ where: { id: target.id } });
    report(`Account ${email} deleted.`);
  } catch {
    await prisma.user.update({
      where: { id: target.id },
      data: {
        role: ROLE_MEMBER,
        status: STATUS_REJECTED,
        unpublishedAt: new Date(),
        tokenVersion: { increment: 1 }
      }
    });
    report(`Account ${email} has linked records, so it was demoted and deactivated instead of deleted.`);
    report('Its sessions were revoked and it can no longer sign in.');
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (hasFlag(args, 'help', 'h')) {
    showUsage();
    return;
  }

  const roleExists = await prisma.role.findUnique({ where: { code: ROLE_ADMIN } });
  if (!roleExists) {
    reportError('The ADMIN role is missing. Run "npm run db:sync-roles" first.');
    process.exitCode = 1;
    return;
  }

  if (hasFlag(args, 'list')) {
    await listAdmins();
    return;
  }

  const emailArg = typeof args.email === 'string' ? args.email : '';
  const email = (emailArg || process.env.ADMIN_EMAIL || '').trim().toLowerCase();

  if (hasFlag(args, 'remove')) {
    if (!email) {
      reportError('--remove needs an email: npm run admin:init -- --remove --email old@example.com');
      process.exitCode = 1;
      return;
    }
    await removeAdmin(email);
    await listAdmins();
    return;
  }

  const password = (typeof args.password === 'string' ? args.password : '') || process.env.ADMIN_PASSWORD || '';
  const name = (typeof args.name === 'string' ? args.name : '') || process.env.ADMIN_NAME || 'System Administrator';
  const phone = (typeof args.phone === 'string' ? args.phone : '') || process.env.ADMIN_PHONE || null;
  const resetPassword = hasFlag(args, 'reset-password', 'reset');
  const replace = hasFlag(args, 'replace');

  if (!email || !password) {
    reportError('Missing administrator credentials.');
    reportError('');
    reportError('Set them in .env:');
    reportError('  ADMIN_EMAIL="you@example.com"');
    reportError('  ADMIN_PASSWORD="a-long-password"');
    reportError('');
    reportError('Or pass them directly:');
    reportError('  npm run admin:init -- --email you@example.com --password "a-long-password"');
    reportError('');
    reportError('Run "npm run admin:init -- --help" for all options.');
    process.exitCode = 1;
    return;
  }

  if (!EMAIL_PATTERN.test(email)) {
    reportError(`Not a valid email address: ${email}`);
    process.exitCode = 1;
    return;
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    reportError(`The administrator password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
    process.exitCode = 1;
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    const alreadyAdmin = existing.role === ROLE_ADMIN && existing.status === STATUS_APPROVED;

    if (alreadyAdmin && !resetPassword && !replace) {
      report(`Administrator ${email} already exists. Nothing changed.`);
      report('Pass --reset-password to set a new password, or --replace to make it the only administrator.');
      return;
    }

    await prisma.user.update({
      where: { id: existing.id },
      data: {
        name,
        role: ROLE_ADMIN,
        status: STATUS_APPROVED,
        publishedAt: existing.publishedAt || new Date(),
        unpublishedAt: null,
        tokenVersion: { increment: 1 },
        ...(phone ? { phone } : {}),
        ...(resetPassword ? { password: await hashPassword(password) } : {})
      }
    });

    report(
      resetPassword
        ? `Administrator ${email} updated and password reset. All existing sessions were revoked.`
        : `Account ${email} promoted to administrator.`
    );
  } else {
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
  }

  if (replace) {
    const demoted = await demoteOtherAdmins(email);
    if (demoted.length === 0) {
      report(`${email} was already the only administrator.`);
    } else {
      report(`Removed administrator access from: ${demoted.join(', ')}`);
      report('Their sessions were revoked and they can no longer sign in.');
    }
  }

  report('');
  await listAdmins();
  report('');
  report('Sign in at /auth/login with that email and password.');

  if (email !== (process.env.ADMIN_EMAIL || '').trim().toLowerCase()) {
    report('');
    report('Update .env so the startup bootstrap matches this account:');
    report(`  ADMIN_EMAIL="${email}"`);
    report('  ADMIN_PASSWORD="<the password you just set>"');
  }
}

main()
  .catch((error) => {
    reportFailure(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
