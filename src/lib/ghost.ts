/**
 * Ghost user helpers.
 *
 * Access codes follow `BLUEPRINT.md`: 8 chars, base32-ish (no easily confused
 * digits/letters). The only thing that authenticates a ghost user to the
 * public viewer is having the code — there's no other secret. Treat the code
 * like a short-lived shareable token.
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { ghostUsers, groups, users } from "@/db/schema";

const ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";

export function randomAccessCode(): string {
  let s = "";
  for (let i = 0; i < 8; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s;
}

/** Normalize a code from a URL (uppercase, strip whitespace). */
export function normalizeAccessCode(raw: string): string {
  return raw.trim().toUpperCase();
}

/**
 * Resolve a code to a ghost + group, or null if nothing matches.
 * Once a ghost has been claimed, the code still resolves (history works),
 * but the caller should redirect to the authenticated app instead of the
 * public viewer.
 */
export async function resolveAccessCode(rawCode: string) {
  const code = normalizeAccessCode(rawCode);
  const [ghost] = await db
    .select()
    .from(ghostUsers)
    .where(eq(ghostUsers.accessCode, code))
    .limit(1);
  if (!ghost) return null;

  const [group] = await db
    .select()
    .from(groups)
    .where(eq(groups.id, ghost.groupId))
    .limit(1);
  if (!group) return null;

  let claimedBy: { id: string; name: string | null; email: string } | null = null;
  if (ghost.claimedByUserId) {
    const [u] = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(eq(users.id, ghost.claimedByUserId))
      .limit(1);
    if (u) claimedBy = u;
  }

  return { ghost, group, claimedBy };
}
