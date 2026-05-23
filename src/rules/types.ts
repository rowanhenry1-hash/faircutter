/**
 * Rule types as discriminated unions.
 *
 * The rule engine consumes Rule values and produces a Split: { participantId,
 * shareAmount, isExempt, reason }[] for any given Expense.
 *
 * Money is always integer minor units (cents). No floats anywhere.
 *
 * Every rule parameter is fully serializable (no Dates, no Maps, no functions)
 * so it round-trips through JSONB in `rules.parameters` losslessly.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Common types
// ---------------------------------------------------------------------------

/** A participant id is either a real userId or a ghostUserId. */
export type ParticipantId = string;

export type Participant = {
  id: ParticipantId;
  kind: "user" | "ghost";
  /** Displayed in audit explanations. Not used in math. */
  displayName: string;
  /** Snapshotted at the time of joining; minor units per month. */
  declaredIncome?: number;
};

export type Expense = {
  id?: string;
  amount: number; // minor units
  currency: string;
  category: string;
  description?: string;
  /** Who paid. Reference to a participant id. */
  paidBy: ParticipantId;
  /** Who is in the room for this expense. Empty = everyone in the group. */
  attendees?: ParticipantId[];
};

export type Share = {
  participantId: ParticipantId;
  shareAmount: number;
  isExempt: boolean;
  reason: string;
};

export type Split = {
  ruleId: string | null;
  ruleName: string;
  shares: Share[];
};

// ---------------------------------------------------------------------------
// Per-rule parameter schemas
// ---------------------------------------------------------------------------

const equalParams = z.object({
  /** Optional whitelist; if absent, all attendees split equally. */
  participantIds: z.array(z.string()).optional(),
});

const percentageParams = z.object({
  /** Must sum to exactly 10000 (basis points; 100% = 10000). */
  percentages: z.array(
    z.object({
      participantId: z.string(),
      basisPoints: z.number().int().min(0).max(10000),
    }),
  ),
});

const fixedAmountParams = z.object({
  /** Each entry is minor units. Remainder (if any) is split among `remainderTo`. */
  amounts: z.array(
    z.object({
      participantId: z.string(),
      amount: z.number().int().min(0),
    }),
  ),
  /** Whose share absorbs the remainder. Defaults to "rest_equally". */
  remainderTo: z
    .union([z.literal("rest_equally"), z.string()])
    .optional()
    .default("rest_equally"),
});

const byIncomeParams = z.object({
  /** Restrict prorating to this subset; otherwise all attendees with income > 0. */
  participantIds: z.array(z.string()).optional(),
  /** Anyone whose share would otherwise be > 0 but is listed here is set to 0. */
  excludeIds: z.array(z.string()).optional(),
});

const itemizedParams = z.object({
  /** Each line item is split among the listed participants equally. */
  items: z.array(
    z.object({
      label: z.string(),
      amount: z.number().int().min(0),
      participantIds: z.array(z.string()),
    }),
  ),
});

const weightedParams = z.object({
  weights: z.array(
    z.object({
      participantId: z.string(),
      weight: z.number().int().min(0),
    }),
  ),
});

const usageBasedParams = z.object({
  /** e.g. nights stayed, km driven. Integers only. */
  usage: z.array(
    z.object({
      participantId: z.string(),
      units: z.number().int().min(0),
    }),
  ),
  unitLabel: z.string().optional(),
});

const exemptParams = z.object({
  /** These participants are excluded from the split; the rest split via fallback. */
  exemptIds: z.array(z.string()),
  /** What to do with the remaining attendees: "equal" (default) or "by_income". */
  fallback: z.enum(["equal", "by_income"]).optional().default("equal"),
});

const rotatingParams = z.object({
  /** Ordered list of participant ids who take turns paying. */
  rotationOrder: z.array(z.string()).min(1),
  /** 0-based index of whose turn it currently is. The engine doesn't advance it;
   *  the app layer increments after the expense is confirmed. */
  currentIndex: z.number().int().min(0),
});

