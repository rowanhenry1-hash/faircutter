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

*(No entries yet — first entry goes here after Step 1.)*

---

## Section 8 — Plan Revisions (Append here — do not overwrite Section 6)

*(No revisions yet. Claude Code appends here only when it has accepted a suggestion from a Step Log entry.)*

---

## Section 9 — Next Prompt (Overwrite this section each step)

**For:** Claude Code
**Step:** 1 — Repo setup and scaffolding

### Read first
Before doing anything else, read this entire `BLUEPRINT.md`. Pay particular attention to:
- **Section 0** — Why this project exists and who it serves.
- **Section 3** — Exact stack and hosting choices. Do not substitute.
- **Section 5** — Rules for AI tools working on this project. Especially the No-Checkpoint Rule and the No-Forced-Signup Rule.
- **Section 6** — Where this step sits in the overall plan.

### Task
Set up the Faircutter project repo and get the scaffolding working end-to-end. By the end of this step, the founder should be able to: visit a deployed URL, sign in via magic link or email/password, and see a placeholder authenticated dashboard.

Concrete deliverables:
1. **Initialize a Next.js app** (App Router, TypeScript, Tailwind, ESLint).
2. **Install and configure shadcn/ui** with a small starter set of components (Button, Input, Card, Dialog).
3. **Set up Neon Postgres** — the founder will provide a connection string. If they haven't yet, write a `.env.example` with `DATABASE_URL=` and a note to fill it in. Install Drizzle ORM and configure it.
4. **Install and configure NextAuth.js (Auth.js v5)** with both providers enabled: magic link (via email — use Resend or Nodemailer; whichever needs less config) and email+password. Store users in Neon via Drizzle.
5. **Build a minimal landing page at `/`** — just the Faircutter name, a one-line tagline ("Fair splits. Not just equal ones."), and a "Sign in" link. No marketing copy yet.
6. **Build `/auth`** — sign in / sign up form. Magic link as primary CTA, password as secondary.
7. **Build `/app`** — placeholder authenticated dashboard. Just a "Welcome, [name]" and a "Sign out" button. The real dashboard comes in Step 7.
8. **Create the GitHub repo**, push, and deploy to Vercel. Configure environment variables in Vercel. Verify the deployed URL works.
9. **Initialize git with a clean .gitignore**, commit with the message `Step 1: Repo setup and auth scaffolding`.

### Do NOT do in this step
- Do **not** create the database schema beyond what NextAuth needs for users/sessions. The full schema is Step 2.
- Do **not** build any of the rules engine. That's Step 3.
- Do **not** build any of the real product screens (dashboard, groups, expenses). Step 1 is auth + a placeholder.
- Do **not** ask the founder for design opinions. Use shadcn/ui defaults. Functional > pretty for now.
- Do **not** add Stripe integration yet — Step 9 handles that.
- Do **not** set up i18n / next-intl yet — Step 9 handles content/copy/legal.

### End-of-step instructions
1. Append a Step Log entry in Section 7 of this file describing what you built, what files you created, any deviations, and what you learned.
2. If you have a plan revision suggestion, note it in the Step Log entry as a *suggestion* — do not modify Section 6.
3. Overwrite this Section 9 with the next prompt for **Step 2 (Claude Code — Database schema and seeds)**. Include all the same fields: For / Step / Read first / Task / Do NOT do / End-of-step instructions.
4. Commit the blueprint update separately with message `Step 1: Update blueprint`.
5. Tell the founder you're done and what the deployed URL is.

---

*End of BLUEPRINT.md*
