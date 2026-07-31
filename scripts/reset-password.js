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

const ROLE_MEMBER = 'MEMBER';
const STATUS_APPROVED = 'APPROVED';
const EDITABLE_ROLES = ['MEMBER', 'SUPERVISOR'];
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
  report('Reset the password of any account (member, supervisor or admin)');
  report('');
  report('  npm run user:password -- --email someone@example.com --password "a-long-password"');
  report('  npm run user:password -- --email someone@example.com            password becomes the email');
  report('  npm run user:password -- --email someone@example.com --approve  also approve the account');
  report('  npm run user:password -- --email someone@example.com --create --name "Full Name"');
  report('');
  report('Options: --email --password --approve --create --name --role --phone');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (hasFlag(args, 'help', 'h')) {
    showUsage();
    return;
  }

  const email = (typeof args.email === 'string' ? args.email : '').trim().toLowerCase();
  if (!email) {
    reportError('An email is required: npm run user:password -- --email someone@example.com');
    process.exitCode = 1;
    return;
  }

  const password = typeof args.password === 'string' && args.password ? args.password : email;

  if (password.length < PASSWORD_MIN_LENGTH) {
    reportError(`The password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
    process.exitCode = 1;
    return;
  }

  const target = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, role: true, status: true }
  });

  const approve = hasFlag(args, 'approve');

  if (!target) {
    if (!hasFlag(args, 'create')) {
      reportError(`No account found with email ${email}.`);
      reportError('Pass --create to create it: npm run user:password -- --email ' + email + ' --create --name "Full Name"');
      process.exitCode = 1;
      return;
    }

    if (!EMAIL_PATTERN.test(email)) {
      reportError(`Not a valid email address: ${email}`);
      process.exitCode = 1;
      return;
    }

    const role = typeof args.role === 'string' ? args.role.toUpperCase() : ROLE_MEMBER;
    if (!EDITABLE_ROLES.includes(role)) {
      reportError('--role must be MEMBER or SUPERVISOR.');
      process.exitCode = 1;
      return;
    }

    const created = await prisma.user.create({
      data: {
        name: typeof args.name === 'string' && args.name ? args.name : email.split('@')[0],
        email,
        password: await hashPassword(password),
        phone: typeof args.phone === 'string' ? args.phone : null,
        role,
        status: STATUS_APPROVED,
        publishedAt: new Date()
      },
      select: { email: true, name: true, role: true, status: true }
    });

    report(`Created ${created.email} (${created.name}, ${created.role}, ${created.status}).`);
    report('');
    report('Sign in at /auth/login with that email and password.');
    return;
  }

  const updated = await prisma.user.update({
    where: { id: target.id },
    data: {
      password: await hashPassword(password),
      tokenVersion: { increment: 1 },
      ...(approve
        ? { status: STATUS_APPROVED, publishedAt: new Date(), unpublishedAt: null }
        : {})
    },
    select: { email: true, name: true, role: true, status: true }
  });

  await prisma.passwordToken.deleteMany({ where: { userId: target.id } });

  report(`Password reset for ${updated.email} (${updated.name}, ${updated.role}, ${updated.status}).`);
  report('All existing sessions and pending password links were revoked.');

  if (updated.status !== STATUS_APPROVED) {
    report('');
    report(`This account is ${updated.status}, so it still cannot sign in.`);
    report('Re-run with --approve to approve it at the same time.');
    return;
  }

  report('');
  report('Sign in at /auth/login with that email and password.');
}

main()
  .catch((error) => {
    reportFailure(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
