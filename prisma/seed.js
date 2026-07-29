require('dotenv').config();

const crypto = require('crypto');
const { promisify } = require('util');
const { PrismaClient } = require('@prisma/client');
const { syncRolesAndPermissions, USER_ROLES } = require('./reference-data');
const { report, reportFailure } = require('../scripts/reporter');

const prisma = new PrismaClient();
const scrypt = promisify(crypto.scrypt);

const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
const SEED_ENABLED = ['1', 'true', 'yes', 'on'].includes(String(process.env.SEED_ENABLED || '').toLowerCase());

const readInt = (key, fallback) => {
  const value = Number(process.env[key]);
  return Number.isFinite(value) && value > 0 ? Math.trunc(value) : fallback;
};

const EMAIL_DOMAIN = process.env.SEED_EMAIL_DOMAIN || 'bachelorpoint.local';
const SUPERVISORS = readInt('SEED_SUPERVISORS', 4);
const MEMBERS = readInt('SEED_MEMBERS', 120);
const GROUPS = readInt('SEED_GROUPS', 10);
const MEMBERS_PER_GROUP = readInt('SEED_MEMBERS_PER_GROUP', 10);
const PENDING_USERS = readInt('SEED_PENDING_USERS', 5);
const REJECTED_USERS = readInt('SEED_REJECTED_USERS', 3);
const SUBSCRIBERS = readInt('SEED_SUBSCRIBERS', 12);

const SCRYPT_COST = readInt('PASSWORD_SCRYPT_COST', 16384);
const SCRYPT_BLOCK_SIZE = readInt('PASSWORD_SCRYPT_BLOCK_SIZE', 8);
const SCRYPT_PARALLELISM = readInt('PASSWORD_SCRYPT_PARALLELISM', 1);
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_SALT_LENGTH = 16;
const HASH_BATCH_SIZE = 8;

