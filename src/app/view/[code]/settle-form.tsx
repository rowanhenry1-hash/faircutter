"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { minorUnitsToString } from "@/lib/money";
import { recordGhostSettlement } from "./actions";

export function GhostSettleForm({
  code,
  toId,
  toName,
  defaultAmount,
  currency,
}: {
  code: string;
  toId: string;
  toName: string;
  defaultAmount: number;
  currency: string;
}) {
  const [amount, setAmount] = useState(minorUnitsToString(defaultAmount, currency));
  const [note, setNote] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          setError(null);
          try {
            await recordGhostSettlement(formData);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Failed to record");
          }
        });
      }}
      className="flex flex-col gap-2 sm:flex-row sm:items-center"
    >
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="toId" value={toId} />
      <div className="flex-1">
        <Input
          name="amount"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          aria-label={`Amount paid to ${toName}`}
          placeholder="Amount"
          required
        />
      </div>
      <Input
        name="note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (optional)"
        className="flex-1"
      />
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Saving…" : "I paid"}
      </Button>
      {error ? (
        <p className="text-xs text-destructive sm:basis-full">{error}</p>
      ) : null}
    </form>
  );
}
