/**
 * Rule finder — the Akinator-style question flow.
 *
 * Each question has ~4 card answers + a skip. Answers are accumulated into a
 * `FinderAnswers` object which maps to a concrete `Rule[]` via
 * `compileFinderAnswers`. The compiler runs server-side on confirm.
 *
 * Question content is the launch list from BLUEPRINT.md Section 4.
 */
import type { Rule, SplitType } from "./types";

export type FinderQuestionId =
  | "kind"
  | "housing"
  | "utilities"
  | "groceries"
  | "subscriptions"
  | "social"
  | "exceptions";

export type FinderAnswer = {
  /** The card label. */
  label: string;
  /** The split type implied by this answer (or 'skip'). */
  splitType: SplitType | "skip" | "rotating_skip";
  /** Optional extra params for the compiler. */
  extras?: Record<string, unknown>;
};

export type FinderQuestion = {
  id: FinderQuestionId;
  question: string;
  cards: FinderAnswer[];
};

export const FINDER_QUESTIONS: FinderQuestion[] = [
  {
    id: "kind",
    question: "What kind of group is this?",
    cards: [
      { label: "Household", splitType: "skip", extras: { groupKind: "household" } },
      { label: "Trip", splitType: "skip", extras: { groupKind: "trip" } },
      { label: "Couple", splitType: "skip", extras: { groupKind: "couple" } },
      { label: "One-time group", splitType: "skip", extras: { groupKind: "one_time" } },
    ],
  },
  {
    id: "housing",
    question: "How do you handle rent or housing?",
    cards: [
      { label: "Equal", splitType: "equal" },
      { label: "By income", splitType: "by_income" },
      { label: "One person pays it all", splitType: "fixed_amount", extras: { mode: "one_pays_all" } },
      { label: "Fixed amounts each", splitType: "fixed_amount", extras: { mode: "fixed_each" } },
    ],
  },
  {
    id: "utilities",
    question: "How do you handle utilities?",
    cards: [
      { label: "Same as rent", splitType: "skip", extras: { copyFrom: "housing" } },
      { label: "Equal", splitType: "equal" },
      { label: "By usage", splitType: "usage_based" },
    ],
  },
  {
    id: "groceries",
    question: "How do you handle groceries?",
    cards: [
      { label: "Equal", splitType: "equal" },
      { label: "By income", splitType: "by_income" },
      { label: "Rotating who pays", splitType: "rotating" },
      { label: "Per-trip itemized", splitType: "itemized" },
    ],
  },
  {
    id: "subscriptions",
    question: "How do you handle subscriptions and small recurring bills?",
    cards: [
      { label: "Equal", splitType: "equal" },
      { label: "One person covers", splitType: "fixed_amount", extras: { mode: "one_pays_all" } },
      { label: "Per service", splitType: "skip", extras: { perService: true } },
    ],
  },
  {
    id: "social",
    question: "How do you handle eating out and social?",
    cards: [
      { label: "Equal", splitType: "equal" },
      { label: "Per-meal itemized", splitType: "itemized" },
      { label: "Whoever invites pays", splitType: "rotating" },
    ],
  },
  {
    id: "exceptions",
    question: "Anyone in this group with major exceptions?",
    cards: [
      { label: "No", splitType: "skip" },
      { label: "One person pays a fixed amount", splitType: "fixed_amount", extras: { exception: "fixed" } },
      { label: "One person opts out of categories", splitType: "exempt" },
      { label: "Custom (we'll edit after)", splitType: "skip", extras: { exception: "custom" } },
    ],
  },
];

export type FinderAnswers = Partial<
  Record<FinderQuestionId, { cardIndex: number; skipped: boolean }>
>;

export type CompiledRuleSet = {
  rules: Rule[];
  notes: string[];
};

/**
 * Compile finder answers into a real `Rule[]` set. Participant ids are
 * resolved at the moment of finalize on the server; we keep this function
 * pure by accepting the participant id list.
 */
