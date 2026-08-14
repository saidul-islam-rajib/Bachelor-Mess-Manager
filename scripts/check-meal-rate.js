require('dotenv').config();

const crypto = require('crypto');
const { promisify } = require('util');
const { PrismaClient } = require('@prisma/client');
const { report, reportError, reportFailure } = require('./reporter');
const { emitSummary } = require('./test-result');

const prisma = new PrismaClient();
const scrypt = promisify(crypto.scrypt);
const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';

const APP_TIME_ZONE = process.env.APP_TIME_ZONE || 'Asia/Dhaka';
const zonedDayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: APP_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
});
function zonedDayKey(instant = new Date()) {
  const parts = zonedDayFormatter.formatToParts(instant);
  const value = (type) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}
function shiftDayKey(dayKey, days) {
  return new Date(new Date(`${dayKey}T00:00:00.000Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

const tag = crypto.randomBytes(4).toString('hex');
const password = 'RateCheck!9xZ';
const created = { userIds: [], groupIds: [] };

let failures = 0;
let total = 0;
function check(name, passed, detail) {
  total += 1;
  if (!passed) failures += 1;
  report(`  ${passed ? 'PASS' : 'FAIL'}  ${name}${passed || !detail ? '' : `  (${detail})`}`);
}
const near = (a, b, t = 0.011) => Math.abs(a - b) <= t;

async function hashPassword(value) {
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(value.normalize('NFKC'), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 256 * 16384 * 8 });
  return ['scrypt', 16384, 8, 1, salt.toString('base64'), derived.toString('base64')].join('$');
}

function makeSession() {
  const jar = new Map();
  return {
    async request(method, path, body) {
      const res = await fetch(`${BASE}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(jar.size ? { Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {})
        },
        body: body === undefined ? undefined : JSON.stringify(body)
      });
      for (const cookie of res.headers.getSetCookie ? res.headers.getSetCookie() : []) {
        const [pair] = cookie.split(';');
        const i = pair.indexOf('=');
        jar.set(pair.slice(0, i).trim(), pair.slice(i + 1).trim());
      }
      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }
      return { status: res.status, body: json, text };
    }
  };
}

async function makeUser(session, label, role) {
  const email = `rate-${tag}-${label}@example.com`;
  await session.request('POST', '/api/auth/register', {
    name: `Rate ${label}`,
    email,
    password,
    confirmPassword: password
  });
  const user = await prisma.user.findUnique({ where: { email } });
  created.userIds.push(user.id);
  await prisma.user.update({
    where: { email },
    data: { password: await hashPassword(password), status: 'APPROVED', role }
  });
  await session.request('POST', '/api/auth/login', { email, password });
  return { email, id: user.id };
}

