# BLUEPRINT.md — Faircutter

> The living plan for the Faircutter build. Append, don't overwrite (except Section 9). Read end-to-end before starting any step.

---

## Section 0 — Project Context (Frozen)

**Owner:** Solo founder. Building primarily with Claude Code, Cursor, and Codex (paid access to all three). Limited line-by-line coding done by the human; the founder's role is direction, review, decisions, and orchestration.

**What Faircutter is:** A household and group money app built around **rules**, not transactions. The product's central insight is that most "bill splitter" apps log expenses and then ask the user to pick a split. Faircutter inverts this: users define how their household handles money (rules), and individual expenses get matched against those rules automatically. The rule is the noun; the expense is just an instance.

A concrete example that should be possible to express cleanly in Faircutter from day one:
> A household has two parents and one adult working child. The parents prorate the mortgage and utilities by their incomes. The internet bill is the exception — the child pays 50% of it. The child also pays a flat $500/month toward rent. Groceries are equal between the parents, child opts out.
This is one household, multiple rules, with exceptions and overrides. Splitwise cannot do this cleanly. Faircutter must.

**What Faircutter is NOT:**
- Not a transaction logger that happens to do math.
- Not a payments app at launch (no bank connection, no virtual card, no settlement rails — those are Phase 3+).
- Not a financial advisor. The app does not judge, advise, or recommend financial decisions beyond fair splits.
- Not a nagging app. Faircutter never sends unprompted payment reminders. Only humans send nudges, and the message shows as coming from the person, not the app.
- Not a forced-install app. Anyone added to a group should be able to view balances and mark themselves paid via a one-time code or magic link without creating an account.

**Target audience (in priority order):**
1. **Roommates and households in Canada/US/UK/AU** frustrated with Splitwise's degraded free tier (3 expenses/day, ads between actions, $5/month for what used to be free). This is the wedge market — they have the pain, the willingness to pay, and they're actively looking for alternatives in 2026.
2. **Couples and partners** with unequal incomes who want fair splits without a confrontation.
3. **Multi-generational households** (parents + adult working children, especially common in immigrant and diaspora households). The rules engine is built for this.
4. **Diaspora households** whose money lives in two countries (daughter in Toronto sending money to family in Manila, son in London supporting parents in Lagos). Strong long-term opportunity — these households need fairness logic that Western splitters and local payment apps both miss.
5. **Long-term:** households in lower-income markets (South Asia, Africa, Caribbean, parts of Latin America) where shared-household financial obligations are the norm. Pricing here is Phase 3+ via local payment rails (mobile money, UPI). Not a launch concern.

**Commercial intent:** This is a real business, not a hobby. Target outcomes range from "hundreds of thousands per year is a great outcome" to "millions if it scales." The founder is willing to charge $0.25/month in low-income markets if volume justifies it, but the launch market and pricing is Canada/US/UK at $5/month — and this is what economics actually support given payment processing fees.

**Why this can disrupt:** Splitwise has aged into a transaction logger that throttles its free users and offers no real intelligence about how households actually negotiate money. Search results from 2026 show active user discontent and a wave of alternatives launching (SplitterUp, GoodShare, Spliit, PartyTab, etc.) — none of which have the rules-engine concept. There is a real generational opening here for a product that **thinks instead of just tracking**. The risk isn't the idea — it's execution discipline on the rules engine and the no-signup viewer.

**Time budget:** Weeks to months, not days. The founder is comfortable with the build taking as long as it takes if the result is excellent. Iterative; not aiming for a polished launch on day one. Functional first, then improve.

**Why this way (Claude Code + Cursor + Codex with blueprint pattern):** The founder is not coding line-by-line. The blueprint lives in the repo, every AI tool reads it before starting, the Step Log accumulates a complete record, and Claude Code is the final decider on plan direction. This pattern protects the project from tool-hopping chaos and from AI tools rewriting the plan to suit themselves.

---

## Section 1 — The Product Concept (Frozen)

### The core loop

