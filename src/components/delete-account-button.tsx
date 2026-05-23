"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteAccount } from "@/app/app/settings/actions";

export function DeleteAccountButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-2">
      {!open ? (
        <Button
          type="button"
          variant="destructive"
          size="sm"
          onClick={() => setOpen(true)}
        >
          Delete account
        </Button>
      ) : (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 space-y-3">
          <p className="text-sm">
            This will permanently remove your account and data. This action cannot
            be undone.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const result = await deleteAccount();
                  setMessage(result.message);
                  setOpen(false);
                });
              }}
            >
              {pending ? "Working…" : "Yes, delete my account"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
      {message ? (
        <p className="text-sm text-muted-foreground" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