async function run() {
  const anchor = new Date();
  if (anchor.getUTCDate() < 5) anchor.setUTCDate(0);
  const month = anchor.toISOString().slice(0, 7);
  const day = (n) => `${month}-${String(n).padStart(2, '0')}`;

  const sup = makeSession();
  const a = makeSession();
  const b = makeSession();

  const supervisor = await makeUser(sup, 'sup', 'SUPERVISOR');
  const memberA = await makeUser(a, 'a', 'MEMBER');
  const memberB = await makeUser(b, 'b', 'MEMBER');

  const group = await sup.request('POST', '/api/groups', { name: `Rate check ${tag}` });
  const groupId = group.body.group.id;
  created.groupIds.push(groupId);

  for (const m of [memberA, memberB]) {
    await sup.request('POST', `/api/groups/${groupId}/invitations`, { email: m.email });
  }
  for (const s of [a, b]) {
    const list = await s.request('GET', '/api/invitations');
    await s.request('PATCH', `/api/invitations/${list.body.invitations[0].id}`, { status: 'ACCEPTED' });
  }

  await sup.request('PATCH', `/api/groups/${groupId}`, {
    mealRateMode: 'DAILY',
    mealWeightBreakfast: 1,
    mealWeightLunch: 1,
    mealWeightDinner: 1
  });

  report('');
  report('Scenario: 1040 bazar on day 1 only, meals spread over days 1-5');
  report('  (this is the shape from the reported screenshot)');

  await prisma.expenseEntry.create({
    data: {
      groupId,
      type: 'BAZAR',
      amount: 1040,
      date: new Date(`${day(1)}T00:00:00.000Z`),
      payerId: supervisor.id,
      splitMethod: 'MEAL',
      isReceived: true,
      publishedAt: new Date()
    }
  });

  const plan = [
    { date: day(1), rows: [[supervisor.id, 2], [memberA.id, 2], [memberB.id, 1]] },
    { date: day(2), rows: [[supervisor.id, 1], [memberA.id, 1], [memberB.id, 1]] },
    { date: day(3), rows: [[memberA.id, 1], [memberB.id, 1]] },
    { date: day(4), rows: [[supervisor.id, 1], [memberA.id, 1], [memberB.id, 1]] },
    { date: day(5), rows: [[memberA.id, 1], [memberB.id, 1]] }
  ];

  for (const entry of plan) {
    for (const [userId, meals] of entry.rows) {
      await prisma.mealEntry.create({
        data: {
          userId,
          groupId,
          date: new Date(`${entry.date}T00:00:00.000Z`),
          breakfastCount: 0,
          lunchCount: meals,
          dinnerCount: 0,
          totalMeals: meals,
          publishedAt: new Date()
        }
      });
    }
  }

  const res = await sup.request('GET', `/api/groups/${groupId}/payments?month=${month}`);
  const data = res.body;
  const members = data.members;

  report('');
  report(`  total bazar   ${data.totals.bazar}`);
  report(`  total meals   ${data.totals.meals}`);
  report(`  average rate  ${data.totals.mealRate}  (mean of ${data.totals.pricedDays} daily rates)`);
  report(`  ratio rate    ${data.totals.ratioRate}  (bazar / meals, for comparison)`);
  report(`  rate mode     requested=${data.rateMode} effective=${data.effectiveRateMode}`);
  report('');

  check('total meals counted correctly', near(data.totals.meals, 15), `got ${data.totals.meals}`);
  check(
    'day-by-day pricing stays in force, no fallback',
    data.effectiveRateMode === 'DAILY' && data.rateModeFallbackReason === null,
    `${data.effectiveRateMode}/${data.rateModeFallbackReason}`
  );
  check('the one shop is spread over the 5 days that ate', data.totals.pricedDays === 5, String(data.totals.pricedDays));
  check(
    'headline rate is the average of the daily rates, not bazar / meals',
    near(data.totals.mealRate, 77.65) && near(data.totals.ratioRate, 69.33),
    `average ${data.totals.mealRate}, ratio ${data.totals.ratioRate}`
  );

  const allocated = members.reduce((acc, m) => acc + m.mealCost, 0);
  check('every taka of bazar is charged to somebody', near(allocated, 1040), `allocated ${allocated.toFixed(2)}`);

  for (const m of members) {
    check(`${m.name} charged > 0 for their meals`, m.mealCost > 0, `mealCost ${m.mealCost}`);
  }

  const byId = Object.fromEntries(members.map((m) => [m.id, m]));
  check('supervisor ate 4 meals', near(byId[supervisor.id].meals, 4), String(byId[supervisor.id].meals));
  check('member A ate 6 meals', near(byId[memberA.id].meals, 6), String(byId[memberA.id].meals));
  check('member B ate 5 meals', near(byId[memberB.id].meals, 5), String(byId[memberB.id].meals));

  check(
    'cost is proportional to meals eaten (A pays more than B)',
    byId[memberA.id].mealCost > byId[memberB.id].mealCost,
    `A ${byId[memberA.id].mealCost} vs B ${byId[memberB.id].mealCost}`
  );
  check(
    'member A is charged the sum of their day shares, not average x meals',
    near(byId[memberA.id].mealCost, 429.86, 0.02),
    `${byId[memberA.id].mealCost}`
  );
  check(
    'charging average x meals would not have added up',
    Math.abs(members.reduce((acc, m) => acc + m.meals * data.totals.mealRate, 0) - 1040) > 1,
    'the two methods happen to agree here, so this case no longer proves anything'
  );

  check('grocery buyer credited the full 1040', near(byId[supervisor.id].bazarPaid, 1040), String(byId[supervisor.id].bazarPaid));

  report('');
  report('  Day table:');
  let dayCostSum = 0;
  for (const d of data.days) {
    dayCostSum += d.cost;
    report(`    ${d.date}  meals ${String(d.meals).padStart(4)}  bazar ${String(d.bazar).padStart(8)}  used ${String(d.charged).padStart(8)}  rate ${String(d.rate).padStart(7)}  charged ${String(d.cost).padStart(8)}`);
  }
  check('day charges add back to total bazar', near(dayCostSum, 1040, 0.05), `sum ${dayCostSum.toFixed(2)}`);
  check('no day with meals shows a zero rate', data.days.every((d) => d.meals === 0 || d.rate > 0));

  const eatenDays = data.days.filter((d) => d.meals > 0);
  check(
    'daily rates genuinely vary, they are not one flat number',
    new Set(eatenDays.map((d) => d.rate)).size > 1,
    JSON.stringify(eatenDays.map((d) => d.rate))
  );
  check(
    'a quiet day costs more per meal than a busy one',
    eatenDays.find((d) => near(d.meals, 2))?.rate > eatenDays.find((d) => near(d.meals, 5))?.rate,
    JSON.stringify(eatenDays.map((d) => `${d.meals}m=${d.rate}`))
  );
  check(
    'the average equals the mean of the day rates shown',
    near(data.totals.mealRate, eatenDays.reduce((a, d) => a + d.rate, 0) / eatenDays.length, 0.02),
    `${data.totals.mealRate}`
  );

  report('');
  report('Adding bills to check the member-wise cost split');

  await sup.request('POST', `/api/groups/${groupId}/bills`, {
    type: 'RENT',
    amount: 3000,
    date: day(1),
    splitMethod: 'EQUAL'
  });
  await sup.request('POST', `/api/groups/${groupId}/bills`, {
    type: 'ELECTRICITY',
    amount: 900,
    date: day(2),
    splitMethod: 'EQUAL'
  });

  const after = (await sup.request('GET', `/api/groups/${groupId}/payments?month=${month}`)).body;

  check('rent appears per member', after.members.every((m) => near(m.billShareByType.RENT ?? 0, 1000)), JSON.stringify(after.members.map((m) => m.billShareByType.RENT)));
  check('electricity appears per member', after.members.every((m) => near(m.billShareByType.ELECTRICITY ?? 0, 300)), JSON.stringify(after.members.map((m) => m.billShareByType.ELECTRICITY)));

  const rentSum = after.members.reduce((acc, m) => acc + (m.billShareByType.RENT ?? 0), 0);
  check('per-member rent sums to the rent bill', near(rentSum, 3000), `sum ${rentSum}`);

  const perTypeSum = after.members.reduce(
    (acc, m) => acc + Object.values(m.billShareByType).reduce((x, y) => x + y, 0),
    0
  );
  check('per-type shares sum to all bills', near(perTypeSum, after.totals.bills), `${perTypeSum} vs ${after.totals.bills}`);

  for (const m of after.members) {
    const typeSum = Object.values(m.billShareByType).reduce((x, y) => x + y, 0);
    check(`${m.name} type breakdown matches their bill share`, near(typeSum, m.billShare), `${typeSum} vs ${m.billShare}`);
  }

  check('category labels supplied for the UI', Boolean(after.categoryLabels && after.categoryLabels.RENT), JSON.stringify(after.categoryLabels || {}).slice(0, 80));

  await futureMealsScenario(sup, supervisor);
}

