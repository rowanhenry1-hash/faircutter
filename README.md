# Faircutter

> Fair splits. Not just equal ones.

A household and group money app built around **rules**, not transactions. Most bill splitters log expenses and make you pick a split every time. Faircutter inverts that: define how your household handles money once, and every new expense matches a rule automatically.

The full product thesis lives in [`BLUEPRINT.md`](./BLUEPRINT.md). Read that first if you're new to the codebase.

---

## Quick start

```bash
# 1. Install
npm install

# 2. Configure env
cp .env.example .env.local
# then paste real values for DATABASE_URL, AUTH_SECRET, RESEND_API_KEY, etc.

# 3. Apply schema + seed dev data (Neon)
npm run db:migrate
npm run db:seed

# 4. Run dev server
npm run dev
# -> http://localhost:3000
```

### Seed login

The seed script creates a dev founder user:

```
email:    founder@seed.faircutter.dev
password: faircutter-dev
```

Pick "Use a password instead" on the sign-in form. Magic link works once `RESEND_API_KEY` is set and the recipient email is verified on Resend.

The seed also creates **5 demo groups** matching the 5 launch templates:

1. Alex & Sam — couple with two incomes
2. Three Roommates (equal) — flat split
3. Three Roommates (by income) — income-prorated rent
4. The Family Household — parents + adult working child (the canonical Section 0 example)
5. Tokyo trip (4 people) — group trip with per-expense opt-out

---

## Stack

| | |
|---|---|
| App framework | Next.js 16 (App Router, Server Actions) on Turbopack |
| UI | React 19, Tailwind CSS v4, shadcn-style primitives |
| Database | Neon Postgres + Drizzle ORM |
| Auth | Auth.js v5 — Resend magic link + email/password (Credentials) |
| Email | Resend |
| Payments | Stripe (scaffolded test-mode; **paywall off** by default) |
| Hosting | Vercel (auto-deploy from `main`) |
| Analytics | PostHog (opt-in; no-op if `POSTHOG_KEY` unset) |

---

## Environment variables

See [`.env.example`](./.env.example) for the canonical list. The required-for-dev set:

| Variable | What it's for |
|---|---|
| `DATABASE_URL` | Neon pooled connection (app queries) |
| `DATABASE_URL_UNPOOLED` | Neon unpooled connection (migrations) |
| `AUTH_SECRET` | Auth.js JWT signing. Generate with `openssl rand -base64 32` |
| `AUTH_URL` | Origin for callback URLs (`http://localhost:3000` in dev) |
| `RESEND_API_KEY` | Magic-link email delivery |
| `EMAIL_FROM` | Sender for auth emails |

Stripe / Cloudflare / PostHog / Sentry are optional and lazy — the app runs fine without them. Step 9's pricing page is functional but paid CTAs stay disabled while `PAYWALL_ENABLED=false`.

### Vercel deployment env

Use a **different** `AUTH_SECRET` in Vercel than locally. Set `AUTH_URL` to your deployed origin (e.g. `https://faircutter-rowanhenry1-8457s-projects.vercel.app`). All env vars need to be added to both Production and Preview scopes via the Vercel dashboard or CLI.

```bash
# Add a var via CLI (non-interactive)
vercel env add VAR_NAME production --value "the-value" --yes
```

---

## Commands

### Dev

| Command | What it does |
|---|---|
| `npm run dev` | Start Next.js dev server on :3000 |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | Next.js ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Run Vitest suite |
| `npm run test:watch` | Vitest in watch mode |

### Database

| Command | What it does |
|---|---|
| `npm run db:generate` | Generate a Drizzle migration from `src/db/schema.ts` |
| `npm run db:migrate` | Apply pending migrations to the connected DB |
| `npm run db:push` | Push schema directly (skips migrations — dev only) |
| `npm run db:studio` | Open Drizzle Studio in a browser |
| `npm run db:seed` | Populate the 5 demo groups + templates + founder user |

### Stripe (test mode)

| Command | What it does |
|---|---|
| `npm run stripe:setup-test` | Create the Fair monthly and Trip Pass products in your Stripe test account and write the resulting price IDs back into `.env.local` |

The `stripe:setup-test` script uses your `STRIPE_SECRET_KEY` (must be `sk_test_…`) and is idempotent — re-running won't duplicate products. Look up keys: `faircutter_fair_monthly`, `faircutter_trip_pass`.

### Admin scripts (dev-only, scripts/)

| Command | What it does |
|---|---|
| `npm run admin:reset-group -- <groupId>` | Wipe all expenses, settlements, and rules from a group while keeping the group + members |
| `npm run admin:dump-user -- <userId>` | Export a user's full dataset as JSON — first step toward a GDPR self-service export |

---

## Routes at a glance

