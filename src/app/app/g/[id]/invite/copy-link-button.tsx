"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      type="button"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard write can fail on insecure contexts — fall back to prompt.
          window.prompt("Copy this link:", link);
        }
      }}
    >
      {copied ? "Copied!" : "Copy link"}
    </Button>
  );
}
