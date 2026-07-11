require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

async function main() {
  console.log('Seeding default accounts...');

  await prisma.user.upsert({
    where: { email: 'admin@mess.local' },
    update: { role: 'ADMIN', status: 'APPROVED' },
    create: {
      name: 'Admin User',
      email: 'admin@mess.local',
      password: hashPassword('Admin@123'),
      role: 'ADMIN',
      status: 'APPROVED'
    }
  });

  await prisma.user.upsert({
    where: { email: 'supervisor@mess.local' },
    update: { role: 'SUPERVISOR', status: 'APPROVED' },
    create: {
      name: 'Supervisor User',
      email: 'supervisor@mess.local',
      password: hashPassword('Supervisor@123'),
      role: 'SUPERVISOR',
      status: 'APPROVED'
    }
  });

  await prisma.user.upsert({
    where: { email: 'member@mess.local' },
    update: { role: 'MEMBER', status: 'APPROVED' },
    create: {
      name: 'Member User',
      email: 'member@mess.local',
      password: hashPassword('Member@123'),
      role: 'MEMBER',
      status: 'APPROVED'
    }
  });

  console.log('Seed complete.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