1. A user creates a household (or trip, or one-time group).
2. The user defines **rules** for how that household handles money. Rules can come from:
   - **Templates** (pre-built rule sets: couple-two-incomes, roommates-equal, roommates-by-income, parents-plus-adult-child, group-trip).
   - **The rule finder** — a guided clicking experience (mostly card selections, minimal typing). The user is shown ~4 cards per question and either picks one or skips. 5–7 questions yields a complete household rule set.
   - **From scratch** — manual rule construction for power users.
3. Once rules exist, adding an expense becomes trivial: enter amount, who was there, category. The app applies the matching rule automatically and shows the split. One tap to confirm.
4. The app tracks balances between people. At any time, anyone can see what they owe whom.
5. Settlement is simple at launch — pairwise, manually marked as paid. Smart netting (minimum-transactions, sub-grouping for roommates-within-a-trip, payday-aware timing) comes in V2.
6. People who are added to a group can view their balance and mark themselves paid via a **one-time code or magic link without creating an account**. They can later upgrade to a real account if they want history.

### Main jobs the product does

| Job | Why it matters |
|---|---|
| Express how a household actually handles money as a reusable rule set | The differentiator. Nothing else does this. |
| Apply rules to expenses automatically | Removes the cognitive load that makes Splitwise tedious. |
| Make the rule-building experience accessible | If only finance nerds can use it, it fails. The card-based rule finder is the bridge. |
| Let people without accounts participate | Kills the cold-start problem that hobbles every competitor. |
| Track balances without nagging | Differentiates on tone. Splitwise users complain about pressure. |
| Be fair without being preachy | "Here are fair options" not "you owe them." |

### Key entities and data

- **Users** — id, email, name, optional declared income, pay schedule (optional, V2-relevant), preferred currency, data sharing preference, language preference.
- **Households / Groups** — id, name, type (household / trip / one-time), created_by, currency, status.
- **Group members** — group_id, user_id (or "ghost user" for unregistered participants), role, joined_at.
- **Ghost users** — non-registered people in a group; identified by a one-time code; can view via magic link; can upgrade to a real account by claiming the link.
- **Rules** — id, group_id (or owner_id for personal rule library), name, split_type, parameters (JSON), applies_to_categories (array), priority/order, created_by, is_template, is_default.
- **Expenses** — id, group_id, paid_by, amount, currency, category, description, due_date (V2-relevant), created_at, rule_id (the rule that was applied).
- **Expense participants** — expense_id, user_id (or ghost_id), share_amount, is_exempt, exception_reason.
- **Balances** — derived/cached; group_id, user_id pair → net.
- **Settlements** — id, group_id, from_user, to_user, amount, marked_paid_at, settlement_type (V2 will add more types).
- **Templates** — id, name, description, applies_to (relationship type), rules (JSON array of rule definitions).
- **Rule fragments** — id, trigger_text, display_label, rule_mapping (JSON) — for the autocomplete/autofill rule finder.

### Key outputs

- A clean dashboard showing: who owes whom, what's been spent recently, which rules are active.
- An expense entry flow that takes <10 seconds per expense.
- A rule-builder that someone can complete in 3–5 minutes for a typical household.
- A shareable link to add someone without forcing signup.
- An export (CSV) of expenses and balances for a group.

---

## Section 2 — Demo / Build Data (Frozen)

**Approach:** Seeded scenarios for development, not real user data.

The blueprint specifies five seeded households the developer can use to develop against. These match the launch templates (Section 4) and serve as both dev data and the basis for screenshots/marketing.

