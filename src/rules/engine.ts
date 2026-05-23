/**
 * Rule engine — the heart of Faircutter.
 *
 * Given a list of rules (already loaded for a group, ordered by priority) and
 * an Expense, returns a Split with per-participant shares. Money math is
 * exclusively in integer minor units; every split sums **exactly** to the
 * expense amount with no penny-level rounding drift.
 *
 * Rule selection:
 *   - Rules are scanned by ascending `priority`.
 *   - First rule whose `appliesToCategories` matches (or is empty) wins.
 *   - If nothing matches, falls back to equal split among attendees.
 *
 * Remainder handling:
 *   - When proportional math leaves cents on the table, those cents go to
 *     participants in a deterministic order (largest remainder method).
 *     Same inputs always give the same shares.
 */
import type {
  ByIncomeRule,
  EqualRule,
  ExemptRule,
  Expense,
  FixedAmountRule,
  ItemizedRule,
  Participant,
  ParticipantId,
  PercentageRule,
  RotatingRule,
  Rule,
  Share,
  Split,
  SubsidizedRule,
  UsageBasedRule,
  WeightedRule,
} from "./types";

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export function applyRules(args: {
  rules: Rule[];
  participants: Participant[];
  expense: Expense;
}): Split {
  const { rules, participants, expense } = args;

  const matching = selectRule(rules, expense);
  if (!matching) {
    return {
      ruleId: null,
      ruleName: "Equal split (fallback)",
      shares: equalSplit(
        participantsForExpense(participants, expense).map((p) => p.id),
        expense.amount,
      ),
    };
  }

  const shares = applyOne(matching, participants, expense);
  return {
    ruleId: matching.id ?? null,
    ruleName: matching.name,
    shares,
  };
}

