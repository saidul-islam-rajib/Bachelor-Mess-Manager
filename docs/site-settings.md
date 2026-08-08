# Site settings and the public footer

`SiteSettings` is a singleton row edited at Admin → Settings. It carries two very different kinds of thing: the
public identity of the site (company name, tagline, address, contact email and phone, social links) and internal
policy (login lockout thresholds, password strength, meal-edit rules).

## The footer used to be blank for logged-out visitors

`Footer` fetches `/api/settings` to fill the Contact column. That endpoint was not in `middleware.ts`'s
`PUBLIC_PATHS`, so every anonymous request was answered with `401` before it reached the handler. The fetch failed,
`settings` stayed `null`, and the footer fell through to its "Contact details coming soon." placeholder — on the
landing page, the login page, and everywhere else a visitor actually looks for a contact address. Signed-in admins
saw the real values, which is why it looked like an admin-only feature.

`/api/settings` is now public. `GET` needs no session; `PATCH` still checks admin inside the handler, and middleware
was never the thing enforcing that.

## Public GET returns a projection, not the row

Opening the endpoint up meant it could no longer return the whole record. `maxLoginAttempts`, `loginLockoutMinutes`,
`maxRegistrationsPerIp` and `requireStrongPasswords` describe exactly how much brute force the site tolerates before
it locks an account — precisely what someone tuning a credential-stuffing run would like to know.

So `GET` branches:

- **admin** — the full row, because Admin → Settings edits `mealEditWindowMinutes` and `mealEditRequiresApproval`
  through the same call.
- **everyone else, signed in or not** — only `companyName`, `tagline`, `address`, `contactEmail`, `contactPhone`,
  `copyrightOwner`, `facebookUrl`, `twitterUrl`, `newsletterEnabled`. That is exactly the set `Footer` consumes.

No `Cache-Control` is set. The response varies by session, and a shared cache holding the public projection could
hand it to an admin whose settings form would then render half-empty.
