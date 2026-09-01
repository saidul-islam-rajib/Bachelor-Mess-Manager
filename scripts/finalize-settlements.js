const BASE_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/+$/, '');
const SECRET = process.env.SETTLEMENT_DISPATCH_SECRET || '';

async function main() {
  if (!SECRET) {
    console.error('SETTLEMENT_DISPATCH_SECRET is not set. Add it to the environment before running this job.');
    process.exitCode = 1;
    return;
  }

  const response = await fetch(`${BASE_URL}/api/cron/finalize-settlements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-dispatch-secret': SECRET }
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error(`finalize failed (${response.status}): ${payload.error || 'unknown error'}`);
    process.exitCode = 1;
    return;
  }

  console.log(`checked  : ${payload.checked}`);
  console.log(`finalized: ${payload.finalized}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