/** Visible for testing: find the rule that should apply, ignoring fallbacks. */
export function selectRule(rules: Rule[], expense: Expense): Rule | null {
  const sorted = [...rules].sort((a, b) => a.priority - b.priority);
  for (const r of sorted) {
    if (
      r.appliesToCategories.length === 0 ||
      r.appliesToCategories.includes(expense.category)
    ) {
      return r;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

function applyOne(
  rule: Rule,
  participants: Participant[],
  expense: Expense,
): Share[] {
  switch (rule.splitType) {
    case "equal":
      return applyEqual(rule, participants, expense);
    case "percentage":
      return applyPercentage(rule, expense);
    case "fixed_amount":
      return applyFixedAmount(rule, participants, expense);
    case "by_income":
      return applyByIncome(rule, participants, expense);
    case "itemized":
      return applyItemized(rule, expense);
    case "weighted":
      return applyWeighted(rule, expense);
    case "usage_based":
      return applyUsageBased(rule, expense);
    case "exempt":
      return applyExempt(rule, participants, expense);
    case "rotating":
      return applyRotating(rule, expense);
    case "subsidized":
      return applySubsidized(rule, participants, expense);
  }
}

// ---------------------------------------------------------------------------
// Strategies
// ---------------------------------------------------------------------------

function applyEqual(
  rule: EqualRule,
  participants: Participant[],
  expense: Expense,
): Share[] {
  const ids =
    rule.parameters.participantIds && rule.parameters.participantIds.length > 0
      ? rule.parameters.participantIds
      : participantsForExpense(participants, expense).map((p) => p.id);
  return equalSplit(ids, expense.amount, `Equal share (${rule.name})`);
}

function applyPercentage(rule: PercentageRule, expense: Expense): Share[] {
  const totalBp = rule.parameters.percentages.reduce(
    (s, p) => s + p.basisPoints,
    0,
  );
  if (totalBp !== 10000) {
    throw new RuleError(
      `Percentage rule "${rule.name}" basis points sum to ${totalBp}, expected 10000.`,
    );
  }
  const raw = rule.parameters.percentages.map((p) => ({
    participantId: p.participantId,
    base: Math.floor((expense.amount * p.basisPoints) / 10000),
    bp: p.basisPoints,
  }));
  const distributed = distributeRemainder(
    raw.map((r) => ({ id: r.participantId, base: r.base, weight: r.bp })),
    expense.amount,
  );
  return distributed.map((d) => ({
    participantId: d.id,
    shareAmount: d.amount,
    isExempt: false,
    reason: `${(d.weight / 100).toFixed(2)}% per ${rule.name}`,
  }));
}

function applyFixedAmount(
  rule: FixedAmountRule,
  participants: Participant[],
  expense: Expense,
): Share[] {
  const fixed = rule.parameters.amounts;
  const fixedSum = fixed.reduce((s, x) => s + x.amount, 0);

  if (fixedSum > expense.amount) {
    throw new RuleError(
      `Fixed amounts (${fixedSum}) exceed expense amount (${expense.amount}) in rule "${rule.name}".`,
    );
  }

  const remainder = expense.amount - fixedSum;
  const shares: Share[] = fixed.map((f) => ({
    participantId: f.participantId,
    shareAmount: f.amount,
    isExempt: false,
    reason: `Fixed ${f.amount} per ${rule.name}`,
  }));

  if (remainder === 0) return shares;

  const remainderTo = rule.parameters.remainderTo ?? "rest_equally";
  if (remainderTo === "rest_equally") {
    const fixedIds = new Set(fixed.map((f) => f.participantId));
    const rest = participantsForExpense(participants, expense)
      .map((p) => p.id)
      .filter((id) => !fixedIds.has(id));
    if (rest.length === 0) {
      // Nobody to absorb — give it back to the fixed-amount participants
      // proportionally to keep math exact.
      const adj = distributeRemainder(
        shares.map((s) => ({ id: s.participantId, base: s.shareAmount, weight: 1 })),
        expense.amount,
      );
      return shares.map((s) => ({
        ...s,
        shareAmount: adj.find((a) => a.id === s.participantId)!.amount,
      }));
    }
    const restShares = equalSplit(rest, remainder, `Remainder of ${rule.name}`);
    return [...shares, ...restShares];
  } else {
    // Single named participant absorbs the remainder.
    const targetId = remainderTo;
    return [
      ...shares,
      {
        participantId: targetId,
        shareAmount: remainder,
        isExempt: false,
        reason: `Remainder absorbed per ${rule.name}`,
      },
    ];
  }
}

function applyByIncome(
  rule: ByIncomeRule,
  participants: Participant[],
  expense: Expense,
): Share[] {
  const attendees = participantsForExpense(participants, expense);

  const candidatePool =
    rule.parameters.participantIds && rule.parameters.participantIds.length > 0
      ? attendees.filter((p) =>
          rule.parameters.participantIds!.includes(p.id),
        )
      : attendees;

  const excluded = new Set(rule.parameters.excludeIds ?? []);
  const eligible = candidatePool.filter(
    (p) => !excluded.has(p.id) && (p.declaredIncome ?? 0) > 0,
  );

  if (eligible.length === 0) {
    throw new RuleError(
      `By-income rule "${rule.name}" has no participants with declared income.`,
    );
  }

  const totalIncome = eligible.reduce(
    (s, p) => s + (p.declaredIncome ?? 0),
    0,
  );

  const raw = eligible.map((p) => ({
    id: p.id,
    base: Math.floor(
      (expense.amount * (p.declaredIncome ?? 0)) / totalIncome,
    ),
    weight: p.declaredIncome ?? 0,
  }));

  const distributed = distributeRemainder(raw, expense.amount);

  const shares: Share[] = distributed.map((d) => {
    const person = eligible.find((p) => p.id === d.id)!;
    const pct = ((person.declaredIncome! / totalIncome) * 100).toFixed(1);
    return {
      participantId: d.id,
      shareAmount: d.amount,
      isExempt: false,
      reason: `${pct}% by income (${rule.name})`,
    };
  });

  // Add zero-share rows for excluded participants so the audit trail is honest.
  for (const e of [...excluded]) {
    shares.push({
      participantId: e,
      shareAmount: 0,
      isExempt: true,
      reason: `Excluded by ${rule.name}`,
    });
  }

  return shares;
}

function applyItemized(rule: ItemizedRule, expense: Expense): Share[] {
  const itemsSum = rule.parameters.items.reduce((s, i) => s + i.amount, 0);
  if (itemsSum !== expense.amount) {
    throw new RuleError(
      `Itemized rule "${rule.name}" items sum to ${itemsSum}, but expense is ${expense.amount}.`,
    );
  }

  const acc = new Map<ParticipantId, { amount: number; reasons: string[] }>();
  for (const item of rule.parameters.items) {
    const share = equalSplit(item.participantIds, item.amount, item.label);
    for (const s of share) {
      const entry = acc.get(s.participantId) ?? { amount: 0, reasons: [] };
      entry.amount += s.shareAmount;
      entry.reasons.push(`${item.label}: ${s.shareAmount}`);
      acc.set(s.participantId, entry);
    }
  }

  return [...acc.entries()].map(([id, v]) => ({
    participantId: id,
    shareAmount: v.amount,
    isExempt: false,
    reason: v.reasons.join("; "),
  }));
}

function applyWeighted(rule: WeightedRule, expense: Expense): Share[] {
  const totalWeight = rule.parameters.weights.reduce((s, w) => s + w.weight, 0);
  if (totalWeight === 0) {
    throw new RuleError(`Weighted rule "${rule.name}" total weight is 0.`);
  }
  const raw = rule.parameters.weights.map((w) => ({
    id: w.participantId,
    base: Math.floor((expense.amount * w.weight) / totalWeight),
    weight: w.weight,
  }));
  const distributed = distributeRemainder(raw, expense.amount);
  return distributed.map((d) => ({
    participantId: d.id,
    shareAmount: d.amount,
    isExempt: false,
    reason: `Weight ${d.weight}/${totalWeight} (${rule.name})`,
  }));
}

function applyUsageBased(rule: UsageBasedRule, expense: Expense): Share[] {
  const totalUnits = rule.parameters.usage.reduce((s, u) => s + u.units, 0);
  if (totalUnits === 0) {
    throw new RuleError(
      `Usage-based rule "${rule.name}" has zero total units.`,
    );
  }
  const raw = rule.parameters.usage.map((u) => ({
    id: u.participantId,
    base: Math.floor((expense.amount * u.units) / totalUnits),
    weight: u.units,
  }));
  const distributed = distributeRemainder(raw, expense.amount);
  const label = rule.parameters.unitLabel ?? "units";
  return distributed.map((d) => ({
    participantId: d.id,
    shareAmount: d.amount,
    isExempt: false,
    reason: `${d.weight} ${label} of ${totalUnits} (${rule.name})`,
  }));
}

function applyExempt(
  rule: ExemptRule,
  participants: Participant[],
  expense: Expense,
): Share[] {
  const exempt = new Set(rule.parameters.exemptIds);
  const attendees = participantsForExpense(participants, expense);
  const remaining = attendees.filter((p) => !exempt.has(p.id));

  if (remaining.length === 0) {
    throw new RuleError(
      `Exempt rule "${rule.name}" excluded every attendee.`,
    );
  }

  const fallback = rule.parameters.fallback ?? "equal";
  let shares: Share[];
  if (fallback === "equal") {
    shares = equalSplit(
      remaining.map((p) => p.id),
      expense.amount,
      `Split among non-exempt (${rule.name})`,
    );
  } else {
    // Reuse by_income with the remaining pool.
    shares = applyByIncome(
      {
        ...rule,
        splitType: "by_income",
        parameters: { participantIds: remaining.map((p) => p.id) },
      } as unknown as ByIncomeRule,
      participants,
      expense,
    );
  }

  for (const e of rule.parameters.exemptIds) {
    shares.push({
      participantId: e,
      shareAmount: 0,
      isExempt: true,
      reason: `Exempt by ${rule.name}`,
    });
  }
  return shares;
}

function applyRotating(rule: RotatingRule, expense: Expense): Share[] {
  const idx = rule.parameters.currentIndex % rule.parameters.rotationOrder.length;
  const payerId = rule.parameters.rotationOrder[idx];
  const others = rule.parameters.rotationOrder.filter((_, i) => i !== idx);
  return [
    {
      participantId: payerId,
      shareAmount: expense.amount,
      isExempt: false,
      reason: `Their turn in ${rule.name}`,
    },
    ...others.map((id) => ({
      participantId: id,
      shareAmount: 0,
      isExempt: true,
      reason: `Not their turn in ${rule.name}`,
    })),
  ];
}

function applySubsidized(
  rule: SubsidizedRule,
  participants: Participant[],
  expense: Expense,
): Share[] {
  const { subsidizerId, subsidizerAmount, subsidizerBasisPoints, remainder } =
    rule.parameters;

  let subAmount: number;
  if (subsidizerAmount != null) {
    subAmount = subsidizerAmount;
  } else if (subsidizerBasisPoints != null) {
    subAmount = Math.floor((expense.amount * subsidizerBasisPoints) / 10000);
  } else {
    throw new RuleError(
      `Subsidized rule "${rule.name}" needs either subsidizerAmount or subsidizerBasisPoints.`,
    );
  }
  subAmount = Math.min(subAmount, expense.amount);

  const rest = expense.amount - subAmount;
  const attendees = participantsForExpense(participants, expense);
  const pool = (
    rule.parameters.participantIds && rule.parameters.participantIds.length > 0
      ? attendees.filter((p) => rule.parameters.participantIds!.includes(p.id))
      : attendees
  ).filter((p) => p.id !== subsidizerId);

  if (pool.length === 0 && rest > 0) {
    // Nobody to absorb the remainder; give it back to the subsidizer.
    return [
      {
        participantId: subsidizerId,
        shareAmount: expense.amount,
        isExempt: false,
        reason: `Subsidized fully by ${rule.name}`,
      },
    ];
  }

  let restShares: Share[];
  if (remainder === "by_income") {
    restShares = applyByIncome(
      {
        id: "synthetic",
        name: `${rule.name} remainder`,
        priority: 0,
        appliesToCategories: [],
        splitType: "by_income",
        parameters: { participantIds: pool.map((p) => p.id) },
      },
      participants,
      { ...expense, amount: rest },
    );
  } else {
    restShares = equalSplit(
      pool.map((p) => p.id),
      rest,
      `Remainder of ${rule.name}`,
    );
  }

  return [
    {
      participantId: subsidizerId,
      shareAmount: subAmount,
      isExempt: false,
      reason: `Subsidy ${subAmount} per ${rule.name}`,
    },
    ...restShares,
  ];
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function participantsForExpense(
  participants: Participant[],
  expense: Expense,
): Participant[] {
  if (!expense.attendees || expense.attendees.length === 0) return participants;
  const set = new Set(expense.attendees);
  return participants.filter((p) => set.has(p.id));
}

export function equalSplit(
  ids: ParticipantId[],
  total: number,
  reason = "Equal share",
): Share[] {
  if (ids.length === 0) return [];
  const base = Math.floor(total / ids.length);
  let remainder = total - base * ids.length;
  // Deterministic order: sort by id so the same inputs always assign the
  // extra penny to the same participant.
  const sorted = [...ids].sort();
  const result: Share[] = sorted.map((id) => ({
    participantId: id,
    shareAmount: base,
    isExempt: false,
    reason,
  }));
  for (let i = 0; i < remainder; i++) {
    result[i].shareAmount += 1;
  }
  // Preserve the caller's order in the final output.
  return ids.map((id) => result.find((s) => s.participantId === id)!);
}

/**
 * Largest-remainder method: given base allocations that under-fill the target,
 * give the leftover pennies to the entries with the largest fractional
 * remainder, ties broken by deterministic id sort.
 */
function distributeRemainder(
  entries: { id: string; base: number; weight: number }[],
  target: number,
): { id: string; amount: number; weight: number }[] {
  const baseSum = entries.reduce((s, e) => s + e.base, 0);
  const leftover = target - baseSum;
  if (leftover === 0) {
    return entries.map((e) => ({ id: e.id, amount: e.base, weight: e.weight }));
  }
  // Fractional remainder is proportional to weight; rank by (weight desc, id asc).
  const ranked = [...entries].sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return a.id < b.id ? -1 : 1;
  });
  const result = new Map(
    entries.map((e) => [e.id, { id: e.id, amount: e.base, weight: e.weight }]),
  );
  for (let i = 0; i < leftover; i++) {
    const rec = ranked[i % ranked.length];
    result.get(rec.id)!.amount += 1;
  }
  // Preserve original order.
  return entries.map((e) => result.get(e.id)!);
}

export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RuleError";
  }
}

// ---------------------------------------------------------------------------
// Balance helpers
// ---------------------------------------------------------------------------

/**
 * Net pairwise balances from a list of expenses + their splits + settlements.
 * Positive means owed-to, negative means owes.
 */
export function computeBalances(args: {
  participants: Participant[];
  expenses: Array<{
    amount: number;
    paidBy: ParticipantId;
    split: Share[];
  }>;
  settlements: Array<{
    from: ParticipantId;
    to: ParticipantId;
    amount: number;
  }>;
}): Map<ParticipantId, number> {
  const balance = new Map<ParticipantId, number>();
  for (const p of args.participants) balance.set(p.id, 0);

  for (const e of args.expenses) {
    balance.set(e.paidBy, (balance.get(e.paidBy) ?? 0) + e.amount);
    for (const s of e.split) {
      balance.set(s.participantId, (balance.get(s.participantId) ?? 0) - s.shareAmount);
    }
  }

  for (const s of args.settlements) {
    balance.set(s.from, (balance.get(s.from) ?? 0) + s.amount);
    balance.set(s.to, (balance.get(s.to) ?? 0) - s.amount);
  }

  return balance;
}
