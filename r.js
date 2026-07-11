require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const id = process.argv[2];
  const u = await p.user.findUnique({ where: { id } });
  global.__old = u.name;
  await p.user.update({ where: { id }, data: { name: 'RENAMED PERSON' } });
  console.log(`   renamed "${u.name}" -> "RENAMED PERSON"`);
  require('fs').writeFileSync('oldname.txt', u.name);
})().catch(e => console.error(e.message)).finally(() => p.$disconnect());
