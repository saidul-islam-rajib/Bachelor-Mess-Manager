require('dotenv').config();
const crypto = require('crypto');
const { promisify } = require('util');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// 4 supervisors sharing 10 groups keeps every supervisor under the 10-group cap.
// 120 members for 10 groups of 10 leaves 20 people free to be invited around,
// which matters because a member may only ever be active in ONE group.
const SUPERVISORS = 4;
const GROUPS = 10;
const MEMBERS = 120;
const MEMBERS_PER_GROUP = 10;

const scrypt = promisify(crypto.scrypt);

// Must stay in step with src/lib/password.ts — same format, same parameters.
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password.normalize('NFKC'), salt, 64, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 256 * SCRYPT_N * SCRYPT_R
  });
  return ['scrypt', SCRYPT_N, SCRYPT_R, SCRYPT_P, salt.toString('base64'), derived.toString('base64')].join('$');
}

/** Hash in small batches — scrypt is deliberately slow, so run a few at a time. */
async function hashAll(passwords) {
  const out = [];
  for (let i = 0; i < passwords.length; i += 8) {
    out.push(...(await Promise.all(passwords.slice(i, i + 8).map(hashPassword))));
  }
  return out;
}

const uuid = () => crypto.randomUUID();

// Deterministic PRNG so a re-seed produces the same database every time.
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
const chance = (p) => rnd() < p;
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

const FIRST = ['Saidul', 'Rajib', 'Shakib', 'Sajib', 'Ahammad', 'Mehedi', 'Tanvir', 'Nayeem', 'Rifat', 'Sabbir', 'Arif', 'Hasan', 'Imran', 'Jubayer', 'Kamal', 'Limon', 'Mahin', 'Nazmul', 'Omar', 'Parvez', 'Quamrul', 'Rakib', 'Sohel', 'Tofael', 'Uzzal', 'Wahid', 'Yasin', 'Zahid', 'Fahim', 'Galib'];
const LAST = ['Islam', 'Ahmed', 'Rahman', 'Hossain', 'Chowdhury', 'Karim', 'Miah', 'Sarkar', 'Khan', 'Molla', 'Sheikh', 'Talukder'];

const GROCERIES = [
  ['1 kg miniket rice', 80], ['5 kg miniket rice', 380], ['1 litre soyabean oil', 200],
  ['1 kg rui fish', 400], ['1 kg hilsa fish', 1200], ['1 kg broiler chicken', 220],
  ['1 kg beef', 780], ['1 kg potato', 45], ['1 kg onion', 100], ['1 kg lentil (masoor)', 140],
  ['500 g green chilli', 60], ['1 kg tomato', 90], ['1 dozen eggs', 145], ['1 kg sugar', 130],
  ['500 g garlic', 110], ['1 kg flour', 65], ['Mixed vegetables', 150], ['Spices and salt', 90]
];

// [type, label for the note, rough monthly amount]
const BILL_TEMPLATES = [
  ['RENT', 'Monthly house rent', 18000, 32000],
  ['ELECTRICITY', 'Electricity bill', 2200, 6500],
  ['WATER', 'Water bill', 600, 1400],
  ['WASTE', 'Waste collection', 200, 500],
  ['CHEF', 'Cook salary', 4000, 8000],
  ['WIFI', 'Broadband', 900, 1600],
  ['OTHER', 'Cleaning supplies and gas', 500, 2500]
];

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

const CHUNK = 400;
async function insertMany(model, rows) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await model.createMany({ data: rows.slice(i, i + CHUNK) });
  }
  return rows.length;
}

const utcDay = (y, m, d) => new Date(Date.UTC(y, m, d));
const at = (date, hour, minute) => new Date(date.getTime() + hour * 3600000 + minute * 60000);

/** Even split with the leftover paisa handed to the first members — mirrors src/lib/bills.ts. */
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

