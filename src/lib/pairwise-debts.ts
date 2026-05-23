import type { ParticipantId } from "@/rules/types";

export type PairwiseDebt = {
  from: ParticipantId;
  to: ParticipantId;
  amount: number;
};

/** Greedy simplification of net balances into "from owes to" pairs. */
export function computePairwiseDebts(
  balances: Map<ParticipantId, number>,
): PairwiseDebt[] {
  const creditors: { id: ParticipantId; amount: number }[] = [];
  const debtors: { id: ParticipantId; amount: number }[] = [];

  for (const [id, net] of balances) {
    if (net > 0) creditors.push({ id, amount: net });
    else if (net < 0) debtors.push({ id, amount: -net });
  }

  creditors.sort((a, b) => b.amount - a.amount);
  debtors.sort((a, b) => b.amount - a.amount);

  const debts: PairwiseDebt[] = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const transfer = Math.min(debtors[i].amount, creditors[j].amount);
    if (transfer > 0) {
      debts.push({
        from: debtors[i].id,
        to: creditors[j].id,
        amount: transfer,
      });
    }
    debtors[i].amount -= transfer;
    creditors[j].amount -= transfer;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }

  return debts;
}
