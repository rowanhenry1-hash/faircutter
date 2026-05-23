/**
 * Claim flow — runs after the ghost completes sign-up/sign-in.
 *
 * If signed in: link the ghost to this user, then redirect to the group.
 * If signed out: bounce back to /auth with this URL as the return.
 */
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { resolveAccessCode } from "@/lib/ghost";
import { claimGhost } from "../actions";

export default async function ClaimPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const session = await auth();
  if (!session?.user) {
    redirect(
      `/auth?next=${encodeURIComponent(`/view/${encodeURIComponent(code)}/claim`)}`,
    );
  }

  const resolved = await resolveAccessCode(code);
  if (!resolved) {
    redirect("/app");
  }

  const result = await claimGhost({
    accessCode: code,
    userId: session.user.id,
  });

  redirect(`/app/g/${result.groupId}`);
}
