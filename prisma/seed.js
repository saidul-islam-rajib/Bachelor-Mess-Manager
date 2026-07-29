require('dotenv').config();
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const ADMINS = 1;
const SUPERVISORS = 10;
const MEMBERS = 100;
const GROUPS = 20;
const MEMBERS_PER_GROUP = 10;

const hashPassword = (password) => crypto.createHash('sha256').update(password).digest('hex');
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

async function wipe() {
  await prisma.mealPlanDay.deleteMany();
  await prisma.mealPlan.deleteMany();
  await prisma.mealEntry.deleteMany();
  await prisma.expenseComment.deleteMany();
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
  const users = [];
  const nameFor = (i) => `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]}`;
  const phoneFor = (i) => `+8801${String(300000000 + i * 1234567).slice(0, 9)}`;

  const admin = {
    id: uuid(),
    name: 'Admin User',
    email: 'admin@gmail.com',
    password: hashPassword('admin@gmail.com'),
    phone: '+8801700000000',
    role: 'ADMIN',
    status: 'APPROVED',
    publishedAt: now
  };
  users.push(admin);

  const supervisors = [];
  for (let i = 1; i <= SUPERVISORS; i += 1) {
    const email = `supervisor-${i}@gmail.com`;
    const s = {
      id: uuid(),
      name: nameFor(i + 2),
      email,
      password: hashPassword(email),
      phone: phoneFor(i),
      role: 'SUPERVISOR',
      status: 'APPROVED',
      createdById: admin.id,
      publishedAt: now
    };
    supervisors.push(s);
    users.push(s);
  }

  const members = [];
  for (let i = 1; i <= MEMBERS; i += 1) {
    const email = `member-${i}@gmail.com`;
    const m = {
      id: uuid(),
      name: nameFor(i + 11),
      email,
      password: hashPassword(email),
      phone: phoneFor(i + 20),
      role: 'MEMBER',
      status: 'APPROVED',
      publishedAt: now
    };
    members.push(m);
    users.push(m);
  }

  // Accounts that exercise the approval queue and the rejection path.
  const pendingUsers = [];
  for (let i = 1; i <= 5; i += 1) {
    const email = `pending-${i}@gmail.com`;
    const u = {
      id: uuid(),
      name: nameFor(i + 40),
      email,
      password: hashPassword(email),
      phone: phoneFor(i + 130),
      role: 'MEMBER',
      status: 'PENDING'
    };
    pendingUsers.push(u);
    users.push(u);
  }
  for (let i = 1; i <= 3; i += 1) {
    const email = `rejected-${i}@gmail.com`;
    users.push({
      id: uuid(),
      name: nameFor(i + 50),
      email,
      password: hashPassword(email),
      phone: phoneFor(i + 150),
      role: 'MEMBER',
      status: 'REJECTED',
      updatedById: admin.id,
      unpublishedAt: now
    });
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
  console.log(`groups              : ${groups.length}  (${GROUPS - 2} active, 2 inactive)`);

  // ---------------------------------------------------- memberships / roster
  const memberships = [];
  const rosterOf = new Map(); // groupId -> [users] (members + supervisor)

  groups.forEach((group, gi) => {
    const roster = [];
    for (let k = 0; k < MEMBERS_PER_GROUP; k += 1) {
      const member = members[(gi * MEMBERS_PER_GROUP + k) % MEMBERS];
      roster.push(member);
      memberships.push({
        id: uuid(),
        userId: member.id,
        groupId: group.id,
        joinedAt: utcDay(year, month, 1),
        isActive: true,
        createdById: group.supervisorId
      });
    }

    // The supervisor eats too, so they get a membership and a meal column.
    const supervisor = users.find((u) => u.id === group.supervisorId);
    roster.push(supervisor);
    memberships.push({
      id: uuid(),
      userId: supervisor.id,
      groupId: group.id,
      joinedAt: utcDay(year, month, 1),
      isActive: true,
      createdById: supervisor.id
    });

    rosterOf.set(group.id, roster);
  });

  await insertMany(prisma.membership, memberships);
  console.log(`memberships         : ${memberships.length}  (${MEMBERS_PER_GROUP} members + supervisor per group)`);

  // ---------------------------------------------------------- invitations
  const invitations = [];
  groups.forEach((group, gi) => {
    const roster = rosterOf.get(group.id);
    const outsiders = members.filter((m) => !roster.some((r) => r.id === m.id));

    for (let k = 0; k < 2; k += 1) {
      invitations.push({
        id: uuid(),
        groupId: group.id,
        inviteeId: outsiders[(gi * 3 + k) % outsiders.length].id,
        invitedById: group.supervisorId,
        status: 'PENDING',
        createdAt: at(utcDay(year, month, Math.max(1, today - 2)), 10, k * 7),
        createdById: group.supervisorId
      });
    }

    invitations.push({
      id: uuid(),
      groupId: group.id,
      inviteeId: roster[0].id,
      invitedById: group.supervisorId,
      status: 'ACCEPTED',
      respondedAt: at(utcDay(year, month, 1), 12, 0),
      createdAt: at(utcDay(year, month, 1), 9, 0),
      createdById: group.supervisorId
    });

    invitations.push({
      id: uuid(),
      groupId: group.id,
      inviteeId: outsiders[(gi * 5 + 2) % outsiders.length].id,
      invitedById: group.supervisorId,
      status: 'REJECTED',
      respondedAt: at(utcDay(year, month, 2), 18, 30),
      createdAt: at(utcDay(year, month, 2), 8, 0),
      createdById: group.supervisorId
    });

    // A supervisor also invites one of the accounts still awaiting approval.
    invitations.push({
      id: uuid(),
      groupId: group.id,
      inviteeId: pendingUsers[gi % pendingUsers.length].id,
      invitedById: group.supervisorId,
      status: 'PENDING',
      createdAt: at(utcDay(year, month, Math.max(1, today - 1)), 11, 0),
      createdById: group.supervisorId
    });
  });
  await insertMany(prisma.invitation, invitations);
  console.log(`invitations         : ${invitations.length}  (pending / accepted / rejected)`);

  // ------------------------------------------------------------ group order
  const orders = [];
  supervisors.forEach((s) => {
    const mine = groups.filter((g) => g.supervisorId === s.id);
    mine.forEach((g, i) => orders.push({ id: uuid(), userId: s.id, groupId: g.id, position: i, createdById: s.id }));
  });
  await insertMany(prisma.groupOrder, orders);
  console.log(`group orders        : ${orders.length}`);

  // ------------------------------------------------- expenses + items + history
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

  await insertMany(prisma.expenseEntry, expenses);
  await insertMany(prisma.expenseItem, items);
  await insertMany(prisma.expenseHistory, history);
  await insertMany(prisma.expenseComment, expenseComments);
  console.log(`expenses            : ${expenses.length}  (${items.length} product lines)`);
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
          updatedById: person.id
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
          updatedById: person.id
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
            createdById: person.id
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
          updatedById: group.supervisorId
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
          createdById: replier.id
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
  console.log('  supervisor-1@gmail.com / supervisor-1@gmail.com   ... up to supervisor-10');
  console.log('  member-1@gmail.com     / member-1@gmail.com       ... up to member-100');
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