async function futureMealsScenario(sup, supervisor) {
  const today = zonedDayKey();
  const month = today.slice(0, 7);
  const tomorrow = shiftDayKey(today, 1);

  report('');
  report('Scenario: 300 bazar today, 3 meals today, 3 more already planned for tomorrow');

  if (tomorrow.slice(0, 7) !== month) {
    report('  skipped — today is the last day of the month, there is no future day to test with');
    return;
  }

  const group = await sup.request('POST', '/api/groups', { name: `Future check ${tag}` });
  const groupId = group.body.group.id;
  created.groupIds.push(groupId);

  await sup.request('PATCH', `/api/groups/${groupId}`, {
    mealRateMode: 'MONTHLY',
    mealWeightBreakfast: 1,
    mealWeightLunch: 1,
    mealWeightDinner: 1
  });

  await prisma.expenseEntry.create({
    data: {
      groupId,
      type: 'BAZAR',
      amount: 300,
      date: new Date(`${today}T00:00:00.000Z`),
      payerId: supervisor.id,
      splitMethod: 'MEAL',
      isReceived: true,
      publishedAt: new Date()
    }
  });

  for (const date of [today, tomorrow]) {
    await prisma.mealEntry.create({
      data: {
        userId: supervisor.id,
        groupId,
        date: new Date(`${date}T00:00:00.000Z`),
        breakfastCount: 0,
        lunchCount: 3,
        dinnerCount: 0,
        totalMeals: 3,
        publishedAt: new Date()
      }
    });
  }

  const data = (await sup.request('GET', `/api/groups/${groupId}/payments?month=${month}`)).body;

  report('');
  report(`  total meals   ${data.totals.meals}`);
  report(`  month rate    ${data.totals.mealRate}`);
  report(`  through       ${data.through}`);
  report('');

  check('the window stops at today', data.through === today, `through ${data.through}`);
  check("tomorrow's planned meals stay out of the count", near(data.totals.meals, 3), `got ${data.totals.meals}`);
  check('rate is 300 / 3, not 300 / 6', near(data.totals.mealRate, 100), `got ${data.totals.mealRate}`);
  check(
    'no day after today is priced',
    (data.days ?? []).every((d) => d.date <= today),
    JSON.stringify((data.days ?? []).map((d) => d.date))
  );
}

