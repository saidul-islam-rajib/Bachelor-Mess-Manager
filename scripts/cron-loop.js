const { spawn } = require('child_process');
const path = require('path');

const CHECK_INTERVAL_MS = 60_000;

const JOBS = [
  {
    name: 'bazar-duty-reminder',
    script: 'scripts/send-bazar-reminders.js',
    everyMinutes: 5,
    lastRun: 0
  }
];

function runJob(job) {
  console.log(`[cron-loop] ${new Date().toISOString()} running ${job.name}`);
  const child = spawn(process.execPath, [path.join(process.cwd(), job.script)], {
    stdio: 'inherit',
    env: process.env
  });
  child.on('exit', (code) => {
    if (code !== 0) {
      console.error(`[cron-loop] ${job.name} exited with code ${code}`);
    }
  });
}

function tick() {
  const now = Date.now();
  for (const job of JOBS) {
    if (now - job.lastRun >= job.everyMinutes * 60_000) {
      job.lastRun = now;
      runJob(job);
    }
  }
}

console.log('[cron-loop] started, checking jobs every', CHECK_INTERVAL_MS / 1000, 'seconds');
tick();
setInterval(tick, CHECK_INTERVAL_MS);
