import { Resolver } from 'node:dns/promises';
import { emailQualityConfig } from '@/config';

const DISPOSABLE_DOMAINS = new Set([
  '0-mail.com', '10minutemail.com', '10minutemail.net', '20minutemail.com', '33mail.com',
  'anonbox.net', 'anonymbox.com', 'armyspy.com', 'bccto.me', 'binkmail.com', 'bobmail.info',
  'bugmenot.com', 'burnermail.io', 'byom.de', 'cool.fr.nf', 'courriel.fr.nf', 'cuvox.de',
  'dandikmail.com', 'dayrep.com', 'deadaddress.com', 'despam.it', 'dispostable.com',
  'dodgeit.com', 'dodgit.com', 'donemail.ru', 'dontreg.com', 'dropmail.me', 'e4ward.com',
  'einrot.com', 'emailias.com', 'emailondeck.com', 'emailsensei.com', 'emailtemporanea.net',
  'emailwarden.com', 'ephemail.net', 'explodemail.com', 'fakeinbox.com', 'fakemail.net',
  'fakemailgenerator.com', 'fastacura.com', 'filzmail.com', 'fleckens.hu', 'gelitik.in',
  'get2mail.fr', 'getairmail.com', 'getnada.com', 'gishpuppy.com', 'grr.la', 'guerrillamail.biz',
  'guerrillamail.com', 'guerrillamail.de', 'guerrillamail.info', 'guerrillamail.net',
  'guerrillamail.org', 'guerrillamailblock.com', 'harakirimail.com', 'hidemail.de',
  'hmamail.com', 'inboxalias.com', 'inboxbear.com', 'incognitomail.com', 'jetable.com',
  'jetable.fr.nf', 'jetable.net', 'jetable.org', 'jourrapide.com', 'kasmail.com',
  'killmail.com', 'killmail.net', 'klzlk.com', 'kurzepost.de', 'lackmail.net', 'letthemeatspam.com',
  'lroid.com', 'maildrop.cc', 'mailcatch.com', 'mailde.de', 'maileater.com', 'mailexpire.com',
  'mailforspam.com', 'mailfreeonline.com', 'mailin8r.com', 'mailinater.com', 'mailinator.com',
  'mailinator.net', 'mailinator.org', 'mailinator2.com', 'mailme.lv', 'mailmetrash.com',
  'mailnesia.com', 'mailnull.com', 'mailsac.com', 'mailscrap.com', 'mailtemp.info',
  'mailtothis.com', 'mailzilla.com', 'meltmail.com', 'mintemail.com', 'moburl.com',
  'monumentmail.com', 'mt2015.com', 'mytemp.email', 'mytrashmail.com', 'nobulk.com',
  'noclickemail.com', 'nomail.xl.cx', 'nomail2me.com', 'nospam.ze.tc', 'nospamfor.us',
  'notmailinator.com', 'nowmymail.com', 'objectmail.com', 'onewaymail.com', 'owlpic.com',
  'pookmail.com', 'proxymail.eu', 'punkass.com', 'quickinbox.com', 'rcpt.at', 'reallymymail.com',
  'recursor.net', 'rhyta.com', 'rmqkr.net', 'rtrtr.com', 'sharklasers.com', 'shieldedmail.com',
  'shortmail.net', 'sneakemail.com', 'sofimail.com', 'sogetthis.com', 'spam4.me', 'spamavert.com',
  'spambob.com', 'spambog.com', 'spambox.us', 'spamcannon.com', 'spamcorptastic.com',
  'spamcowboy.com', 'spamday.com', 'spamex.com', 'spamfree24.com', 'spamgourmet.com',
  'spamherelots.com', 'spamhole.com', 'spaminator.de', 'spammotel.com', 'spamobox.com',
  'spamspot.com', 'spamthis.co.uk', 'spamtrail.com', 'spybox.de', 'superrito.com',
  'suremail.info', 'teleworm.us', 'temp-mail.io', 'temp-mail.org', 'tempail.com', 'tempe-mail.com',
  'tempemail.com', 'tempemail.net', 'tempinbox.com', 'tempmail.eu', 'tempmail.net',
  'tempmailaddress.com', 'tempmailer.com', 'tempomail.fr', 'temporarily.de', 'temporaryemail.net',
  'temporaryinbox.com', 'thankyou2010.com', 'thisisnotmyrealemail.com', 'throwawayemailaddress.com',
  'tempmail.org', 'tempmail.plus', 'tempmailo.com', 'tempr.email', 'mailpoof.com',
  'inboxkitten.com', 'moakt.com', 'emailfake.com', 'generator.email', 'discard.email',
  'linshiyouxiang.net', 'mailbox.in.ua', 'edu.mail.tm', 'mail.tm', 'minuteinbox.com',
  'tmail.ws', 'tmailinator.com', 'trash-mail.at', 'trash-mail.com', 'trash-mail.de',
  'trash2009.com', 'trashdevil.com', 'trashemail.de', 'trashmail.at', 'trashmail.com',
  'trashmail.me', 'trashmail.net', 'trashmail.org', 'trashymail.com', 'tyldd.com',
  'uggsrock.com', 'wegwerfmail.de', 'wegwerfmail.net', 'wegwerfmail.org', 'wh4f.org',
  'willhackforfood.biz', 'willselfdestruct.com', 'yopmail.com', 'yopmail.fr', 'yopmail.net',
  'yourdomain.com', 'yuurok.com', 'zetmail.com', 'zippymail.info'
]);