async function cleanup() {
  for (const groupId of created.groupIds) {
    await prisma.closingLine.deleteMany({ where: { closing: { groupId } } });
    await prisma.monthClosing.deleteMany({ where: { groupId } });
    await prisma.notification.deleteMany({ where: { groupId } });
    await prisma.expenseCategory.deleteMany({ where: { groupId } });
    await prisma.expenseShare.deleteMany({ where: { expense: { groupId } } });
    await prisma.expenseItem.deleteMany({ where: { expense: { groupId } } });
    await prisma.expenseHistory.deleteMany({ where: { groupId } });
    await prisma.expenseEntry.deleteMany({ where: { groupId } });
    await prisma.mealEntry.deleteMany({ where: { groupId } });
    await prisma.mealPlanDay.deleteMany({ where: { plan: { groupId } } });
    await prisma.mealPlan.deleteMany({ where: { groupId } });
    await prisma.invitation.deleteMany({ where: { groupId } });
    await prisma.groupOrder.deleteMany({ where: { groupId } });
    await prisma.membership.deleteMany({ where: { groupId } });
    await prisma.group.deleteMany({ where: { id: groupId } });
  }
  for (const userId of created.userIds) {
    await prisma.notification.deleteMany({ where: { OR: [{ userId }, { actorId: userId }] } });
    await prisma.passwordToken.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { id: userId } });
  }
  await prisma.loginAttempt.deleteMany({ where: { email: { contains: `rate-${tag}` } } });
}

run()
  .catch((error) => {
    failures += 1;
    reportError('Scenario aborted.');
    reportFailure(error);
  })
  .finally(async () => {
    emitSummary('meal-rate', { total, passed: total - failures, failed: failures });
    if (failures > 0) process.exitCode = 1;
    await cleanup();
    await prisma.$disconnect();
  });