async function wipe() {
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
  await prisma.siteSettings.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const today = now.getUTCDate();
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  console.log('Clearing existing data...');
  await wipe();

  // ---------------------------------------------------------------- users
  const nameFor = (i) => `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;
  const phoneFor = (i) => `+8801${String(300000000 + i * 1234567).slice(0, 9)}`;

  // Every account's password is its own email address. Build the list first,
  // then hash them all — scrypt is intentionally slow, so this is the slow step.
  const accounts = [{ email: 'admin@gmail.com', role: 'ADMIN', status: 'APPROVED', nameIndex: 0 }];
  for (let i = 1; i <= SUPERVISORS; i += 1) {
    accounts.push({ email: `supervisor-${i}@gmail.com`, role: 'SUPERVISOR', status: 'APPROVED', nameIndex: i + 2 });
  }
  for (let i = 1; i <= MEMBERS; i += 1) {
    accounts.push({ email: `member-${i}@gmail.com`, role: 'MEMBER', status: 'APPROVED', nameIndex: i + 11 });
  }
  for (let i = 1; i <= 5; i += 1) {
    accounts.push({ email: `pending-${i}@gmail.com`, role: 'MEMBER', status: 'PENDING', nameIndex: i + 40 });
  }
  for (let i = 1; i <= 3; i += 1) {
    accounts.push({ email: `rejected-${i}@gmail.com`, role: 'MEMBER', status: 'REJECTED', nameIndex: i + 50 });
  }

  console.log(`Hashing ${accounts.length} passwords with scrypt (this takes a few seconds)...`);
  const hashes = await hashAll(accounts.map((a) => a.email));

  const users = accounts.map((account, index) => ({
    id: uuid(),
    name: account.email === 'admin@gmail.com' ? 'Admin User' : nameFor(account.nameIndex),
    email: account.email,
    password: hashes[index],
    phone: phoneFor(index + 1),
    role: account.role,
    status: account.status,
    publishedAt: account.status === 'APPROVED' ? now : null,
    unpublishedAt: account.status === 'REJECTED' ? now : null
  }));

  const admin = users[0];
  const supervisors = users.filter((u) => u.role === 'SUPERVISOR');
  const members = users.filter((u) => u.role === 'MEMBER' && u.status === 'APPROVED');
  const pendingUsers = users.filter((u) => u.status === 'PENDING');

  for (const user of users) {
    if (user.role === 'SUPERVISOR') user.createdById = admin.id;
    if (user.status === 'REJECTED') user.updatedById = admin.id;
  }

  await insertMany(prisma.user, users);
  console.log(`users               : ${users.length}  (1 admin, ${SUPERVISORS} supervisors, ${MEMBERS} members, 5 pending, 3 rejected)`);

  // --------------------------------------------------------------- groups
  const groups = [];
  for (let i = 1; i <= GROUPS; i += 1) {
    const supervisor = supervisors[(i - 1) % SUPERVISORS];
    groups.push({
      id: uuid(),
      name: `Mess ${i} — ${pick(['Dhanmondi', 'Mirpur', 'Uttara', 'Banani', 'Mohakhali', 'Bashundhara', 'Farmgate', 'Motijheel'])}`,
      supervisorId: supervisor.id,
      status: i > GROUPS - 2 ? 'INACTIVE' : 'ACTIVE',
      mealWeightBreakfast: pick([0.5, 0.5, 1]),
      mealWeightLunch: 1,
      mealWeightDinner: pick([1, 1, 1.5]),
      createdById: supervisor.id,
      publishedAt: now
    });
  }
  await insertMany(prisma.group, groups);
  console.log(`groups              : ${groups.length}  (${GROUPS - 2} active, 2 inactive, max ${Math.ceil(GROUPS / SUPERVISORS)} per supervisor)`);

  // ---------------------------------------------------- memberships / roster
  const memberships = [];
  const rosterOf = new Map(); // groupId -> [users] (members + supervisor)

  // Each member is dealt to exactly one group: the app enforces one active
  // membership per member, and seed data must obey the same rule.
  let nextMember = 0;
  groups.forEach((group) => {
    const roster = [];
    for (let k = 0; k < MEMBERS_PER_GROUP; k += 1) {
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

    // The supervisor eats too, so they get a membership and a meal column.
    // Supervisors are exempt from the one-group rule for exactly this reason.
    const supervisor = users.find((u) => u.id === group.supervisorId);
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

  // A few people who joined and later left, so the members page has history.
  const unassigned = members.slice(nextMember);
  unassigned.slice(0, 4).forEach((member, i) => {
    const group = groups[i % groups.length];
    memberships.push({
      id: uuid(),
      userId: member.id,
      groupId: group.id,
      joinedAt: utcDay(year, month - 3 < 0 ? 0 : month - 3, 1),
      leftAt: utcDay(year, month, Math.max(1, Math.min(today, daysInMonth) - 5)),
      isActive: false,
      createdById: group.supervisorId,
      publishedAt: now
    });
  });

  await insertMany(prisma.membership, memberships);
  console.log(`memberships         : ${memberships.length}  (${MEMBERS_PER_GROUP} members + supervisor per group, 4 who left)`);

  // ---------------------------------------------------------- invitations
  // Only people with no active membership can be invited — anyone else could
  // not accept anyway.
  const freeMembers = unassigned.slice(4);
  const invitations = [];

  groups.forEach((group, gi) => {
    const roster = rosterOf.get(group.id);

    for (let k = 0; k < 2 && freeMembers.length > 0; k += 1) {
      invitations.push({
        id: uuid(),
        groupId: group.id,
        inviteeId: freeMembers[(gi * 2 + k) % freeMembers.length].id,
        invitedById: group.supervisorId,
        status: 'PENDING',
        createdAt: at(utcDay(year, month, Math.max(1, today - 2)), 10, k * 7),
        createdById: group.supervisorId,
        publishedAt: now
      });
    }

    // One already accepted (that is how roster[0] got in) and one turned down.
    invitations.push({
      id: uuid(),
      groupId: group.id,
      inviteeId: roster[0].id,
      invitedById: group.supervisorId,
      status: 'ACCEPTED',
      respondedAt: at(utcDay(year, month, 1), 12, 0),
      createdAt: at(utcDay(year, month, 1), 9, 0),
      createdById: group.supervisorId,
      publishedAt: now
    });

    if (freeMembers.length > 0) {
      invitations.push({
        id: uuid(),
        groupId: group.id,
        inviteeId: freeMembers[(gi * 5 + 2) % freeMembers.length].id,
        invitedById: group.supervisorId,
        status: 'REJECTED',
        respondedAt: at(utcDay(year, month, 2), 18, 30),
        createdAt: at(utcDay(year, month, 2), 8, 0),
        createdById: group.supervisorId,
        publishedAt: now
      });
    }

    // A supervisor also invites one of the accounts still awaiting approval.
    invitations.push({
      id: uuid(),
      groupId: group.id,
      inviteeId: pendingUsers[gi % pendingUsers.length].id,
      invitedById: group.supervisorId,
      status: 'PENDING',
      createdAt: at(utcDay(year, month, Math.max(1, today - 1)), 11, 0),
      createdById: group.supervisorId,
      publishedAt: now
    });
  });

  // Drop duplicate (group, invitee) pairs the round-robin may have produced.
  const seenInvites = new Set();
  const uniqueInvitations = invitations.filter((inv) => {
    const key = `${inv.groupId}:${inv.inviteeId}`;
    if (seenInvites.has(key)) return false;
    seenInvites.add(key);
    return true;
  });

  await insertMany(prisma.invitation, uniqueInvitations);
  console.log(`invitations         : ${uniqueInvitations.length}  (pending / accepted / rejected)`);

  // ------------------------------------------------------------ group order
  const orders = [];
  supervisors.forEach((s) => {
    const mine = groups.filter((g) => g.supervisorId === s.id);
    mine.forEach((g, i) => orders.push({ id: uuid(), userId: s.id, groupId: g.id, position: i, createdById: s.id }));
  });
  await insertMany(prisma.groupOrder, orders);
  console.log(`group orders        : ${orders.length}`);

  // ------------------------------------------------- bazar + items + history
  const expenses = [];
  const items = [];
  const history = [];
  const expenseComments = [];

  groups.forEach((group) => {
    const roster = rosterOf.get(group.id);
    const shoppingDays = [];
    for (let d = 1; d <= Math.min(today, daysInMonth); d += 1) {
      if (d % 3 === 1) shoppingDays.push(d);
    }

    shoppingDays.forEach((day) => {
      const payer = pick(roster);
      const date = utcDay(year, month, day);
      const expenseId = uuid();

      const lineCount = int(2, 4);
      const chosen = [];
      let total = 0;
      for (let i = 0; i < lineCount; i += 1) {
        const [name, base] = GROCERIES[int(0, GROCERIES.length - 1)];
        const amount = round2(base * (0.9 + rnd() * 0.3));
        chosen.push({ name, amount });
        total = round2(total + amount);
      }

      const note = pick(['Weekly bazar', 'Kacha bazar', 'Fish and vegetables', 'Grocery top-up', '']);

      expenses.push({
        id: expenseId,
        groupId: group.id,
        type: 'BAZAR',
        amount: total,
        date,
        payerId: payer.id,
        isReceived: true,
        splitMethod: 'MEAL',
        note,
        createdAt: at(date, 9, int(0, 59)),
        createdById: payer.id,
        updatedById: payer.id,
        publishedAt: now
      });

      chosen.forEach((c, i) =>
        items.push({
          id: uuid(),
          expenseId,
          name: c.name,
          amount: c.amount,
          sortOrder: i,
          createdById: payer.id
        })
      );

      history.push({
        id: uuid(),
        expenseId,
        groupId: group.id,
        actorId: payer.id,
        action: 'CREATED',
        expenseDate: date,
        amountTo: total,
        dateTo: date,
        noteTo: note,
        createdAt: at(date, 9, int(0, 59)),
        createdById: payer.id
      });

      // Some purchases get corrected later — that is what Change history is for.
      if (chance(0.3)) {
        const bumped = round2(total * (1 + rnd() * 0.2));
        history.push({
          id: uuid(),
          expenseId,
          groupId: group.id,
          actorId: payer.id,
          action: 'UPDATED',
          expenseDate: date,
          amountFrom: total,
          amountTo: bumped,
          createdAt: at(date, 20, int(0, 59)),
          createdById: payer.id
        });
        const target = expenses.find((e) => e.id === expenseId);
        target.amount = bumped;
        // Keep the line items adding up to the stored total.
        const diff = round2(bumped - total);
        items[items.length - 1].amount = round2(items[items.length - 1].amount + diff);
      }

      const commentCount = int(0, 3);
      for (let c = 0; c < commentCount; c += 1) {
        const author = pick(roster);
        expenseComments.push({
          id: uuid(),
          expenseId,
          groupId: group.id,
          userId: author.id,
          text: pick(EXPENSE_COMMENT_TEXTS),
          createdAt: at(date, 12 + c, int(0, 59)),
          createdById: author.id
        });
      }
    });

    // One deleted purchase per group, so the history shows a DELETED row too.
    const deletedDate = utcDay(year, month, Math.max(1, Math.min(today, daysInMonth) - 1));
    const ghostPayer = pick(roster);
    history.push({
      id: uuid(),
      expenseId: uuid(),
      groupId: group.id,
      actorId: ghostPayer.id,
      action: 'DELETED',
      expenseDate: deletedDate,
      amountFrom: round2(120 + rnd() * 400),
      dateFrom: deletedDate,
      noteFrom: 'Duplicate entry',
      createdAt: at(deletedDate, 21, 30),
      createdById: ghostPayer.id
    });
  });

  // ------------------------------------------------------ bills + shares
  // Rent, utilities, chef, wifi and other costs — split across the roster and
  // stored as ExpenseShare rows, exactly as the app writes them.
  const bills = [];
  const shares = [];

  groups.forEach((group) => {
    const roster = rosterOf.get(group.id);
    const rosterIds = roster.map((r) => r.id);

    BILL_TEMPLATES.forEach(([type, label, low, high], index) => {
      // Bills land early in the month; skip any that fall after "today".
      const day = Math.min(1 + index * 2, Math.min(today, daysInMonth));
      const date = utcDay(year, month, day);
      const amount = round2(low + rnd() * (high - low));
      const billId = uuid();

      // Most bills are shared by everyone; the odd one is assigned to a few
      // people (a room-specific extra, say), which is the CUSTOM path.
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
        splitMethod: custom ? 'CUSTOM' : 'EQUAL',
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
        action: 'CREATED',
        expenseDate: date,
        amountTo: amount,
        dateTo: date,
        noteTo: label,
        createdAt: at(date, 10, int(0, 59)),
        createdById: group.supervisorId
      });
    });
  });

  await insertMany(prisma.expenseEntry, [...expenses, ...bills]);
  await insertMany(prisma.expenseItem, items);
  await insertMany(prisma.expenseShare, shares);
  await insertMany(prisma.expenseHistory, history);
  await insertMany(prisma.expenseComment, expenseComments);
  console.log(`bazar entries       : ${expenses.length}  (${items.length} product lines)`);
  console.log(`bills               : ${bills.length}  (${shares.length} member shares, rent/utilities/chef/wifi/other)`);
  console.log(`expense history     : ${history.length}  (created / updated / deleted)`);
  console.log(`expense comments    : ${expenseComments.length}`);

  // ----------------------------------------------------------------- meals
  const mealEntries = [];
  const mealPlans = [];
  const mealPlanDays = [];

  groups.forEach((group) => {
    const roster = rosterOf.get(group.id);

    roster.forEach((person) => {
      for (let d = 1; d <= Math.min(today, daysInMonth); d += 1) {
        if (chance(0.12)) continue; // away that day
        const breakfast = chance(0.55) ? 1 : 0;
        const lunch = chance(0.8) ? 1 : 0;
        const dinner = chance(0.85) ? (chance(0.1) ? 2 : 1) : 0;
        const totalMeals = breakfast + lunch + dinner;
        if (totalMeals === 0) continue;

        mealEntries.push({
          id: uuid(),
          userId: person.id,
          groupId: group.id,
          date: utcDay(year, month, d),
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

      // Roughly half the roster runs a repeating weekly plan.
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
          const off = weekday === 5 && chance(0.5); // some people skip Friday
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
  console.log(`meal entries        : ${mealEntries.length}  (day 1 to ${today})`);
  console.log(`meal plans          : ${mealPlans.length}  (${mealPlanDays.length} weekday rows)`);

  // -------------------------------------------------------------- payments
  const payments = [];
  groups.forEach((group) => {
    const roster = rosterOf.get(group.id);
    roster.forEach((person) => {
      const count = int(0, 2);
      for (let i = 0; i < count; i += 1) {
        const amount = round2(int(500, 3000));
        const paid = chance(0.7) ? amount : round2(amount * (0.3 + rnd() * 0.4));
        const day = int(1, Math.min(today, daysInMonth));
        payments.push({
          id: uuid(),
          userId: person.id,
          groupId: group.id,
          amountDue: amount,
          amountPaid: paid,
          status: paid >= amount ? 'PAID' : paid > 0 ? 'PARTIAL' : 'PENDING',
          dueDate: utcDay(year, month, day),
          createdById: group.supervisorId,
          updatedById: group.supervisorId,
          publishedAt: now
        });
      }
    });
  });
  await insertMany(prisma.paymentStatus, payments);
  console.log(`payments            : ${payments.length}  (paid / partial / pending)`);

  // -------------------------------------------------------------- comments
  const comments = [];
  const replies = [];

  groups.forEach((group) => {
    const roster = rosterOf.get(group.id);

    for (let c = 0; c < int(3, 5); c += 1) {
      const author = pick(roster);
      const commentId = uuid();
      const day = int(1, Math.min(today, daysInMonth));
      const createdAt = at(utcDay(year, month, day), int(9, 21), int(0, 59));

      // Mentions are stored by user id, so they follow a rename.
      const mentioned = pick(roster.filter((r) => r.id !== author.id));
      const text = chance(0.4) ? `@[u:${mentioned.id}] ${pick(COMMENT_TEXTS)}` : pick(COMMENT_TEXTS);

      comments.push({
        id: commentId,
        userId: author.id,
        groupId: group.id,
        text,
        createdAt,
        createdById: author.id,
        publishedAt: now,
        deletedAt: chance(0.08) ? at(createdAt, 2, 0) : null
      });

      for (let r = 0; r < int(0, 3); r += 1) {
        const replier = pick(roster);
        const mention = pick(roster.filter((x) => x.id !== replier.id));
        replies.push({
          id: uuid(),
          commentId,
          userId: replier.id,
          text: chance(0.5) ? `@[u:${mention.id}] ${pick(REPLY_TEXTS)}` : pick(REPLY_TEXTS),
          createdAt: at(createdAt, 1 + r, int(0, 59)),
          createdById: replier.id,
          publishedAt: now
        });
      }
    }
  });

  await insertMany(prisma.comment, comments);
  await insertMany(prisma.commentReply, replies);
  console.log(`comments            : ${comments.length}  (${replies.length} replies, with @mentions)`);

  // ---------------------------------------------------- settings + subscribers
  await prisma.siteSettings.create({
    data: {
      id: 'singleton',
      companyName: 'Bachelor Point',
      tagline: 'Manage your mess without the arguments.',
      address: 'Dhaka 1207, Bangladesh',
      contactEmail: 'hello@bachelorpoint.local',
      contactPhone: '+8801616002313',
      copyrightOwner: 'Bachelor Point',
      facebookUrl: 'https://facebook.com/bachelorpoint',
      newsletterEnabled: true,
      createdById: admin.id,
      updatedById: admin.id
    }
  });

  const subscribers = [];
  for (let i = 1; i <= 12; i += 1) {
    subscribers.push({ id: uuid(), email: `subscriber-${i}@gmail.com` });
  }
  await insertMany(prisma.subscriber, subscribers);
  console.log(`site settings       : 1`);
  console.log(`subscribers         : ${subscribers.length}`);

  console.log('');
  console.log('Sign in with (password is always the same as the email):');
  console.log('  admin@gmail.com        / admin@gmail.com');
  console.log(`  supervisor-1@gmail.com / supervisor-1@gmail.com   ... up to supervisor-${SUPERVISORS}`);
  console.log(`  member-1@gmail.com     / member-1@gmail.com       ... up to member-${MEMBERS}`);
  console.log('  pending-1@gmail.com    (awaiting admin approval — cannot sign in yet)');
  console.log('  rejected-1@gmail.com   (rejected — cannot sign in)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
