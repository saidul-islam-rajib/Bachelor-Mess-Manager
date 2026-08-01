require('dotenv').config();

const net = require('node:net');
const tls = require('node:tls');
const { report, reportError, reportFailure } = require('./reporter');
const { emitSummary } = require('./test-result');

const HOST = process.env.SMTP_HOST || '';
const PORT = Number(process.env.SMTP_PORT) || 587;
const USER = process.env.SMTP_USER || '';
const PASSWORD = process.env.SMTP_PASSWORD || '';
const FROM = process.env.SMTP_FROM || '';
const HELO = process.env.SMTP_HELO || 'bachelor-point';
const TIMEOUT = Number(process.env.SMTP_TIMEOUT_MS) || 15000;

let total = 0;
let failures = 0;

function check(name, passed, detail) {
  total += 1;
  if (!passed) failures += 1;
  report(`  ${passed ? 'PASS' : 'FAIL'}  ${name}${passed || !detail ? '' : `  (${detail})`}`);
}

function probe() {
  return new Promise((resolve) => {
    const log = [];
    const useTls = PORT === 465;
    const socket = useTls
      ? tls.connect({ host: HOST, port: PORT, servername: HOST })
      : net.connect({ host: HOST, port: PORT });

    let active = socket;
    let buffer = '';
    let stage = 0;
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.destroy();
      } catch {
        /* already closed */
      }
      resolve({ ...result, log });
    };

    const timer = setTimeout(() => finish({ ok: false, error: `timed out after ${TIMEOUT}ms`, stage }), TIMEOUT);
    const write = (line) => active.write(`${line}\r\n`);

    const steps = [
      { cmd: `EHLO ${HELO}`, label: 'greeting accepted' },
      { cmd: 'STARTTLS', label: 'STARTTLS offered' },
      { cmd: `EHLO ${HELO}`, label: 'encrypted session established' },
      { cmd: 'AUTH LOGIN', label: 'AUTH LOGIN accepted' },
      { cmd: Buffer.from(USER).toString('base64'), label: 'username accepted' },
      { cmd: Buffer.from(PASSWORD).toString('base64'), label: 'password accepted' }
    ];

    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      if (!/\r\n$/.test(buffer)) return;

      const reply = buffer.trim();
      buffer = '';
      const code = Number(reply.slice(0, 3));
      log.push({ stage, code, reply: reply.split('\n').pop().slice(0, 90) });

      if (code >= 400) {
        return finish({ ok: false, error: reply.split('\n').pop().slice(0, 140), stage, code });
      }

      if (stage === 1 && useTls) stage = 2;

      if (stage === 2 && !useTls) {
        const upgraded = tls.connect({ socket, servername: HOST }, () => {
          active = upgraded;
          upgraded.on('data', onData);
          write(steps[2].cmd);
          stage = 3;
        });
        upgraded.on('error', (error) => finish({ ok: false, error: `TLS upgrade failed: ${error.message}`, stage }));
        stage = 99;
        return;
      }

      if (stage < steps.length) {
        write(steps[stage].cmd);
        stage += 1;
        return;
      }

      write('QUIT');
      return finish({ ok: true, stage });
    };

    socket.on('data', onData);
    socket.on('error', (error) => finish({ ok: false, error: error.message, stage }));
  });
}

async function run() {
  report('--- SMTP configuration ---');

  check('SMTP_HOST is set', Boolean(HOST), 'missing');
  check('SMTP_FROM is set', Boolean(FROM), 'missing');
  check('SMTP_USER is set', Boolean(USER), 'missing');
  check('SMTP_PASSWORD is set', Boolean(PASSWORD), 'missing');

  if (!HOST || !FROM) {
    report('');
    report('  Mail is not configured, so the app will show setup links on screen instead of emailing them.');
    report('  That is a valid development setup. Set SMTP_HOST and SMTP_FROM to send real mail.');
    return;
  }

  report(`  host ${HOST}:${PORT}  user ${USER}  from ${FROM}`);
  report('');
  report('--- Connection and credentials (no email is sent) ---');

  const result = await probe();

  check('reached the mail server', result.log.length > 0, result.error || 'no reply');
  check('server greeting was healthy', result.log[0] && result.log[0].code === 220, String(result.log[0]?.code));
  check('credentials were accepted', result.ok, result.error || `stopped at stage ${result.stage}`);

  if (!result.ok) {
    report('');
    reportError(`  SMTP failed: ${result.error}`);
    if (/username and password not accepted|5\.7\.8|BadCredentials/i.test(String(result.error))) {
      reportError('');
      reportError('  Gmail rejects normal account passwords over SMTP. SMTP_PASSWORD must be a');
      reportError('  16-character App Password generated at https://myaccount.google.com/apppasswords');
      reportError('  (2-Step Verification has to be on before that page appears).');
    }
    return;
  }

  report('');
  report('  Authenticated successfully and disconnected without sending anything.');
  report('  Registration emails will go out through this account.');
}

run()
  .catch((error) => {
    failures += 1;
    total += 1;
    reportError('Mail check aborted.');
    reportFailure(error);
  })
  .finally(() => {
    emitSummary('mail', { total, passed: total - failures, failed: failures });
    if (failures > 0) process.exitCode = 1;
  });