const ALIAS_DOT_INSENSITIVE_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

const MX_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MX_CACHE_MAX = 5_000;

type MxEntry = { hasMx: boolean; checkedAt: number };

const globalForMx = globalThis as unknown as {
  mxCache?: Map<string, MxEntry>;
  mxResolver?: Resolver;
};

const mxCache = globalForMx.mxCache ?? new Map<string, MxEntry>();
globalForMx.mxCache = mxCache;

function getResolver(): Resolver {
  if (globalForMx.mxResolver) return globalForMx.mxResolver;

  const resolver = new Resolver({ timeout: emailQualityConfig.mxTimeoutMs, tries: 2 });
  if (emailQualityConfig.mxResolvers.length > 0) {
    resolver.setServers(emailQualityConfig.mxResolvers);
  }

  globalForMx.mxResolver = resolver;
  return resolver;
}

export function emailDomain(email: string): string {
  return email.slice(email.lastIndexOf('@') + 1).toLowerCase();
}

export function isDisposableEmail(email: string): boolean {
  return DISPOSABLE_DOMAINS.has(emailDomain(email));
}

export function canonicalEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return email.toLowerCase();

  let local = email.slice(0, at).toLowerCase();
  const domain = email.slice(at + 1).toLowerCase();

  const plus = local.indexOf('+');
  if (plus > 0) local = local.slice(0, plus);

  if (ALIAS_DOT_INSENSITIVE_DOMAINS.has(domain)) {
    local = local.replace(/\./g, '');
    return `${local}@gmail.com`;
  }

  return `${local}@${domain}`;
}

export async function domainHasMx(domain: string): Promise<boolean> {
  if (!emailQualityConfig.requireMx) return true;

  const now = Date.now();
  const cached = mxCache.get(domain);
  if (cached && now - cached.checkedAt < MX_CACHE_TTL_MS) return cached.hasMx;

  let hasMx: boolean;

  try {
    const records = await getResolver().resolveMx(domain);
    hasMx = Array.isArray(records) && records.some((record) => Boolean(record.exchange));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOTFOUND' || code === 'ENODATA' || code === 'NXDOMAIN') {
      hasMx = false;
    } else {
      return true;
    }
  }

  if (mxCache.size >= MX_CACHE_MAX) mxCache.clear();
  mxCache.set(domain, { hasMx, checkedAt: now });
  return hasMx;
}

export type EmailQualityResult = { ok: true } | { ok: false; reason: 'disposable' | 'no-mx' };

export async function checkEmailQuality(email: string): Promise<EmailQualityResult> {
  if (isDisposableEmail(email)) return { ok: false, reason: 'disposable' };
  if (!(await domainHasMx(emailDomain(email)))) return { ok: false, reason: 'no-mx' };
  return { ok: true };
}
