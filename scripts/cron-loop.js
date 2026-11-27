const { spawn } = require('child_process');
const path = require('path');

const CHECK_INTERVAL_MS = 60_000;

function line(level, event, fields) {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, event, src: 'cron', ...fields }));
}

const JOBS = [
  {
    name: 'bazar-duty-reminder',
    script: 'scripts/send-bazar-reminders.js',
    everyMinutes: 5,
    lastRun: 0
  }
];

function runJob(job) {
  line('info', 'cron.run', { job: job.name });
  const child = spawn(process.execPath, [path.join(process.cwd(), job.script)], {
    stdio: 'inherit',
    env: process.env
  });
  child.on('exit', (code) => {
    if (code !== 0) {
      line('error', 'cron.fail', { job: job.name, code });
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

line('info', 'cron.start', { intervalSeconds: CHECK_INTERVAL_MS / 1000 });
tick();
setInterval(tick, CHECK_INTERVAL_MS);
