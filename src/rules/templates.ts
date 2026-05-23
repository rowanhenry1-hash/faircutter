/**
 * Launch templates.
 *
 * Each template is a portable JSON definition. Selecting a template
 * instantiates real `rules` rows in a new group via `instantiateTemplate`.
 *
 * The 5 templates align 1:1 with the 5 seeded scenarios in BLUEPRINT.md.
 * They are stored in the `templates` table by `slug` and can be edited later
 * without touching code (though changing the seeds requires a fresh seed run).
 */
import type { TemplateRuleDef } from "@/db/schema";

export type LaunchTemplate = {
  slug: string;
  name: string;
  description: string;
  /** One-line audience hint for onboarding template cards. */
  whoItsFor: string;
  appliesTo: "couple" | "roommates" | "household" | "trip";
  rules: TemplateRuleDef[];
  /** Suggested seeded members for development; placeholder display names. */
  suggestedMembers: { displayName: string; declaredIncome?: number }[];
};

export const TEMPLATES: LaunchTemplate[] = [
  // --------------------------------------------------------------------
  {
    slug: "couple-two-incomes",
    name: "Couple, two incomes",
    description:
      "Joint expenses (rent, utilities, groceries) are prorated by income. Personal expenses stay off the books.",
    whoItsFor: "Couples sharing rent and bills with different incomes.",
    appliesTo: "couple",
    suggestedMembers: [
      { displayName: "Alex", declaredIncome: 7500 },
      { displayName: "Sam", declaredIncome: 4500 },
    ],
    rules: [
      {
        name: "Joint expenses by income",
        description:
          "Rent, utilities, and groceries are split in proportion to declared income.",
        splitType: "by_income",
        parameters: {},
        appliesToCategories: ["rent", "utilities", "groceries"],
        priority: 1,
      },
      {
        name: "Fallback equal",
        description: "Anything else is split equally.",
        splitType: "equal",
        parameters: {},
        appliesToCategories: [],
        priority: 100,
      },
    ],
  },

  // --------------------------------------------------------------------
  {
    slug: "roommates-equal",
    name: "Roommates, equal split",
    description: "All shared bills split equally three ways.",
    whoItsFor: "Roommates or friends who split everything evenly.",
    appliesTo: "roommates",
    suggestedMembers: [
      { displayName: "Riley" },
      { displayName: "Jordan" },
      { displayName: "Casey" },
    ],
    rules: [
      {
        name: "Everything equal",
        description: "All categories split equally among members.",
        splitType: "equal",
        parameters: {},
        appliesToCategories: [],
        priority: 1,
      },
    ],
  },

  // --------------------------------------------------------------------
  {
    slug: "roommates-by-income",
    name: "Roommates, income-proportional",
    description:
      "Rent and utilities are prorated by income. Groceries split equally. Subscriptions rotate.",
    whoItsFor:
      "Roommates where big bills follow income and smaller costs stay simple.",
    appliesTo: "roommates",
    suggestedMembers: [
      { displayName: "Pat", declaredIncome: 6000 },
      { displayName: "Robin", declaredIncome: 5000 },
      { displayName: "Sky", declaredIncome: 4000 },
    ],
    rules: [
      {
        name: "Rent and utilities by income",
        description: "Big shared bills are split in proportion to income.",
        splitType: "by_income",
        parameters: {},
        appliesToCategories: ["rent", "utilities"],
        priority: 1,
      },
      {
        name: "Groceries equal",
        splitType: "equal",
        parameters: {},
        appliesToCategories: ["groceries"],
        priority: 2,
      },
      {
        name: "Subscriptions rotate",
        description:
          "One person covers each month and it cycles through everyone.",
        splitType: "rotating",
        parameters: { rotationOrder: [], currentIndex: 0 },
        appliesToCategories: ["subscriptions"],
        priority: 3,
      },
      {
        name: "Anything else equal",
        splitType: "equal",
        parameters: {},
        appliesToCategories: [],
        priority: 100,
      },
    ],
  },

  // --------------------------------------------------------------------
  {
    slug: "parents-plus-adult-child",
    name: "Parents + adult working child",
    description:
      "Parents prorate by income. Adult child pays a fixed monthly amount toward rent and 50% of the internet. Groceries are between the parents only.",
    whoItsFor:
      "Parents plus an adult working child with exceptions on specific bills.",
    appliesTo: "household",
    suggestedMembers: [
      { displayName: "Dad", declaredIncome: 8000 },
      { displayName: "Mom", declaredIncome: 6000 },
      { displayName: "Kid", declaredIncome: 3500 },
    ],
    rules: [
      {
        name: "Kid pays $500 rent",
        description: "Fixed monthly amount toward rent. Parents split the remainder.",
        splitType: "fixed_amount",
        parameters: {
          amounts: [{ participantId: "__kid__", amount: 50000 }],
          remainderTo: "rest_equally",
        },
        appliesToCategories: ["rent"],
        priority: 1,
      },
      {
        name: "Kid pays 50% of internet",
        description: "Child pays 50% of the bill; parents split the rest by income.",
        splitType: "subsidized",
        parameters: {
          subsidizerId: "__kid__",
          subsidizerBasisPoints: 5000,
          remainder: "by_income",
        },
        appliesToCategories: ["internet"],
        priority: 2,
      },
      {
        name: "Utilities between parents by income",
        description: "Non-internet utilities are between the parents only.",
        splitType: "by_income",
        parameters: { participantIds: ["__dad__", "__mom__"] },
        appliesToCategories: ["utilities"],
        priority: 3,
      },
      {
        name: "Groceries — parents only, equal",
        description: "Child opts out of groceries.",
        splitType: "exempt",
        parameters: { exemptIds: ["__kid__"], fallback: "equal" },
        appliesToCategories: ["groceries"],
        priority: 4,
      },
    ],
  },

  // --------------------------------------------------------------------
  {
    slug: "group-trip",
    name: "Group trip",
    description:
      "Equal splits across all attendees with per-expense opt-outs. Settles at the end of the trip.",
    whoItsFor: "Friend groups on a trip — equal splits with per-expense opt-outs.",
    appliesTo: "trip",
    suggestedMembers: [
      { displayName: "Aki" },
      { displayName: "Ben" },
      { displayName: "Cam" },
      { displayName: "Dee" },
    ],
    rules: [
      {
        name: "Trip equal",
        description:
          "Each expense splits equally among the people who attended it.",
        splitType: "equal",
        parameters: {},
        appliesToCategories: [],
        priority: 1,
      },
    ],
  },
];

/**
 * Replace placeholder participant ids in a template rule set with real ids
 * once the group's members exist. Used when applying a template to a group.
 *
 * Placeholders are `__<key>__` and the caller provides a map from key to id.
 */
export function bindTemplate(
  rules: TemplateRuleDef[],
  memberMap: Record<string, string>,
): TemplateRuleDef[] {
  const replace = (s: unknown): unknown => {
    if (typeof s === "string" && s.startsWith("__") && s.endsWith("__")) {
      const key = s.slice(2, -2);
      return memberMap[key] ?? s;
    }
    if (Array.isArray(s)) return s.map(replace);
    if (s && typeof s === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(s)) out[k] = replace(v);
      return out;
    }
    return s;
  };
  return rules.map((r) => replace(r) as TemplateRuleDef);
}
