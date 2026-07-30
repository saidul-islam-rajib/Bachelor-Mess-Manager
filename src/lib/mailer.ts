import net from 'node:net';
import tls from 'node:tls';
import { appConfig, mailConfig } from '@/config';

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export type MailResult =
  | { ok: true; delivered: true }
  | { ok: true; delivered: false; preview: string }
  | { ok: false; error: string };

const globalForMail = globalThis as unknown as { outbox?: MailMessage[] };
globalForMail.outbox ??= [];

export function recentMail(limit = 20): MailMessage[] {
  return (globalForMail.outbox ?? []).slice(-limit).reverse();
}

export function isMailConfigured(): boolean {
  return Boolean(mailConfig.host && mailConfig.from);
}

function encodeHeader(value: string): string {
  return /^[\x20-\x7E]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value).toString('base64')}?=`;
}

function buildMime(message: MailMessage): string {
  const boundary = `bp_${Date.now().toString(36)}`;
  return [
    `From: ${mailConfig.from}`,
    `To: ${message.to}`,
    `Subject: ${encodeHeader(message.subject)}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    '',
    message.text,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    '',
    message.html,
    '',
    `--${boundary}--`,
    ''
  ].join('\r\n');
}

function smtpSend(message: MailMessage): Promise<void> {
  return new Promise((resolve, reject) => {
    const useTls = mailConfig.port === 465;
    const socket = useTls
      ? tls.connect({ host: mailConfig.host as string, port: mailConfig.port, servername: mailConfig.host as string })
      : net.connect({ host: mailConfig.host as string, port: mailConfig.port });

    let active: NodeJS.ReadWriteStream = socket;
    let buffer = '';
    let stage = 0;
    let settled = false;

    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      try {
        socket.destroy();
      } catch {
        return error ? reject(error) : resolve();
      }
      if (error) reject(error);
      else resolve();
    };

    const timer = setTimeout(() => finish(new Error('SMTP timed out')), mailConfig.timeoutMs);

    const write = (line: string) => active.write(`${line}\r\n`);

    const steps: string[] = [
      `EHLO ${mailConfig.helo}`,
      'STARTTLS',
      `EHLO ${mailConfig.helo}`,
      'AUTH LOGIN',
      Buffer.from(mailConfig.user ?? '').toString('base64'),
      Buffer.from(mailConfig.password ?? '').toString('base64'),
      `MAIL FROM:<${(mailConfig.from ?? '').replace(/.*<|>.*/g, '')}>`,
      `RCPT TO:<${message.to}>`,
      'DATA'
    ];

    const onData = (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      if (!/\r\n$/.test(buffer)) return;

      const reply = buffer;
      buffer = '';
      const code = Number(reply.slice(0, 3));

      if (code >= 400) {
        clearTimeout(timer);
        return finish(new Error(`SMTP error: ${reply.trim().slice(0, 120)}`));
      }

      if (stage === 1 && useTls) stage = 2;
      if (stage === 3 && !mailConfig.user) stage = 6;

      if (stage === 2 && !useTls) {
        const upgraded = tls.connect({ socket: socket as net.Socket, servername: mailConfig.host as string }, () => {
          active = upgraded;
          upgraded.on('data', onData);
          write(steps[2]);
          stage = 3;
        });
        upgraded.on('error', (error) => {
          clearTimeout(timer);
          finish(error);
        });
        stage = 99;
        return;
      }

      if (stage < steps.length) {
        write(steps[stage]);
        stage += 1;
        return;
      }

      if (stage === steps.length) {
        active.write(`${buildMime(message).replace(/\n\./g, '\n..')}\r\n.\r\n`);
        stage += 1;
        return;
      }

      clearTimeout(timer);
      write('QUIT');
      finish();
    };

    socket.on('data', onData);
    socket.on('error', (error) => {
      clearTimeout(timer);
      finish(error);
    });
  });
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  globalForMail.outbox?.push(message);
  if ((globalForMail.outbox?.length ?? 0) > 50) globalForMail.outbox?.shift();

  if (!isMailConfigured()) {
    return { ok: true, delivered: false, preview: message.text };
  }

  try {
    await smtpSend(message);
    return { ok: true, delivered: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Mail delivery failed.' };
  }
}

export function passwordSetupEmail(name: string, link: string, minutes: number): MailMessage {
  const subject = `Set your ${appConfig.name} password`;

  const text = [
    `Hello ${name},`,
    '',
    `An account was created for you on ${appConfig.name}.`,
    'Open the link below to choose a password. It expires in ' + minutes + ' minutes.',
    '',
    link,
    '',
    'If you did not expect this email you can safely ignore it. No password is set until the link is used.',
    '',
    appConfig.name
  ].join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f8fafc;font-family:system-ui,-apple-system,Segoe UI,sans-serif;color:#0f172a">
  <div style="max-width:520px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px">
    <h1 style="margin:0 0 8px;font-size:20px">${appConfig.name}</h1>
    <p style="margin:0 0 24px;color:#475569;font-size:14px">Hello ${name}, choose a password to finish setting up your account.</p>
    <a href="${link}" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;padding:12px 24px;border-radius:999px;font-size:14px">Create your password</a>
    <p style="margin:24px 0 0;color:#64748b;font-size:12px">This link expires in ${minutes} minutes and can only be used once. If the button does not work, paste this into your browser:</p>
    <p style="margin:8px 0 0;color:#64748b;font-size:12px;word-break:break-all">${link}</p>
    <p style="margin:24px 0 0;color:#94a3b8;font-size:12px">If you did not expect this email you can ignore it. No password is set until the link is used.</p>
  </div>
</body></html>`;

  return { to: '', subject, text, html };
}