| Path | Auth? | Purpose |
|---|---|---|
| `/` | — | Landing page |
| `/pricing` | — | Tiers (paywall disabled) |
| `/help`, `/privacy`, `/terms` | — | Static legal/help |
| `/auth` | — | Sign in (magic link / password) |
| `/auth/check-email` | — | Post magic-link confirmation |
| `/onboarding` | required | New group flow with template picker |
| `/app` | required | Dashboard — your groups |
| `/app/settings` | required | Profile + delete-account stub |
| `/app/g/[id]` | required | Group detail |
| `/app/g/[id]/rules` | required | Rule library |
| `/app/g/[id]/rules/new` | required | Pick how to add a rule |
| `/app/g/[id]/rules/templates` | required | Apply a launch template |
| `/app/g/[id]/rules/finder` | required | Akinator-style rule finder |
| `/app/g/[id]/rules/editor` | required | Manual JSON rule editor |
| `/app/g/[id]/expenses/new` | required | Add an expense (rule auto-suggested) |
| `/app/g/[id]/expenses/[id]` | required | Expense detail + per-person shares |
| `/app/g/[id]/balances` | required | Net + pairwise debts + settle-up |
| `/app/g/[id]/settlements/[id]` | required | Single settlement record |
| `/app/g/[id]/invite` | required | Manage ghost members + access codes |
| `/app/g/[id]/export/expenses` | required | CSV export of expenses |
| `/app/g/[id]/export/balances` | required | CSV export of net + pairwise |
| `/view/[code]` | **no** | Ghost user public viewer — the cold-start moat |
| `/view/[code]/claim` | required | Upgrade ghost → real account |
| `/api/stripe/webhook` | (signature) | Stripe webhook stub (logs only) |

---

## The rules engine

The heart of the product. Located in [`src/rules/`](./src/rules/):

- `types.ts` — discriminated union for 10 split types
- `engine.ts` — `applyRules({ rules, participants, expense }) → Split`
- `engine.test.ts` — 24 vitest cases including the full Section 0 scenario
- `templates.ts` — the 5 launch templates with placeholder binding
- `finder.ts` — the Akinator question flow + compiler

Rules are **first-class, ordered, and reusable**. Every expense matches the first rule by ascending priority whose `appliesToCategories` includes the expense category (or whose categories list is empty = matches all). Money math is integer minor units throughout; the largest-remainder distribution guarantees every split sums to exactly the expense amount with no penny drift.

The 10 split types:

```
equal, percentage, fixed_amount, by_income,
itemized, weighted, usage_based, exempt,
rotating, subsidized
```

---

## Architectural notes

- **Ghost users are first-class members.** Every non-registered participant is a `ghost_users` row with an 8-char access code. The `/view/[code]` public viewer is the no-forced-signup moat. Claim flow re-points the `group_members` row from ghost → user; expense participations continue to reference the ghost id so history stays intact.
- **No double-bookkeeping for balances.** Balances are computed on read by `computeBalances` over expenses + settlements. If query cost becomes a problem, swap in a materialized view later — the schema is shaped to accept that without app-layer changes.
- **JWT session strategy** (not database sessions) because Auth.js v5 Credentials provider doesn't support DB sessions. Adapter still persists users + verification tokens.
- **Currency is per-group, no FX.** Amounts are pure integers; the currency code lives on `groups.currency`. Multi-currency is Phase 2+.
- **i18n hooks intentionally absent.** English-only at launch. UI strings sit inline in JSX. next-intl wiring is a future refactor.

---

## Adding error tracking later (Sentry)

PostHog is wired in `src/lib/posthog.ts` and stays a no-op unless `POSTHOG_KEY` is set. Sentry was deliberately deferred — the official `@sentry/nextjs` wizard rewrites `next.config.ts` and adds instrumentation files, which felt too invasive for the launch review. When you want it:

```bash
npx @sentry/wizard@latest -i nextjs
```

It will ask for the DSN (which it puts in `SENTRY_DSN` — already in `.env.example`) and reconfigure the build. Test on a branch first.

---

## Deployment

Push to `main` → Vercel auto-deploys.

Production: <https://faircutter-rowanhenry1-8457s-projects.vercel.app>

DNS for `faircutter.com` is in Cloudflare (zone id `784f2f47…`). To point the apex at Vercel, add a CNAME (or Cloudflare's CNAME-flattening A record) for `@` pointing at `cname.vercel-dns.com` and add the domain in Vercel's project settings.

---

## Project log

The build was orchestrated across Claude Code, Cursor, and Codex following the pattern in `BLUEPRINT.md`:

- **Steps 1–6, 8, 11** — Claude Code (scaffold, schema, rules engine, ghost viewer, review pass)
- **Steps 7, 9** — Cursor (dashboard polish + settlements; settings/pricing/legal/Stripe scaffold)
- **Step 10** — Codex (CSV export + admin scripts)

Every step appended an entry to `BLUEPRINT.md` Section 7. Read top-to-bottom for the full decision history.

---

## License

Private. All rights reserved (pre-launch).
