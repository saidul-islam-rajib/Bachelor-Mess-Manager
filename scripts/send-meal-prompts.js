const BASE_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
const SECRET = process.env.MEAL_PROMPT_DISPATCH_SECRET || '';
const GROUP_ID = process.env.MEAL_PROMPT_GROUP_ID || undefined;
const DATE = process.env.MEAL_PROMPT_DATE || undefined;

async function main() {
  if (!SECRET) {
    console.error('MEAL_PROMPT_DISPATCH_SECRET is not set. Add it to the environment before running this job.');
    process.exitCode = 1;
    return;
  }

  const response = await fetch(`${BASE_URL}/api/meal-prompts/dispatch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-dispatch-secret': SECRET },
    body: JSON.stringify({ groupId: GROUP_ID, date: DATE })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error(`dispatch failed (${response.status}): ${payload.error || 'unknown error'}`);
    process.exitCode = 1;
    return;
  }

  console.log(`date  : ${payload.date}`);
  console.log(`sent  : ${payload.sent}`);
  console.log(payload.message || '');
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
