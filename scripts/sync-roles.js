require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const { syncRolesAndPermissions } = require('../prisma/reference-data');
const { report, reportFailure } = require('./reporter');

const prisma = new PrismaClient();

async function main() {
  const result = await syncRolesAndPermissions(prisma);
  report(
    `Reference data synced: ${result.roles} roles, ${result.permissions} permissions, ${result.assignments} role-permission assignments.`
  );
}

main()
  .catch((error) => {
    reportFailure(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