const USER_STATUS = { PENDING: 'PENDING', APPROVED: 'APPROVED', REJECTED: 'REJECTED' };
const GROUP_STATUS = { ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' };
const INVITATION_STATUS = { PENDING: 'PENDING', ACCEPTED: 'ACCEPTED', REJECTED: 'REJECTED' };
const PAYMENT_STATUS = { PAID: 'PAID', PARTIAL: 'PARTIAL', PENDING: 'PENDING' };
const EXPENSE_ACTIONS = { CREATED: 'CREATED', UPDATED: 'UPDATED', DELETED: 'DELETED' };
const SPLIT_METHODS = { MEAL: 'MEAL', EQUAL: 'EQUAL', CUSTOM: 'CUSTOM' };
const EXPENSE_TYPES = { BAZAR: 'BAZAR' };

const CHUNK_SIZE = 400;

async function hashPassword(password) {
  const salt = crypto.randomBytes(SCRYPT_SALT_LENGTH);
  const derived = await scrypt(password.normalize('NFKC'), salt, SCRYPT_KEY_LENGTH, {
    N: SCRYPT_COST,
    r: SCRYPT_BLOCK_SIZE,
    p: SCRYPT_PARALLELISM,
    maxmem: 256 * SCRYPT_COST * SCRYPT_BLOCK_SIZE
  });
  return [
    'scrypt',
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELISM,
    salt.toString('base64'),
    derived.toString('base64')
  ].join('$');
}

async function hashAll(passwords) {
  const hashes = [];
  for (let index = 0; index < passwords.length; index += HASH_BATCH_SIZE) {
    hashes.push(...(await Promise.all(passwords.slice(index, index + HASH_BATCH_SIZE).map(hashPassword))));
  }
  return hashes;
}

const uuid = () => crypto.randomUUID();

let seedState = 20260711;
function rnd() {
  seedState |= 0;
  seedState = (seedState + 0x6d2b79f5) | 0;
  let t = Math.imul(seedState ^ (seedState >>> 15), 1 | seedState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));
const pick = (list) => list[int(0, list.length - 1)];
const chance = (probability) => rnd() < probability;
const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const FIRST_NAMES = ['Saidul', 'Rajib', 'Shakib', 'Sajib', 'Ahammad', 'Mehedi', 'Tanvir', 'Nayeem', 'Rifat', 'Sabbir', 'Arif', 'Hasan', 'Imran', 'Jubayer', 'Kamal', 'Limon', 'Mahin', 'Nazmul', 'Omar', 'Parvez', 'Quamrul', 'Rakib', 'Sohel', 'Tofael', 'Uzzal', 'Wahid', 'Yasin', 'Zahid', 'Fahim', 'Galib'];
const LAST_NAMES = ['Islam', 'Ahmed', 'Rahman', 'Hossain', 'Chowdhury', 'Karim', 'Miah', 'Sarkar', 'Khan', 'Molla', 'Sheikh', 'Talukder'];
const AREAS = ['Dhanmondi', 'Mirpur', 'Uttara', 'Banani', 'Mohakhali', 'Bashundhara', 'Farmgate', 'Motijheel'];

const GROCERIES = [
  ['1 kg miniket rice', 80], ['5 kg miniket rice', 380], ['1 litre soyabean oil', 200],
  ['1 kg rui fish', 400], ['1 kg hilsa fish', 1200], ['1 kg broiler chicken', 220],
  ['1 kg beef', 780], ['1 kg potato', 45], ['1 kg onion', 100], ['1 kg lentil (masoor)', 140],
  ['500 g green chilli', 60], ['1 kg tomato', 90], ['1 dozen eggs', 145], ['1 kg sugar', 130],
  ['500 g garlic', 110], ['1 kg flour', 65], ['Mixed vegetables', 150], ['Spices and salt', 90]
];

const BILL_TEMPLATES = [
  ['RENT', 'Monthly house rent', 18000, 32000],
  ['ELECTRICITY', 'Electricity bill', 2200, 6500],
  ['WATER', 'Water bill', 600, 1400],
  ['WASTE', 'Waste collection', 200, 500],
  ['CHEF', 'Cook salary', 4000, 8000],
  ['WIFI', 'Broadband', 900, 1600],
  ['OTHER', 'Cleaning supplies and gas', 500, 2500]
];

const BAZAR_NOTES = ['Weekly bazar', 'Kacha bazar', 'Fish and vegetables', 'Grocery top-up', ''];

const COMMENT_TEXTS = [
  'Who is doing the bazar this week?',
  'Please keep the receipts, the totals are not matching.',
  'Rice is running out, someone buy tomorrow.',
  'Can we reduce fish this month? Costs are going up.',
  'Dinner was late yesterday, please tell the cook.',
  'I will be out of town for three days, no meals for me.',
  'Gas bill is due this week.',
  'Let us fix a monthly budget for bazar.'
];

const REPLY_TEXTS = [
  'I can go tomorrow morning.',
  'Agreed, let us keep it under budget.',
  'Receipt is with me, I will share a photo.',
  'Noted, I will inform the cook.',
  'Same here, count me out for two days.',
  'Already paid my share.',
  'Thanks for arranging.'
];

const EXPENSE_COMMENT_TEXTS = [
  'Fish looks expensive this week.',
  'Please attach the receipt.',
  'Good price, thanks.',
  'This should last us three days.',
  'Why is oil costing more than last time?',
  'Noted, will adjust next bazar.'
];

async function insertMany(model, rows) {
  for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
    await model.createMany({ data: rows.slice(index, index + CHUNK_SIZE) });
  }
  return rows.length;
}

const utcDay = (year, month, day) => new Date(Date.UTC(year, month, day));
const at = (date, hour, minute) => new Date(date.getTime() + hour * 3600000 + minute * 60000);

function splitEqually(total, userIds) {
  const paisa = Math.round(total * 100);
  const base = Math.floor(paisa / userIds.length);
  let remainder = paisa - base * userIds.length;
  return userIds.map((userId) => {
    const extra = remainder > 0 ? 1 : 0;
    remainder -= extra;
    return { userId, amount: round2((base + extra) / 100) };
  });
}

async function wipeSampleData() {
  await prisma.mealPlanDay.deleteMany();
  await prisma.mealPlan.deleteMany();
  await prisma.mealEntry.deleteMany();
  await prisma.expenseComment.deleteMany();
  await prisma.expenseShare.deleteMany();
  await prisma.expenseItem.deleteMany();
  await prisma.paymentStatus.deleteMany();
  await prisma.expenseHistory.deleteMany();
  await prisma.expenseEntry.deleteMany();
  await prisma.commentReply.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.groupOrder.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.group.deleteMany();
  await prisma.subscriber.deleteMany();
  await prisma.loginAttempt.deleteMany();
  await prisma.user.deleteMany({ where: { role: { not: USER_ROLES.ADMIN } } });
}

