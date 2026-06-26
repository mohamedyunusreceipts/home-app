# Mortgage / Access-Bond Tracker — Design Spec

**Date:** 2026-06-26
**Status:** Draft for review
**Author:** Rayhaan Yunus (with Claude)
**Module:** new — standalone, built ahead of the spec's planned build order at the user's request.

## 1. Purpose & scope

A module for tracking a South African **access (flexi) bond** shared by a couple. It lets them log their monthly bond statement, see how far *ahead of schedule* they are (their **available redraw**), and run what-if calculators — so they feel comfortable paying extra into the bond and always know how much they could pull back out if needed.

**In scope (v1):**
- One active bond per household.
- Hybrid accuracy model: monthly statement figures are the source of truth; a computed schedule fills the gaps.
- Computed **available redraw** via a shadow "contractual-only" amortisation schedule (the bank does not print this figure).
- Four calculators: bond repayment, extra-payment payoff, available redraw, interest split.
- Optional log of extra deposits / withdrawals, each taggable with which partner contributed.
- A dashboard centred on the redraw number.

**Out of scope (v1):**
- More than one bond per household.
- Automatic statement import / bank integration (manual entry — the user has a statement each month).
- Daily-compounding precision in *projections* (monthly compounding is used; actuals always come from the statement, so the hybrid model absorbs the difference).
- Offset-account modelling (this is an access bond, not an offset).

## 2. Key concepts

- **Access bond:** extra money paid into the bond reduces the interest-bearing balance but remains available to withdraw later (the "redraw").
- **Contractual-only / shadow schedule:** what the balance *would* be if only the contractual instalment had ever been paid. The app maintains this in parallel with reality.
- **Available redraw:** how far ahead of the shadow schedule the real balance is. This is the headline number.

  > **Available redraw = shadow (contractual-only) balance − actual outstanding balance**

  Every extra rand paid widens that gap; the gap is what can be drawn back out.

## 3. Accuracy model (hybrid)

The user's statement shows **outstanding balance, interest charged, and the interest rate** — but **not** an "available to withdraw" figure, so redraw must be computed.

- **Statement = truth.** Each month the user enters the statement figures; the stored balance is the real one.
- **Shadow schedule = projection.** Recomputed from the bond config and the rate history captured on each statement.
- **Reconciliation.** On each statement entry the app recomputes the shadow balance and redraw, and shows a **drift indicator** comparing its previous projection to the actual figure — so the user can trust the dashboard is honest. The rate is captured per statement and editable, so the schedule tracks prime-rate changes.

## 4. Data model

Three tables. Each carries `household_id` and the standard `tenant_isolation` RLS policy (per the foundation spec §4.2). UUID PKs, `timestamptz` timestamps, `created_at`/`updated_at`.

### `mortgages`
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| household_id | uuid fk households | |
| lender | text | e.g. "FNB" |
| account_ref | text null | user reference only |
| original_principal | numeric(14,2) | original loan amount |
| start_date | date | bond start |
| term_months | int | original term |
| contractual_instalment | numeric(14,2) | the required monthly payment |
| current_annual_rate | numeric(6,3) | percent, e.g. 11.250 |
| rate_is_prime_linked | boolean default true | |
| prime_delta | numeric(5,3) null | e.g. -0.500 = prime − 0.5% |

One active bond per household in v1 — enforced by a unique index on `household_id`.

### `mortgage_statements` (the monthly truth)
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| household_id | uuid fk | |
| mortgage_id | uuid fk mortgages | |
| statement_month | date | normalised to the 1st of the month |
| closing_balance | numeric(14,2) | actual outstanding balance |
| interest_charged | numeric(14,2) | interest debited that month |
| annual_rate | numeric(6,3) | rate on the statement |
| total_paid | numeric(14,2) null | optional; total paid that month if known |
| note | text null | |

Unique on `(mortgage_id, statement_month)` — one statement per month; re-entry upserts.

### `mortgage_transactions` (optional extra-payment / withdrawal log)
| Column | Type | Notes |
|---|---|---|
| id | uuid pk | |
| household_id | uuid fk | |
| mortgage_id | uuid fk mortgages | |
| occurred_on | date | |
| amount | numeric(14,2) | positive |
| kind | text | check in ('extra_deposit','withdrawal') |
| contributed_by_user_id | uuid null fk profiles | who put it in; **null = joint** (see §11) |
| note | text null | |