1. **Couple with two incomes** — Alex ($75K) and Sam ($45K). Joint expenses prorated by income. Personal expenses not split.
2. **Three roommates, equal split** — Standard university or shared-apartment scenario. All bills split 3 ways.
3. **Three roommates, income-proportional** — Same setup but rent and utilities are split by income while groceries are equal and Netflix rotates.
4. **Parents + adult working child** — The Section 0 example. Mortgage prorated between parents; utilities prorated between parents except internet (child pays 50%); child pays flat $500 rent; groceries between parents only.
5. **Four-person group trip to Tokyo** — Hotel, meals, taxis, attractions. Two of the four are also roommates (relevant for V2's smart netting). Equal splits with one person exempt from one dinner.

Seed data lives in `/seed/scenarios.ts` (or similar) and can be loaded into a fresh dev DB with one command. **Do not** seed real names or real-looking emails — use obviously fictional ones.

No use of real user data, real bank data, or real paystubs in development.

---

## Section 3 — Stack & Hosting (Frozen)

**Frontend:** Next.js (App Router). React. Mobile-first responsive design. Built as a **PWA** — installable to home screen, works offline for expense entry, no app store fees, no 30% Apple/Google cut. The app is fully usable as a website on a phone browser; PWA is the upgrade path for users who want app-like behavior.

**Why PWA, not native:** Native apps require Apple Developer ($99/year) and Google Play ($25 one-time) fees, App Store review cycles, and 15–30% revenue share on subscriptions. PWA avoids all of this and ships faster. The trade-off is no App Store discovery — addressed via the referral loop (people added to groups become users) and SEO/content marketing.

**UI:** Tailwind CSS + shadcn/ui components. Standard, fast, easy for any AI tool to extend. Keep designs simple at launch; iterate after the product is functional.

**Database:** **Neon Postgres** to start (generous free tier, scales to paid when needed). Schema designed to be portable — could move to Supabase Postgres later with minimal pain if Supabase's auth/realtime become attractive. Use Drizzle ORM or Prisma — Drizzle is leaner and easier to debug; Claude Code can write either.

**Auth:** Both magic link **and** email/password from launch. Use NextAuth.js (Auth.js v5) — it supports both, integrates with Neon Postgres, and doesn't lock the project into any specific auth provider. Magic link is the default suggested option in the UI; password is available for users who prefer it.

**Payments:** Stripe — integrated from day one but in test/inactive mode at launch. Subscription products configured in Stripe dashboard but not enforced; the app ships free for everyone initially. When ready to charge, flip a flag in the codebase and the paywall activates. This avoids building Stripe integration twice.

**Hosting:** Vercel (free tier sufficient until real traffic). Auto-deploys from GitHub main branch. Preview deploys for every PR.

**DNS:** Cloudflare (founder already owns faircutter.com).

**Repo:** GitHub. Private. Single repo, monorepo not needed.

**Email (transactional):** Resend or Postmark. Used for magic links, group invitations, and (later) optional notifications. Both have generous free tiers.

**Analytics:** Plausible or PostHog (free tier). Privacy-first analytics — fits the brand. No Google Analytics.

**Errors:** Sentry free tier or BetterStack free tier.

**Languages at launch:** English only. The codebase uses **next-intl** (or similar) so all UI strings live in JSON files. Schema and data are language-neutral. Adding a language later is a translation task, not a refactor. This is critical: it costs almost nothing to set up now and costs a fortune to retrofit later.

**Currency at launch:** Single-currency per group; no FX. Each group picks a currency code at creation. Amounts are just numbers — rent is 1000, the currency code says CAD or USD or KES. No conversion. Multi-currency and FX come later.

**Mobile money / local payment rails:** Not in scope for any phase before Phase 3. Document as future work only.

### Explicitly NOT in this phase

- Bank connection (Plaid/Flinks/Finlego). Phase 3+.
- Virtual card / Stripe Issuing. Phase 3+.
- Paystub scanning via AI. Phase 2.
- AI conversational rule entry. Phase 2 — but rule fragment library design happens at launch to leave the door open.
- Smart settlement netting / sub-grouping. V2.
- Payday-aware scheduling. V2 — schema fields included now.
- Push notifications. Add later when there's something worth notifying about.
- Multi-currency and FX. Phase 2 or 3.
- Mobile money integrations (M-Pesa, UPI, etc.). Phase 3+.
- Native iOS/Android apps. May never be needed — PWA is the plan.
- Data marketplace / anonymized data product. Phase 4 only, if ever.
- Friend-of-friend settlement network. Phase 4.
- Landlord/property manager portal. Out of scope indefinitely.

---

## Section 4 — Screens / Surfaces to Build (Frozen)

Numbered, one line each. This is the launch surface. Not exhaustive of every modal — these are the major navigable surfaces.

1. **Landing page** — `/` — pitch, demo, pricing, sign-up CTA.
2. **Sign-up / sign-in page** — `/auth` — magic link primary, password fallback.
3. **Onboarding flow** — `/onboarding` — first group setup, asks "who do you split money with?" and offers relationship templates.
4. **Dashboard** — `/app` — list of groups, recent expenses, current balances at a glance.
5. **Group / household detail page** — `/app/g/[id]` — members, recent expenses, balances, the active rule set.
6. **Rule builder — entry choice** — `/app/g/[id]/rules/new` — "start from template" / "rule finder" / "start from scratch."
7. **Rule builder — template chooser** — shows 5 templates with brief descriptions and previews.
8. **Rule builder — rule finder (the Akinator flow)** — ~5–7 card-based questions; each shows 4 options + skip; mostly clicking, almost no typing.
9. **Rule builder — manual editor** — full rule object exposed; advanced users can craft anything.
10. **Rule library / rule list for a group** — view, edit, reorder, delete rules. Rules are first-class and reusable.
11. **Add expense flow** — `/app/g/[id]/expenses/new` — amount, who was there, category; rule auto-suggested; one-tap confirm.
12. **Expense detail / edit** — `/app/g/[id]/expenses/[id]` — see/edit a single expense, see which rule applied.
13. **Balances view** — `/app/g/[id]/balances` — pairwise who-owes-whom; "mark as settled" buttons.
14. **Settlement detail** — `/app/g/[id]/settlements/[id]` — record of a settled payment.
15. **Invite / share page** — `/app/g/[id]/invite` — generate a magic link or one-time code to add someone to the group.
16. **Ghost-user view (no signup)** — `/view/[code]` — a public-ish page someone can hit with their one-time code to see their balance in a group, see the rule that applied, mark themselves as paid, and (optional) upgrade to a real account.
17. **Account / settings** — `/app/settings` — name, email, declared income (optional), pay schedule (optional, V2-relevant), preferred currency, language, data sharing preference, account management.
18. **Pricing page** — `/pricing` — Free, Fair ($5/mo), Trip Pass ($4) — even if paywall isn't enforced at launch, the page exists.
19. **Help / FAQ** — `/help` — a few articles at launch; expand as questions come in.
20. **Legal pages** — `/privacy`, `/terms` — boilerplate to start; tighten before charging.

### The five launch templates (referenced in Section 1)

- **Couple, two incomes** — joint expenses prorated by income; opt-in for personal.
- **Roommates, equal split** — all shared bills split equally; rotation optional for groceries.
- **Roommates, income-proportional** — rent and utilities by income; groceries equal; subscriptions equal.
- **Parents + adult working child** — parents prorate by income; child pays fixed amounts on specified bills with overrides.
- **Group trip** — equal splits across all attendees; per-expense opt-outs; settles at end of trip.

### The rule finder question flow (the Akinator)

Approximate order and content. Each question shows ~4 cards plus a skip.

1. **What kind of group is this?** (Household / Trip / Couple / One-time group)
2. **How do you handle rent or housing?** (Equal / By income / One person pays / Fixed amounts each / Skip)
3. **How do you handle utilities?** (Same as rent / Equal / By usage / Skip)
4. **How do you handle groceries?** (Equal / By income / Rotating who pays / Per-trip itemized / Skip)
5. **How do you handle subscriptions and small recurring bills?** (Equal / One person covers / Per-service / Skip)
6. **How do you handle eating out and social?** (Equal / Per-meal itemized / Whoever invites pays / Skip)
7. **Anyone in this group with major exceptions?** (No / One person pays a fixed amount / One person opts out of categories / Yes, custom)

After 5–7 of these, a full rule set is constructed and presented for confirmation. The user can then edit any rule before saving.

---

## Section 5 — Rules for AI Tools Working on This Project

**Read this entire file before starting your step.**

### The Claude Code Rule
Claude Code is the final decider on plan direction. If Cursor or Codex suggests deviating from the plan, Claude Code reviews the suggestion and decides whether to accept, modify, or reject it. Cursor and Codex execute; Claude Code steers.

### The Append-Only Rule
When you update this blueprint, you ADD to it. You do not overwrite earlier content. If the plan changes, write the change as a new addition with a clear marker, leaving the original visible. The ONLY exception is Section 9 (Next Prompt), which gets overwritten each step.

### The Handoff Rule
At the end of every step, you must:
1. Append a Step Log entry (template in Section 7) describing what you did.
2. Note any deviations from the plan and why.
3. If you think the plan should be revised based on what you learned, write the suggestion in the Step Log entry. Mark it as a *suggestion* not a decision. Only Claude Code can accept revisions and append them to Section 8.
4. Overwrite Section 9 with the next prompt for the next AI.
5. Commit (if applicable). Use clear commit messages: `Step N: brief description`.

### The No-Checkpoint Rule (this project specifically)
The founder has chosen to skip UI/design checkpoints during the build. **Do not stop to ask the founder for design approval mid-build.** Build the simplest functional version of each screen and move on. The founder will revise after the project is complete and functional. Functional > polished at this stage.

### The Rules-Are-Everything Rule (this project specifically)
The rule engine is the heart of this product. Spend as much time and care as it takes on Steps 3 through 6 (the rules engine, rule builder, rule finder, templates). Cutting corners here defeats the entire project. By contrast, the dashboard, settings, and most chrome can be deliberately simple.

### The No-Forced-Signup Rule (this project specifically)
The ghost-user / one-time-code / public view feature (Screen 16) is a Phase 1 launch feature, not a growth tactic added later. Build it into the data model and routing from the very first step. Do not require an account to participate in a group.

### The Permission Mode Guidance (Claude Code specifically)
The founder prefers Claude Code to work with minimal interruption. Recommended setup:
- **Default working mode:** `acceptEdits` — cycle to it with `Shift+Tab`. Claude Code edits files without asking but still pauses for bash commands and network operations. Good for normal step work.
- **For trusted long-running steps:** the founder may launch Claude Code with `claude --dangerously-skip-permissions` (a.k.a. bypass mode / YOLO). This skips all permission prompts including bash. Anthropic's docs recommend only using this inside containers, but in practice many solo devs use it in a dedicated project directory with frequent git commits — if anything breaks, `git reset --hard` recovers it. Founder's choice per step.
- **`/permissions` command:** lets you pre-approve specific tool patterns (e.g., `Bash(npm:*)`, `Bash(git:*)`) once per project so they never prompt again. Set these up after Step 1 once the project's command vocabulary stabilizes.
- **Commit early and often.** Every step ends with a commit. If a step is long, intermediate commits are encouraged. This is the rollback safety net.

### The Don't Build Beyond the Step Rule
Each step has a specific goal. Do not extend the step's scope to "fix" things you notice in adjacent areas. Log the observation in the Step Log and let Claude Code decide at the next step whether to incorporate.

---

## Section 6 — Step Plan (Original — Frozen)

11 steps. Heavy emphasis on the rules engine (Steps 3–6). UI/design checkpoints intentionally omitted per founder's instruction.

| Step # | Tool suggested | Goal |
|---|---|---|
| 1 | Claude Code | Repo setup: Next.js + Tailwind + shadcn/ui + Drizzle + Neon + NextAuth scaffolded; deploy to Vercel; landing page placeholder; `/auth` working with magic link + password. |
| 2 | Claude Code | Database schema for everything in Section 1: users, groups, group_members, ghost_users, rules, expenses, expense_participants, settlements, templates, rule_fragments. Drizzle migrations. Seed scripts for the 5 scenarios in Section 2. |
| 3 | Claude Code | **The rules engine core.** Define rule types (equal, percentage, fixed_amount, by_income, itemized, weighted, usage_based, exempt, rotating, subsidized) as discriminated TypeScript unions. Build the rule-application function: given an expense and a set of rules, output the per-participant shares. Unit-tested against the 5 seeded scenarios. No UI yet — this is the engine. |
| 4 | Claude Code | **The rule builder — manual editor + rule library.** Screens 9, 10, 11, 12. Users can create rules from scratch with all parameters exposed. Rules list, edit, reorder. Adding an expense suggests the matching rule. This is functional but not yet pretty — that's fine. |
| 5 | Claude Code | **The rule finder (Akinator flow).** Screen 8. Card-based question flow; ~5–7 questions; produces a complete rule set. Almost no typing. Skippable questions. Result is editable before save. |
| 6 | Claude Code | **Templates.** Screens 6, 7. Five templates from Section 4 fully implemented. Selecting a template instantiates the rule set into a new group. The five seeded scenarios from Step 2 align with these templates. |
| 7 | Cursor | **Dashboard, group detail, balances view.** Screens 4, 5, 13, 14. The visible chrome around the rules engine. Pairwise balance calculation; "mark as settled" buttons. Functional and clean, not designed-with-love. |
| 8 | Claude Code | **The ghost-user / no-signup viewer.** Screens 15, 16. Generate one-time codes; magic-link routes; `/view/[code]` public page; ability for a ghost user to claim their account later. This is the cold-start moat — get it right. |
| 9 | Cursor | **Settings, pricing page, help, legal pages, onboarding polish.** Screens 1, 3, 17, 18, 19, 20. Lots of pages, mostly low-stakes content. Stripe products configured in dashboard but paywall flag OFF. |
| 10 | Codex | **CSV export and a small set of utility scripts:** export a group's expenses and balances as CSV; admin script to reset a group; admin script to dump a user's data (future GDPR readiness). Tight, well-scoped utility work. |
| 11 | Claude Code | **End-to-end review pass.** Walk every screen end-to-end with the 5 seeded scenarios. Fix bugs. Tighten copy where it's egregious. Verify the rules engine handles the Section 0 example (parents + adult working child with internet exception and flat rent) cleanly. Add basic Sentry/PostHog. Write README.md for the repo. Project is launchable. |

---

## Section 7 — Step Log (Append entries here — do not overwrite)

### Step Log entry template

```
### Step N — [Tool used] — [Date]
**What was done:**
- Bullet list of concrete actions

**Files created/changed:**
- `path/to/file`

**Deviations from plan and why:**
- None / [description]

**What I learned that might affect future steps:**
- [observation]

**Plan revision recommendation (optional):**
- [If you think the plan should change, write the suggestion here. Mark it as a *suggestion* not a decision. Claude Code will decide at next step whether to incorporate.]

**Next prompt:** see Section 9 at bottom of file.
```

### Steps 1–6 — Claude Code — 2026-05-23
**What was done:**
- Step 1: Next.js 16 + TS + Tailwind v4 + shadcn-style primitives; Drizzle ORM connected to Neon; Auth.js v5 with Resend magic-link + Credentials email/password; landing, /auth, /auth/check-email, /app routes; first migration applied.
- Step 2: Full DB schema (users, accounts, sessions, verification_tokens, groups, ghost_users, group_members, rules, expenses, expense_participants, settlements, templates, rule_fragments). Drizzle migration applied. Seed script populates 5 named scenarios + 5 templates.
- Step 3: Rules engine in `src/rules/engine.ts` with all 10 split types as a Zod discriminated union. Largest-remainder cent distribution; every split sums exactly to the expense amount. 22 vitest cases including the full Section 0 parents-plus-adult-child scenario (kid pays $500 rent + 50% of internet, utilities between parents by income, groceries exempt) — all green.
- Step 4: Group dashboard, group detail, rule library with priority editing, manual JSON rule editor with Zod validation, expense add flow with rule auto-suggest, expense detail with applied-rule audit, balances stub.
- Step 5: Rule finder (Akinator) at `/app/g/[id]/rules/finder` — 7 server-rendered questions with URL state, preview-and-save flow that compiles answers into a real rule set with notes for any placeholders the user needs to refine.
- Step 6: Template picker at `/app/g/[id]/rules/templates`; 5 launch templates with placeholder binding by name + position; onboarding instantiates a template into a new group with the user as owner and the rest as ghost members.

**Files created/changed:**
- Config: `package.json`, `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `drizzle.config.ts`, `vitest.config.ts`, `.env.local`, `.env.example`, `.gitignore`.
- Auth: `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/types/next-auth.d.ts`.
- DB: `src/db/client.ts`, `src/db/schema.ts`, `src/db/migrate.ts`, `src/db/seed.ts`, `drizzle/0000_init.sql`, `drizzle/0001_full_schema.sql`.
- Rules engine: `src/rules/types.ts`, `src/rules/engine.ts`, `src/rules/engine.test.ts`, `src/rules/templates.ts`, `src/rules/finder.ts`.
- UI primitives: `src/components/ui/{button,input,card,label}.tsx`, `src/lib/{utils,money,groups}.ts`.
- Pages: `src/app/{layout,page,globals.css}.{tsx,css}`, `src/app/auth/{page,check-email/page}.tsx`, `src/app/app/{layout,page}.tsx`, `src/app/app/g/[id]/{page,actions.ts,balances/page,invite/page,rules/{page,new/page,editor/page,templates/page,finder/page},expenses/{new/page,[expenseId]/page}}.tsx`, `src/app/onboarding/page.tsx`.

**Deviations from plan and why:**
- Did Steps 1–6 in one batch instead of separate commits per step. The founder explicitly asked for this. Three commits total: Step 1, Steps 2+3, Steps 4+5+6.
- Built the **balances view** (Screen 13) inside Step 4 even though the plan assigns it to Step 7. The rule engine and expense flow needed something to verify against during build, and the balances roll-up was already implemented as `computeBalances` in the engine. It's a thin view — the polishing in Step 7 will replace it.
- Built the dashboard, group detail, and invite stub (Screens 4, 5, 15) inside Step 4 as well — could not reasonably build "rule library + expense add" without surrounding chrome.
- The Section 0 spec describes parents prorating the mortgage by income *and* the kid paying $500 flat. The launch `parents-plus-adult-child` template models the $500-flat + remainder-equal-between-parents version (simpler, identical outcome when parents have equal incomes). A two-rule version (kid-flat then parents-by-income on the remainder) is a follow-up.
- Used Auth.js v5 **JWT session strategy** instead of database sessions, because Credentials provider in v5 cannot use database sessions. The Drizzle adapter still persists users + verification tokens normally.
- Did not deploy to Vercel — repo is pushed to GitHub but the founder needs to import it into Vercel and add the env vars manually. Walked through the env keys in chat.

**What I learned that might affect future steps:**
- `dotenv/config` does not load `.env.local` by default — Drizzle Kit and seed scripts both needed explicit `dotenv.config({ path: ".env.local" })`. Worth a CLAUDE.md note for future steps.
- The placeholder convention `__key__` inside template parameters is convenient but brittle — Step 8's ghost-user flow will want to formalize it.
- The seeded dev user is `founder@seed.faircutter.dev` / password `faircutter-dev`. Magic-link sign-in won't work until the founder provides a Resend API key; until then, password sign-in is the way in.

**Plan revision recommendation (optional):**
- *Suggestion*: re-scope Step 7 to "polish dashboard, balances, settlements + add settlement actions". The unpolished chrome is already in place from Step 4. Step 7 should add the "mark as settled" buttons and the settlements detail page (Screen 14).
- *Suggestion*: move basic Sentry init from Step 11 forward to a smaller mid-project tap so we catch errors during Step 7-9 build. Optional, low-effort.

**Next prompt:** see Section 9.

### Step 7 — Cursor — 2026-05-23
**What was done:**
- Polished `/app` dashboard: per-group net balance, your share this month, sort by most recent expense activity, empty state links to `/onboarding`.
- Polished `/app/g/[id]`: member initials avatars, your net summary, recent expenses show paid-by, your share, and applied rule name.
- Polished `/app/g/[id]/balances`: pairwise "who owes whom" (greedy simplification from `computeBalances`), inline Settle up forms, net-per-person retained.
- Added settlement server actions (`createSettlement`, `deleteSettlement`) and Screen 14 at `/app/g/[id]/settlements/[id]`.
- Extracted shared balance loading (`loadGroupBalanceContext`) and pairwise debt math (`computePairwiseDebts` in `src/lib/pairwise-debts.ts`).
- Fixed `loadGroupParticipants` to resolve real user display names (not just ghosts).

**Files created/changed:**
- `src/lib/balances.ts`, `src/lib/pairwise-debts.ts`, `src/lib/balances.test.ts`
- `src/lib/groups.ts`
- `src/components/member-avatar.tsx`, `src/components/settle-up-form.tsx`
- `src/app/app/page.tsx`, `src/app/app/g/[id]/page.tsx`, `src/app/app/g/[id]/balances/page.tsx`
- `src/app/app/g/[id]/settlements/[settlementId]/page.tsx`
- `src/app/app/g/[id]/actions.ts`

**Deviations from plan and why:**
- None. Re-scoped polish from Step 4 log was completed as specified (settlements were the main net-new work).

**What I learned that might affect future steps:**
- `computeBalances` returns per-person nets only; pairwise display needs a separate simplifier — kept out of `engine.ts` per Step 7 scope.
- Dashboard loads balance context per group (N+1 queries). Fine for dev; consider a batched query if groups list grows large.

**Plan revision recommendation (optional):**
- None.

**Next prompt:** see Section 9 at bottom of file.

---

## Section 8 — Plan Revisions (Append here — do not overwrite Section 6)

*(No revisions yet. Claude Code appends here only when it has accepted a suggestion from a Step Log entry.)*

---

## Section 9 — Next Prompt (Overwrite this section each step)

**For:** Claude Code
**Step:** 8 — Ghost user / no-signup viewer

### Read first
Before doing anything else, read this entire `BLUEPRINT.md`. Pay particular attention to:
- **Section 0** — No forced signup; ghost users are a launch moat.
- **Section 1** — `ghost_users` table, `accessCode`, claim flow.
- **Section 4** — Screens 15 (invite) and 16 (`/view/[code]`).
- **Section 5** — The No-Forced-Signup Rule. Build into routing and data model; do not defer.
- **Section 6** — Step 8 in the original plan.
- **Section 7** — Step Log through Step 7. Invite page exists as a stub; settlements and balances are live.

### Task
Build the cold-start moat: one-time codes, magic-link routes, and the public ghost viewer.

Concrete deliverables:
1. **Invite page** at `/app/g/[id]/invite` — generate or display each ghost member's `accessCode`; copy link button for `/view/[code]`; short instructions for sharing without forcing signup.
2. **Public ghost view** at `/view/[code]` — no auth required. Show: group name, the ghost's display name, their net balance in the group, recent expenses affecting them (amount + their share), active rules summary. Button to mark a settlement (from them to creditor) if they owe — or link to balances explanation.
3. **Claim flow** — optional CTA on `/view/[code]`: "Create an account to keep history" that links to `/auth` with a return URL; on signup, set `ghost_users.claimed_by_user_id` and re-point `group_members` / expense rows from ghost to user (document exact migration in Step Log).
4. **Server actions** for generating/regenerating access codes (members only) and recording a settlement from the public view (scoped to the ghost's identity via code).
5. **Do not change** the rules engine, rule builder, finder, or templates unless you find a blocking bug — log suggestions in the Step Log.

### Do NOT do in this step
- Do **not** add Stripe, settings polish, or CSV export (Steps 9–10).
- Do **not** add smart netting or push notifications.
- Do **not** redesign the authenticated app chrome beyond what invite/view need.

### End-of-step instructions
1. Append a Step Log entry in Section 7.
2. Overwrite Section 9 with the Step 9 prompt (Cursor — settings, pricing, help, legal, onboarding polish).
3. Commit with message `Step 8: Ghost user viewer` (and `Step 8: Update blueprint` if you update this file in a second commit).
4. Tell the founder you're done.

---

*End of BLUEPRINT.md*