async function main() {
  if (IS_PRODUCTION && !SEED_ENABLED) {
    report('NODE_ENV is production and SEED_ENABLED is not set. Refusing to seed sample data.');
    report('Production databases should only receive reference data and the bootstrapped administrator.');
    report('Run "npm run db:sync-roles" and "npm run admin:init" instead.');
    return;
  }

  report(`Seeding sample data for NODE_ENV=${NODE_ENV}.`);

  report('Syncing roles and permissions...');
  const reference = await syncRolesAndPermissions(prisma);
  report(`roles               : ${reference.roles}`);
  report(`permissions         : ${reference.permissions}`);
  report(`role permissions    : ${reference.assignments}`);

  report('Clearing existing sample data (administrator accounts are preserved)...');
  await wipeSampleData();

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const today = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const lastDay = Math.min(today, daysInMonth);

  const nameFor = (index) => `${FIRST_NAMES[index % FIRST_NAMES.length]} ${LAST_NAMES[(index * 7) % LAST_NAMES.length]}`;
  const phoneFor = (index) => `+8801${String(300000000 + index * 1234567).slice(0, 9)}`;
  const emailFor = (prefix, index) => `${prefix}-${index}@${EMAIL_DOMAIN}`;

  const accounts = [];
  for (let index = 1; index <= SUPERVISORS; index += 1) {
    accounts.push({ email: emailFor('supervisor', index), role: USER_ROLES.SUPERVISOR, status: USER_STATUS.APPROVED, nameIndex: index + 2 });
  }
  for (let index = 1; index <= MEMBERS; index += 1) {
    accounts.push({ email: emailFor('member', index), role: USER_ROLES.MEMBER, status: USER_STATUS.APPROVED, nameIndex: index + 11 });
  }
  for (let index = 1; index <= PENDING_USERS; index += 1) {
    accounts.push({ email: emailFor('pending', index), role: USER_ROLES.MEMBER, status: USER_STATUS.PENDING, nameIndex: index + 40 });
  }
  for (let index = 1; index <= REJECTED_USERS; index += 1) {
    accounts.push({ email: emailFor('rejected', index), role: USER_ROLES.MEMBER, status: USER_STATUS.REJECTED, nameIndex: index + 50 });
  }

  report(`Hashing ${accounts.length} passwords with scrypt...`);
  const hashes = await hashAll(accounts.map((account) => account.email));

  const users = accounts.map((account, index) => ({
    id: uuid(),
    name: nameFor(account.nameIndex),
    email: account.email,
    password: hashes[index],
    phone: phoneFor(index + 1),
    role: account.role,
    status: account.status,
    lastLoginAt: account.status === USER_STATUS.APPROVED && chance(0.7) ? at(utcDay(year, month, lastDay), int(8, 22), int(0, 59)) : null,
    publishedAt: account.status === USER_STATUS.APPROVED ? now : null,
    unpublishedAt: account.status === USER_STATUS.REJECTED ? now : null
  }));

  await insertMany(prisma.user, users);

  const supervisors = users.filter((user) => user.role === USER_ROLES.SUPERVISOR);
  const members = users.filter((user) => user.role === USER_ROLES.MEMBER && user.status === USER_STATUS.APPROVED);
  const pendingUsers = users.filter((user) => user.status === USER_STATUS.PENDING);

  report(`users               : ${users.length}  (${SUPERVISORS} supervisors, ${MEMBERS} members, ${PENDING_USERS} pending, ${REJECTED_USERS} rejected)`);

  const groups = [];
  for (let index = 1; index <= GROUPS; index += 1) {
    const supervisor = supervisors[(index - 1) % SUPERVISORS];
    groups.push({
      id: uuid(),
      name: `Mess ${index} — ${pick(AREAS)}`,
      supervisorId: supervisor.id,
      status: index > GROUPS - 2 ? GROUP_STATUS.INACTIVE : GROUP_STATUS.ACTIVE,
      mealWeightBreakfast: pick([0.5, 0.5, 1]),
      mealWeightLunch: 1,
      mealWeightDinner: pick([1, 1, 1.5]),
      createdById: supervisor.id,
      publishedAt: now
    });
  }
  await insertMany(prisma.group, groups);
  report(`groups              : ${groups.length}  (max ${Math.ceil(GROUPS / SUPERVISORS)} per supervisor)`);

  const memberships = [];
  const rosterOf = new Map();
  let nextMember = 0;

  groups.forEach((group) => {
    const roster = [];
    for (let slot = 0; slot < MEMBERS_PER_GROUP; slot += 1) {
      const member = members[nextMember];
      nextMember += 1;
      if (!member) break;

      roster.push(member);
      memberships.push({
        id: uuid(),
        userId: member.id,
        groupId: group.id,
        joinedAt: utcDay(year, month, 1),
        isActive: true,
        createdById: group.supervisorId,
        publishedAt: now
      });
    }

    const supervisor = users.find((user) => user.id === group.supervisorId);
    roster.push(supervisor);
    memberships.push({
      id: uuid(),
      userId: supervisor.id,
      groupId: group.id,
      joinedAt: utcDay(year, month, 1),
      isActive: true,
      createdById: supervisor.id,
      publishedAt: now
    });

    rosterOf.set(group.id, roster);
  });

  const unassigned = members.slice(nextMember);
  const departed = unassigned.slice(0, 4);
  departed.forEach((member, index) => {
    const group = groups[index % groups.length];
    memberships.push({
      id: uuid(),
      userId: member.id,
      groupId: group.id,
      joinedAt: utcDay(year, Math.max(0, month - 3), 1),
      leftAt: utcDay(year, month, Math.max(1, lastDay - 5)),
      isActive: false,
      createdById: group.supervisorId,
      publishedAt: now
    });
  });

  await insertMany(prisma.membership, memberships);
  report(`memberships         : ${memberships.length}  (${MEMBERS_PER_GROUP} members + supervisor per group, ${departed.length} who left)`);

  const freeMembers = unassigned.slice(departed.length);
  const invitations = [];

  groups.forEach((group, groupIndex) => {
    const roster = rosterOf.get(group.id);

    for (let slot = 0; slot < 2 && freeMembers.length > 0; slot += 1) {
      invitations.push({
        id: uuid(),
        groupId: group.id,
        inviteeId: freeMembers[(groupIndex * 2 + slot) % freeMembers.length].id,
        invitedById: group.supervisorId,
        status: INVITATION_STATUS.PENDING,
        createdAt: at(utcDay(year, month, Math.max(1, today - 2)), 10, slot * 7),
        createdById: group.supervisorId,
        publishedAt: now
      });
    }

    invitations.push({
      id: uuid(),
      groupId: group.id,
      inviteeId: roster[0].id,
      invitedById: group.supervisorId,
      status: INVITATION_STATUS.ACCEPTED,
      respondedAt: at(utcDay(year, month, 1), 12, 0),
      createdAt: at(utcDay(year, month, 1), 9, 0),
      createdById: group.supervisorId,
      publishedAt: now
    });

    if (freeMembers.length > 0) {
      invitations.push({
        id: uuid(),
        groupId: group.id,
        inviteeId: freeMembers[(groupIndex * 5 + 2) % freeMembers.length].id,
        invitedById: group.supervisorId,
        status: INVITATION_STATUS.REJECTED,
        respondedAt: at(utcDay(year, month, 2), 18, 30),
        createdAt: at(utcDay(year, month, 2), 8, 0),
        createdById: group.supervisorId,
        publishedAt: now
      });
    }

    if (pendingUsers.length > 0) {
      invitations.push({
        id: uuid(),
        groupId: group.id,
        inviteeId: pendingUsers[groupIndex % pendingUsers.length].id,
        invitedById: group.supervisorId,
        status: INVITATION_STATUS.PENDING,
        createdAt: at(utcDay(year, month, Math.max(1, today - 1)), 11, 0),
        createdById: group.supervisorId,
        publishedAt: now
      });
    }
  });

  const seenInvitations = new Set();
  const uniqueInvitations = invitations.filter((invitation) => {
    const key = `${invitation.groupId}:${invitation.inviteeId}`;
    if (seenInvitations.has(key)) return false;
    seenInvitations.add(key);
    return true;
  });

  await insertMany(prisma.invitation, uniqueInvitations);
  report(`invitations         : ${uniqueInvitations.length}`);

  const orders = [];
  supervisors.forEach((supervisor) => {
    groups
      .filter((group) => group.supervisorId === supervisor.id)
      .forEach((group, position) => {
        orders.push({ id: uuid(), userId: supervisor.id, groupId: group.id, position, createdById: supervisor.id, publishedAt: now });
      });
  });
  await insertMany(prisma.groupOrder, orders);
  report(`group orders        : ${orders.length}`);

  const bazarEntries = [];
  const items = [];
  const history = [];
  const expenseComments = [];

  groups.forEach((group) => {
    const roster = rosterOf.get(group.id);
    const shoppingDays = [];
    for (let day = 1; day <= lastDay; day += 1) {
      if (day % 3 === 1) shoppingDays.push(day);
    }

    shoppingDays.forEach((day) => {
      const payer = pick(roster);
      const date = utcDay(year, month, day);
      const expenseId = uuid();

      const chosen = [];
      let total = 0;
      const lineCount = int(2, 4);
      for (let line = 0; line < lineCount; line += 1) {
        const [name, base] = GROCERIES[int(0, GROCERIES.length - 1)];
        const amount = round2(base * (0.9 + rnd() * 0.3));
        chosen.push({ name, amount });
        total = round2(total + amount);
      }

      const note = pick(BAZAR_NOTES);

      bazarEntries.push({
        id: expenseId,
        groupId: group.id,
        type: EXPENSE_TYPES.BAZAR,
        amount: total,
        date,
        payerId: payer.id,
        isReceived: true,
        splitMethod: SPLIT_METHODS.MEAL,
        note,
        createdAt: at(date, 9, int(0, 59)),
        createdById: payer.id,
        updatedById: payer.id,
        publishedAt: now
      });

      chosen.forEach((item, sortOrder) => {
        items.push({ id: uuid(), expenseId, name: item.name, amount: item.amount, sortOrder, createdById: payer.id, publishedAt: now });
      });

      history.push({
        id: uuid(),
        expenseId,
        groupId: group.id,
        actorId: payer.id,
        action: EXPENSE_ACTIONS.CREATED,
        expenseDate: date,
        amountTo: total,
        dateTo: date,
        noteTo: note,
        createdAt: at(date, 9, int(0, 59)),
        createdById: payer.id,
        publishedAt: now
      });

      if (chance(0.3)) {
        const bumped = round2(total * (1 + rnd() * 0.2));
        history.push({
          id: uuid(),
          expenseId,
          groupId: group.id,
          actorId: payer.id,
          action: EXPENSE_ACTIONS.UPDATED,
          expenseDate: date,
          amountFrom: total,
          amountTo: bumped,
          createdAt: at(date, 20, int(0, 59)),
          createdById: payer.id,
          publishedAt: now
        });

        const target = bazarEntries.find((entry) => entry.id === expenseId);
        target.amount = bumped;
        items[items.length - 1].amount = round2(items[items.length - 1].amount + round2(bumped - total));
      }

      for (let index = 0; index < int(0, 3); index += 1) {
        const author = pick(roster);
        expenseComments.push({
          id: uuid(),
          expenseId,
          groupId: group.id,
          userId: author.id,
          text: pick(EXPENSE_COMMENT_TEXTS),
          createdAt: at(date, 12 + index, int(0, 59)),
          createdById: author.id,
          publishedAt: now
        });
      }
    });

    const deletedDate = utcDay(year, month, Math.max(1, lastDay - 1));
    const ghostPayer = pick(roster);
    history.push({
      id: uuid(),
      expenseId: uuid(),
      groupId: group.id,
      actorId: ghostPayer.id,
      action: EXPENSE_ACTIONS.DELETED,
      expenseDate: deletedDate,
      amountFrom: round2(120 + rnd() * 400),
      dateFrom: deletedDate,
      noteFrom: 'Duplicate entry',
      createdAt: at(deletedDate, 21, 30),
      createdById: ghostPayer.id,
      publishedAt: now
    });
  });

  const bills = [];
  const shares = [];

  groups.forEach((group) => {
    const roster = rosterOf.get(group.id);
    const rosterIds = roster.map((person) => person.id);

    BILL_TEMPLATES.forEach(([type, label, low, high], index) => {
      const day = Math.min(1 + index * 2, lastDay);
      const date = utcDay(year, month, day);
      const amount = round2(low + rnd() * (high - low));
      const billId = uuid();

      const custom = type === 'OTHER' && chance(0.5);
      const targets = custom ? rosterIds.slice(0, Math.max(2, Math.floor(rosterIds.length / 2))) : rosterIds;

      bills.push({
        id: billId,
        groupId: group.id,
        type,
        amount,
        date,
        payerId: group.supervisorId,
        isReceived: chance(0.7),
        splitMethod: custom ? SPLIT_METHODS.CUSTOM : SPLIT_METHODS.EQUAL,
        note: label,
        createdAt: at(date, 10, int(0, 59)),
        createdById: group.supervisorId,
        updatedById: group.supervisorId,
        publishedAt: now
      });

      splitEqually(amount, targets).forEach((share) => {
        shares.push({
          id: uuid(),
          expenseId: billId,
          userId: share.userId,
          amount: share.amount,
          createdById: group.supervisorId,
          publishedAt: now
        });
      });

      history.push({
        id: uuid(),
        expenseId: billId,
        groupId: group.id,
        actorId: group.supervisorId,
        action: EXPENSE_ACTIONS.CREATED,
        expenseDate: date,
        amountTo: amount,
        dateTo: date,
        noteTo: label,
        createdAt: at(date, 10, int(0, 59)),
        createdById: group.supervisorId,
        publishedAt: now
      });
    });
  });

  await insertMany(prisma.expenseEntry, [...bazarEntries, ...bills]);
  await insertMany(prisma.expenseItem, items);
  await insertMany(prisma.expenseShare, shares);
  await insertMany(prisma.expenseHistory, history);
  await insertMany(prisma.expenseComment, expenseComments);
  report(`bazar entries       : ${bazarEntries.length}  (${items.length} product lines)`);
  report(`bills               : ${bills.length}  (${shares.length} member shares)`);
  report(`expense history     : ${history.length}`);
  report(`expense comments    : ${expenseComments.length}`);

  const mealEntries = [];
  const mealPlans = [];
  const mealPlanDays = [];

  groups.forEach((group) => {
    const roster = rosterOf.get(group.id);

    roster.forEach((person) => {
      for (let day = 1; day <= lastDay; day += 1) {
        if (chance(0.12)) continue;

        const breakfast = chance(0.55) ? 1 : 0;
        const lunch = chance(0.8) ? 1 : 0;
        const dinner = chance(0.85) ? (chance(0.1) ? 2 : 1) : 0;
        const totalMeals = breakfast + lunch + dinner;
        if (totalMeals === 0) continue;

        mealEntries.push({
          id: uuid(),
          userId: person.id,
          groupId: group.id,
          date: utcDay(year, month, day),
          breakfastCount: breakfast,
          lunchCount: lunch,
          dinnerCount: dinner,
          totalMeals,
          fromPlan: false,
          createdById: person.id,
          updatedById: person.id,
          publishedAt: now
        });
      }

      if (chance(0.5)) {
        const planId = uuid();
        mealPlans.push({
          id: planId,
          userId: person.id,
          groupId: group.id,
          isActive: chance(0.85),
          startDate: utcDay(year, month, today),
          createdById: person.id,
          updatedById: person.id,
          publishedAt: now
        });

        for (let weekday = 0; weekday < 7; weekday += 1) {
          const off = weekday === 5 && chance(0.5);
          mealPlanDays.push({
            id: uuid(),
            planId,
            weekday,
            enabled: !off,
            breakfast: off ? 0 : chance(0.5) ? 1 : 0,
            lunch: off ? 0 : 1,
            dinner: off ? 0 : 1,
            createdById: person.id,
            publishedAt: now
          });
        }
      }
    });
  });

  await insertMany(prisma.mealEntry, mealEntries);
  await insertMany(prisma.mealPlan, mealPlans);
  await insertMany(prisma.mealPlanDay, mealPlanDays);
  report(`meal entries        : ${mealEntries.length}  (day 1 to ${lastDay})`);
  report(`meal plans          : ${mealPlans.length}  (${mealPlanDays.length} weekday rows)`);

  const payments = [];
  groups.forEach((group) => {
    rosterOf.get(group.id).forEach((person) => {
      for (let index = 0; index < int(0, 2); index += 1) {
        const amountDue = round2(int(500, 3000));
        const amountPaid = chance(0.7) ? amountDue : round2(amountDue * (0.3 + rnd() * 0.4));
        payments.push({
          id: uuid(),
          userId: person.id,
          groupId: group.id,
          amountDue,
          amountPaid,
          status: amountPaid >= amountDue ? PAYMENT_STATUS.PAID : amountPaid > 0 ? PAYMENT_STATUS.PARTIAL : PAYMENT_STATUS.PENDING,
          dueDate: utcDay(year, month, int(1, lastDay)),
          createdById: group.supervisorId,
          updatedById: group.supervisorId,
          publishedAt: now
        });
      }
    });
  });
  await insertMany(prisma.paymentStatus, payments);
  report(`payments            : ${payments.length}`);

  const comments = [];
  const replies = [];

  groups.forEach((group) => {
    const roster = rosterOf.get(group.id);

    for (let index = 0; index < int(3, 5); index += 1) {
      const author = pick(roster);
      const commentId = uuid();
      const createdAt = at(utcDay(year, month, int(1, lastDay)), int(9, 21), int(0, 59));
      const mentioned = pick(roster.filter((person) => person.id !== author.id));

      comments.push({
        id: commentId,
        userId: author.id,
        groupId: group.id,
        text: chance(0.4) ? `@[u:${mentioned.id}] ${pick(COMMENT_TEXTS)}` : pick(COMMENT_TEXTS),
        createdAt,
        createdById: author.id,
        publishedAt: now,
        deletedAt: chance(0.08) ? at(createdAt, 2, 0) : null
      });

      for (let replyIndex = 0; replyIndex < int(0, 3); replyIndex += 1) {
        const replier = pick(roster);
        const mention = pick(roster.filter((person) => person.id !== replier.id));
        replies.push({
          id: uuid(),
          commentId,
          userId: replier.id,
          text: chance(0.5) ? `@[u:${mention.id}] ${pick(REPLY_TEXTS)}` : pick(REPLY_TEXTS),
          createdAt: at(createdAt, 1 + replyIndex, int(0, 59)),
          createdById: replier.id,
          publishedAt: now
        });
      }
    }
  });

  await insertMany(prisma.comment, comments);
  await insertMany(prisma.commentReply, replies);
  report(`comments            : ${comments.length}  (${replies.length} replies)`);

  const loginAttempts = [];
  members.slice(0, 6).forEach((member, index) => {
    const attempts = index < 2 ? 3 : 1;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      loginAttempts.push({
        id: uuid(),
        email: member.email,
        ipAddress: `203.0.113.${10 + index}`,
        userAgent: 'Mozilla/5.0 (seed data)',
        successful: false,
        reason: 'INVALID_CREDENTIALS',
        createdAt: at(utcDay(year, month, lastDay), int(6, 20), int(0, 59)),
        publishedAt: now
      });
    }
  });
  await insertMany(prisma.loginAttempt, loginAttempts);
  report(`login attempts      : ${loginAttempts.length}  (failed sign-ins for the security panel)`);

  const settings = await prisma.siteSettings.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      companyName: process.env.APP_NAME || 'Bachelor Point',
      tagline: process.env.APP_TAGLINE || 'Manage your mess without the arguments.',
      address: 'Dhaka 1207, Bangladesh',
      contactEmail: `hello@${EMAIL_DOMAIN}`,
      contactPhone: '+8801616002313',
      copyrightOwner: process.env.APP_AUTHOR_NAME || 'Saidul Islam Rajib',
      facebookUrl: 'https://facebook.com/bachelorpoint',
      newsletterEnabled: true,
      publishedAt: now
    }
  });
  report(`site settings       : 1  (login attempt limit ${settings.maxLoginAttempts})`);

  const subscribers = [];
  for (let index = 1; index <= SUBSCRIBERS; index += 1) {
    subscribers.push({ id: uuid(), email: emailFor('subscriber', index), publishedAt: now });
  }
  await insertMany(prisma.subscriber, subscribers);
  report(`subscribers         : ${subscribers.length}`);

  const adminCount = await prisma.user.count({ where: { role: USER_ROLES.ADMIN } });

  report('');
  report('Sample accounts (password is always the same as the email):');
  report(`  ${emailFor('supervisor', 1)}  / ${emailFor('supervisor', 1)}   ... up to supervisor-${SUPERVISORS}`);
  report(`  ${emailFor('member', 1)}      / ${emailFor('member', 1)}       ... up to member-${MEMBERS}`);
  report(`  ${emailFor('pending', 1)}     (awaiting approval, cannot sign in)`);
  report(`  ${emailFor('rejected', 1)}    (rejected, cannot sign in)`);
  report('');

  if (adminCount === 0) {
    report('No administrator exists yet. The seed never creates one.');
    report('Set ADMIN_EMAIL and ADMIN_PASSWORD in .env, then run: npm run admin:init');
  } else {
    report(`Administrator accounts present: ${adminCount} (left untouched by the seed).`);
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