export function compileFinderAnswers(
  answers: FinderAnswers,
  participantIds: string[],
): CompiledRuleSet {
  const rules: Rule[] = [];
  const notes: string[] = [];
  let priority = 1;

  const cardOf = (id: FinderQuestionId): FinderAnswer | null => {
    const a = answers[id];
    if (!a || a.skipped) return null;
    return FINDER_QUESTIONS.find((q) => q.id === id)?.cards[a.cardIndex] ?? null;
  };

  // Housing
  const housing = cardOf("housing");
  if (housing && housing.splitType !== "skip") {
    rules.push(
      ruleFor("Housing", housing, ["rent"], priority++, participantIds, notes),
    );
  }

  // Utilities
  const utilities = cardOf("utilities");
  if (utilities) {
    if (utilities.extras?.copyFrom === "housing" && housing) {
      rules.push(
        ruleFor("Utilities (same as housing)", housing, ["utilities"], priority++, participantIds, notes),
      );
    } else if (utilities.splitType !== "skip") {
      rules.push(
        ruleFor("Utilities", utilities, ["utilities"], priority++, participantIds, notes),
      );
    }
  }

  // Groceries
  const groceries = cardOf("groceries");
  if (groceries && groceries.splitType !== "skip") {
    rules.push(
      ruleFor("Groceries", groceries, ["groceries"], priority++, participantIds, notes),
    );
  }

  // Subscriptions
  const subs = cardOf("subscriptions");
  if (subs && subs.splitType !== "skip") {
    rules.push(
      ruleFor("Subscriptions", subs, ["subscriptions"], priority++, participantIds, notes),
    );
  } else if (subs?.extras?.perService) {
    notes.push(
      "Per-service: we left subscriptions to one-off rules. Add them by category later.",
    );
  }

  // Social
  const social = cardOf("social");
  if (social && social.splitType !== "skip") {
    rules.push(
      ruleFor("Dining and social", social, ["dining", "social"], priority++, participantIds, notes),
    );
  }

  // Exceptions — for now we leave a note. The full exception editor opens
  // post-finder for the user to refine.
  const exceptions = cardOf("exceptions");
  if (exceptions && exceptions.extras?.exception) {
    notes.push(
      "You said there's an exception. We'll add a placeholder rule — you'll want to edit it next.",
    );
    if (exceptions.splitType === "exempt") {
      rules.push({
        name: "Exception placeholder",
        priority: priority++,
        appliesToCategories: [],
        splitType: "exempt",
        parameters: {
          exemptIds: [participantIds[0]],
          fallback: "equal",
        },
      });
    } else if (exceptions.splitType === "fixed_amount") {
      rules.push({
        name: "Exception placeholder",
        priority: priority++,
        appliesToCategories: [],
        splitType: "fixed_amount",
        parameters: {
          amounts: [{ participantId: participantIds[0], amount: 0 }],
          remainderTo: "rest_equally",
        },
      });
    }
  }

  // Fallback rule for any uncovered category.
  rules.push({
    name: "Anything else equal",
    priority: 1000,
    appliesToCategories: [],
    splitType: "equal",
    parameters: {},
  });

  return { rules, notes };
}

function ruleFor(
  baseName: string,
  card: FinderAnswer,
  categories: string[],
  priority: number,
  participantIds: string[],
  notes: string[],
): Rule {
  const base = {
    name: `${baseName} — ${card.label}`,
    priority,
    appliesToCategories: categories,
  };

  switch (card.splitType) {
    case "equal":
      return { ...base, splitType: "equal", parameters: {} };
    case "by_income":
      return { ...base, splitType: "by_income", parameters: {} };
    case "fixed_amount": {
      if (card.extras?.mode === "one_pays_all") {
        return {
          ...base,
          splitType: "fixed_amount",
          parameters: {
            amounts: participantIds
              .slice(1)
              .map((id) => ({ participantId: id, amount: 0 })),
            remainderTo: participantIds[0],
          },
        };
      }
      // mode === "fixed_each" — start with zeros, user edits after.
      notes.push(
        "Fixed amounts: we created a placeholder with 0 for each member. Edit the amounts in the rule editor.",
      );
      return {
        ...base,
        splitType: "fixed_amount",
        parameters: {
          amounts: participantIds.map((id) => ({ participantId: id, amount: 0 })),
          remainderTo: "rest_equally",
        },
      };
    }
    case "usage_based":
      notes.push(
        "Usage-based utilities: we created a placeholder. Edit the usage counts in the rule editor.",
      );
      return {
        ...base,
        splitType: "usage_based",
        parameters: {
          usage: participantIds.map((id) => ({ participantId: id, units: 1 })),
        },
      };
    case "rotating":
      return {
        ...base,
        splitType: "rotating",
        parameters: { rotationOrder: participantIds, currentIndex: 0 },
      };
    case "itemized":
      notes.push(
        "Itemized: we left this category open. Each expense will need line items at add time.",
      );
      return {
        ...base,
        splitType: "equal", // safe fallback until user edits
        parameters: {},
      };
    case "exempt":
      return {
        ...base,
        splitType: "exempt",
        parameters: {
          exemptIds: [participantIds[participantIds.length - 1]],
          fallback: "equal",
        },
      };
    default:
      return { ...base, splitType: "equal", parameters: {} };
  }
}
