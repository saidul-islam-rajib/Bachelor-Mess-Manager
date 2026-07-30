# Email setup — Gmail + Cloudflare Email Routing

How `admin@team-sober.com` sends and receives mail, for free.

Without this configured **members cannot self-register**: registration creates the account and
issues a password-setup token, but the link never reaches anyone.

---

## 1. How the app decides to send

`isMailConfigured()` in [`src/lib/mailer.ts`](../src/lib/mailer.ts) is the whole gate:

```ts
return Boolean(mailConfig.host && mailConfig.from);
```

Both `SMTP_HOST` **and** `SMTP_FROM` must be non-empty. If either is missing, `sendMail()`
returns early with `{ ok: true, delivered: false }` — no SMTP connection is attempted, no error
is logged. The message is pushed onto an in-memory array and forgotten on restart.

Note `ok: true` there. `ok` only means nothing threw; `delivered` is the field that says whether
mail actually left. Callers must check both.

Outside production, when mail is unconfigured, `POST /api/auth/register` returns the setup link
in the response body and the page renders it in an amber box. That is why local development
works without any SMTP at all — and why you should leave the `SMTP_*` lines in `.env` commented
out unless you specifically want to send real mail from your laptop.

---

## 2. Why two providers

Cloudflare Email Routing **only receives**. It has no outbound SMTP, so it cannot send the
password-setup emails. The sending half is Gmail's.

| Direction | Who does it | Cost |
| --- | --- | --- |
| Receiving `admin@team-sober.com` | Cloudflare Email Routing → forwards to Gmail | Free |
| Sending as `admin@team-sober.com` | Gmail SMTP + verified send-as alias | Free, ~500/day |

---

## 3. Cloudflare — receiving

Cloudflare dashboard → `team-sober.com` → **Email** → **Email Routing** → Enable.

Two separate things have to exist, and it is easy to do only the first:

**Destination address** — *Email Routing → Destination Addresses*. Add
`saidul.is.rajib@gmail.com` and click the verification link Cloudflare emails you. This only
says the inbox is *allowed* to receive forwarded mail.

**Routing rule** — click the domain → *Routing rules* / *Custom addresses*. This is what
actually creates the address:

```
admin@team-sober.com  →  saidul.is.rajib@gmail.com
```

Point it at whichever Gmail account is your `SMTP_USER`. If several destinations are verified
it is easy to pick the wrong one from the dropdown, and then Gmail's send-as confirmation code
(step 5) arrives in an inbox you are not setting the alias up in.

Cloudflare adds the required MX records automatically. The *Emails received* counter on the
Email Routing overview stays at 0 until a rule exists and something actually arrives — it is a
quick way to check your work.

---

## 4. SPF — the step that silently breaks delivery

Cloudflare auto-creates an SPF record authorising only **its own** servers:

```
v=spf1 include:_spf.mx.cloudflare.net ~all
```

Mail you *send* leaves Google's servers, not Cloudflare's, so it fails that record and lands in
spam. Receiving is unaffected, which is what makes this easy to miss.

The record needs to authorise both:

```
v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all
```

**Email Routing locks the records it manages**, so the DNS tab will not let you edit the SPF
record directly — the Email Routing overview shows *DNS records: Locked*. Open the domain in
Email Routing and unlock the managed records first, then edit the TXT record in the zone's DNS
tab. Unlocking means Cloudflare stops maintaining those records for you, so leave the MX
entries exactly as they are.

One record with both includes. **Never publish two SPF records** for the same domain — that is a
permanent error and is worse than having none.

---

## 5. Gmail — the send-as alias

Gmail → **Settings** → **Accounts and Import** → *Send mail as* → **Add another email address**:

- Name: `Bachelor Point`
- Email: `admin@team-sober.com`
- Leave **"Treat as an alias"** checked
- Choose **"Send through Gmail"** — the *Send through SMTP* option requires paid Workspace

Gmail sends a confirmation code to `admin@team-sober.com`; Cloudflare forwards it to the same
inbox. Paste it back.

**This step is mandatory.** `SMTP_FROM` (`admin@team-sober.com`) differs from `SMTP_USER`
(the Gmail address), and Gmail refuses to send for an unverified sender:

```
553-5.7.60 SMTP relay: Invalid credentials
```

---

## 6. App Password

Your normal Gmail password will not work — Google blocks basic auth for regular passwords.

1. Turn on 2-Step Verification on the Google account
2. Generate a password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords)
3. It is 16 characters, shown with spaces; the spaces are cosmetic but harmless either way

Treat it as a live credential: it grants send-as-you access to the account.

---

## 7. Configure

### Local

Uncomment the email block in `.env`:

```bash
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_USER="saidul.is.rajib@gmail.com"
SMTP_PASSWORD="your-16-char-app-password"
SMTP_FROM="Bachelor Point <admin@team-sober.com>"
APP_PUBLIC_URL="http://localhost:3000"
```

Uncommenting these **disables the on-page setup link**, because that fallback is gated on
`!isMailConfigured()`. If mail then fails, registration has no fallback — use the admin
password-link endpoint below.

### Cluster

Do **not** put the real App Password in `k8s/base/secret.example.yaml` — that file is tracked by
git. Patch the live secret instead:

```bash
ssh -i terraform/free-tier/bachelor-point-key.pem ubuntu@54.251.180.71

sudo k3s kubectl -n bachelor-point patch secret bachelor-point-secrets -p '{"stringData":{
  "SMTP_HOST":"smtp.gmail.com",
  "SMTP_PORT":"587",
  "SMTP_USER":"saidul.is.rajib@gmail.com",
  "SMTP_PASSWORD":"your-16-char-app-password",
  "SMTP_FROM":"Bachelor Point <admin@team-sober.com>"
}}'

sudo k3s kubectl -n bachelor-point rollout restart \
  deployment/bachelor-point-blue deployment/bachelor-point-green
```

The deployments consume the secret via `envFrom: secretRef`, so new keys need no manifest
change — only the restart.

`APP_PUBLIC_URL` is already set in `k8s/free-tier/patch-configmap.yaml`. It decides the host in
the emailed link; without it `publicBaseUrl()` falls back to the request `Host` header, which is
wrong behind the proxy.

---

## 8. Verify

Register a throwaway address and confirm the mail arrives.

Failures are now visible on the page: registration reports *"Account created, but the email
could not be sent"* whenever the mail was not actually delivered — including the case where SMTP
is simply unconfigured, which previously showed a success message.

To inspect a specific send, an admin can call:

```bash
POST /api/users/<userId>/password-link
```

It returns `{ link, mailConfigured, delivered, error }` — the real SMTP error string when there
is one, plus a fresh 24-hour link you can pass on by hand. This is also the answer to "the email
never arrived".

---

## 9. Limits of this setup

- **~500 recipients/day** on free Gmail. Fine for a mess; not a mailing list.
- **DKIM signs as `gmail.com`, not `team-sober.com`.** Free Gmail signs with Google's key, so
  DKIM does not align with your domain and DMARC passes on SPF alone. Do not publish
  `p=reject` without testing first.
- Google may rewrite the envelope sender; recipients still see `From: admin@team-sober.com`.
- The SMTP client in `src/lib/mailer.ts` is hand-rolled: STARTTLS on 587, `AUTH LOGIN`, no
  connection pooling, no retry. A send that fails is not queued or retried.

Outgrowing it: Resend and Brevo both offer domain DKIM on free tiers. Only `SMTP_HOST`,
`SMTP_USER` and `SMTP_PASSWORD` change — no application code does.
