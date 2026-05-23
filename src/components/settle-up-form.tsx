"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSettlement } from "@/app/app/g/[id]/actions";
import { minorUnitsToString } from "@/lib/money";

type ParticipantOption = {
  id: string;
  displayName: string;
};

export function SettleUpForm({
  groupId,
  currency,
  fromId,
  toId,
  defaultAmount,
  participants,
}: {
  groupId: string;
  currency: string;
  fromId: string;
  toId: string;
  defaultAmount: number;
  participants: ParticipantOption[];
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        Settle up
      </Button>
    );
  }

  return (
    <form
      action={createSettlement}
      className="mt-3 space-y-3 rounded-md border border-border bg-muted/40 p-3"
    >
      <input type="hidden" name="groupId" value={groupId} />

      <FormField label="From">
        <select
          name="fromId"
          defaultValue={fromId}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          required
        >
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="To">
        <select
          name="toId"
          defaultValue={toId}
          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          required
        >
          {participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Amount">
        <Input
          name="amount"
          type="text"
          inputMode="decimal"
          defaultValue={minorUnitsToString(defaultAmount, currency)}
          required
        />
      </FormField>

      <FormField label="Note (optional)">
        <Input name="note" type="text" placeholder="e.g. Venmo, cash" />
      </FormField>

      <div className="flex gap-2">
        <Button type="submit" size="sm">
          Record settlement
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  if (!label) return <>{children}</>;
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