Not required for the core numbers (those come from statements); this table is what makes paying-in / drawing-out feel tangible and supports per-partner attribution.

## 5. Calculation engine

Pure, dependency-free functions in `lib/mortgage/` — no database access, fully unit-tested. Monthly rate `r = annual_rate / 100 / 12`.

1. **`bondInstalment(principal, annualRate, termMonths)`** — standard amortisation instalment `P·r / (1 − (1+r)^−n)`; handles `r = 0`.
2. **`amortisationSchedule(principal, annualRate, termMonths, instalment?)`** — array of `{ month, openingBalance, interest, principalPaid, closingBalance }`, terminating at zero.
3. **`shadowBalance(config, statements, asOfMonth)`** — contractual-only balance: `bal_n = bal_{n-1} + bal_{n-1}·r_n − contractual_instalment`, using each month's actual rate where a statement exists (else current rate), floored at 0.
4. **`availableRedraw(config, statements, asOfMonth)`** — `shadowBalance − actualClosingBalance`, floored at 0.
5. **`extraPaymentPayoff(currentBalance, annualRate, instalment, extraPerMonth)`** — returns `{ monthsToPayoff, payoffDate, totalInterest, monthsSaved, interestSaved }` versus the no-extra baseline.
6. **`interestSplit(balance, annualRate, payment)`** — `{ interest, principal }`. History derives from statements (`interest_charged` is truth; principal = balance delta); future is projected.

**Edge cases:** `r = 0`; bond fully paid (balance 0 → redraw/payoff return "done"); invalid/negative inputs rejected with clear errors.

## 6. Reconciliation flow

Monthly, the user opens **"Add statement"** and enters: month, closing balance, interest charged, rate (and optionally total paid). On save the app upserts by month, recomputes the shadow schedule and redraw, and shows a **drift indicator** (projected closing balance vs the actual one entered).

## 7. Dashboard (the comfort view)

- **Headline:** *Available to redraw right now* — large.
- **Supporting:** outstanding balance · total paid in vs total interest charged (cumulative) · principal paid down (original − actual) · months ahead of schedule.
- **Chart:** actual balance vs shadow schedule over time — the widening gap is the growing cushion.
- **Calculators panel:** the four what-ifs, pre-filled from the current bond.
- **Transactions:** list of extra deposits / withdrawals with contributor; quick "add deposit" / "record withdrawal" actions.

## 8. Routes & components

- `/mortgage` — dashboard (server component; `requireHousehold()`).
- `/mortgage/setup` — create / edit bond config.
- `/mortgage/statements` — list + add monthly statement.
- `/mortgage/calculators` — the four calculators (client components over the pure engine).
- `components/mortgage/*` — UI; `lib/mortgage/*` — engine; co-located `actions.ts` server actions for mutations.

> **Placement:** built standalone at `/mortgage` for now. When the app shell + Money module land (spec §9.1), this becomes the Money module's "Bond" tab and contributes a summary card to the main dashboard. No data migration needed — only route nesting.

## 9. Testing

- **Unit (Vitest):** the engine — instalment, schedule, shadow balance, redraw, extra-payment payoff, interest split, and all edge cases. Pure and fast.
- **Integration (Vitest + local Supabase):** RLS isolation per table (household A cannot read/write household B's mortgage, statements, or transactions); statement upsert uniqueness; one-bond-per-household constraint.
- **Reconciliation fixture:** a known sequence of monthly statements → expected redraw and drift, asserted end-to-end.

## 10. Locale

ZAR currency formatting, `Africa/Johannesburg`, ZA date format (per locked decision #12). Rates shown as percent.

## 11. Open / assumed decisions

- **Per-partner attribution** (`mortgage_transactions.contributed_by_user_id`): **included, nullable** (null = joint). Low cost, supports "what we each put in"; trivially ignorable, and removable if the user prefers a single household pot.
- **One bond per household** in v1 (unique index on `household_id`).
- **Monthly compounding** for projections; statements are the source of truth for actuals.