const subsidizedParams = z.object({
  /** The "subsidizer" pays subsidizerAmount (minor units or basisPoints of total). */
  subsidizerId: z.string(),
  /** Pick exactly one. */
  subsidizerAmount: z.number().int().min(0).optional(),
  subsidizerBasisPoints: z.number().int().min(0).max(10000).optional(),
  /** How the remainder splits among the other participants. */
  remainder: z.enum(["equal", "by_income"]).default("equal"),
  /** Optional subset of attendees that participate. */
  participantIds: z.array(z.string()).optional(),
});

// ---------------------------------------------------------------------------
// Discriminated union
// ---------------------------------------------------------------------------

export const splitTypes = [
  "equal",
  "percentage",
  "fixed_amount",
  "by_income",
  "itemized",
  "weighted",
  "usage_based",
  "exempt",
  "rotating",
  "subsidized",
] as const;
export type SplitType = (typeof splitTypes)[number];

export const ruleSchema = z.discriminatedUnion("splitType", [
  z.object({
    id: z.string().optional(),
    name: z.string(),
    priority: z.number().int(),
    appliesToCategories: z.array(z.string()),
    splitType: z.literal("equal"),
    parameters: equalParams,
  }),
  z.object({
    id: z.string().optional(),
    name: z.string(),
    priority: z.number().int(),
    appliesToCategories: z.array(z.string()),
    splitType: z.literal("percentage"),
    parameters: percentageParams,
  }),
  z.object({
    id: z.string().optional(),
    name: z.string(),
    priority: z.number().int(),
    appliesToCategories: z.array(z.string()),
    splitType: z.literal("fixed_amount"),
    parameters: fixedAmountParams,
  }),
  z.object({
    id: z.string().optional(),
    name: z.string(),
    priority: z.number().int(),
    appliesToCategories: z.array(z.string()),
    splitType: z.literal("by_income"),
    parameters: byIncomeParams,
  }),
  z.object({
    id: z.string().optional(),
    name: z.string(),
    priority: z.number().int(),
    appliesToCategories: z.array(z.string()),
    splitType: z.literal("itemized"),
    parameters: itemizedParams,
  }),
  z.object({
    id: z.string().optional(),
    name: z.string(),
    priority: z.number().int(),
    appliesToCategories: z.array(z.string()),
    splitType: z.literal("weighted"),
    parameters: weightedParams,
  }),
  z.object({
    id: z.string().optional(),
    name: z.string(),
    priority: z.number().int(),
    appliesToCategories: z.array(z.string()),
    splitType: z.literal("usage_based"),
    parameters: usageBasedParams,
  }),
  z.object({
    id: z.string().optional(),
    name: z.string(),
    priority: z.number().int(),
    appliesToCategories: z.array(z.string()),
    splitType: z.literal("exempt"),
    parameters: exemptParams,
  }),
  z.object({
    id: z.string().optional(),
    name: z.string(),
    priority: z.number().int(),
    appliesToCategories: z.array(z.string()),
    splitType: z.literal("rotating"),
    parameters: rotatingParams,
  }),
  z.object({
    id: z.string().optional(),
    name: z.string(),
    priority: z.number().int(),
    appliesToCategories: z.array(z.string()),
    splitType: z.literal("subsidized"),
    parameters: subsidizedParams,
  }),
]);

export type Rule = z.infer<typeof ruleSchema>;
export type EqualRule = Extract<Rule, { splitType: "equal" }>;
export type PercentageRule = Extract<Rule, { splitType: "percentage" }>;
export type FixedAmountRule = Extract<Rule, { splitType: "fixed_amount" }>;
export type ByIncomeRule = Extract<Rule, { splitType: "by_income" }>;
export type ItemizedRule = Extract<Rule, { splitType: "itemized" }>;
export type WeightedRule = Extract<Rule, { splitType: "weighted" }>;
export type UsageBasedRule = Extract<Rule, { splitType: "usage_based" }>;
export type ExemptRule = Extract<Rule, { splitType: "exempt" }>;
export type RotatingRule = Extract<Rule, { splitType: "rotating" }>;
export type SubsidizedRule = Extract<Rule, { splitType: "subsidized" }>;
