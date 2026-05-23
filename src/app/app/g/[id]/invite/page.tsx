/**
 * Screen 15 — invite / share.
 *
 * Per the No-Forced-Signup Rule (Section 5), this is the founder's main lever
 * against cold start. Every ghost member has an access code; that code goes
 * into the URL `/view/[code]` which is publicly viewable. Members can copy
 * the link, regenerate a compromised code, or add another ghost member here.
 */
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { eq, isNull, and } from "drizzle-orm";
import { db } from "@/db/client";
import { ghostUsers, groups } from "@/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyLinkButton } from "./copy-link-button";
import { regenerateGhostCode, addGhostMember } from "../actions";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  if (!group) notFound();

  const allGhosts = await db
    .select()
    .from(ghostUsers)
    .where(eq(ghostUsers.groupId, id));

  const active = allGhosts.filter((g) => !g.claimedByUserId);
  const claimed = allGhosts.filter((g) => g.claimedByUserId);

  // Build the base URL for /view/[code] links. In prod this is the deployed
  // host; in dev it's localhost.
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("host") ?? "localhost:3000";
  const baseUrl = `${proto}://${host}`;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/g/${id}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← {group.name}
        </Link>
        <h1 className="text-2xl font-semibold">Invite</h1>
        <p className="text-sm text-muted-foreground">
          Anyone you add here can view their balance and mark themselves paid
          — no account required. They can upgrade to a full account later.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active invites</CardTitle>
          <CardDescription>
            {active.length === 0
              ? "No invitable members yet. Add one below."
              : "Copy a link and share it however you like (text, email, signal, whatever)."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {active.length > 0 ? (
            <ul className="divide-y divide-border">
              {active.map((g) => {
                const link = `${baseUrl}/view/${encodeURIComponent(g.accessCode)}`;
                return (
                  <li
                    key={g.id}
                    className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="font-medium">{g.displayName}</div>
                      <code className="text-xs text-muted-foreground">
                        {g.accessCode}
                      </code>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CopyLinkButton link={link} />
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/view/${encodeURIComponent(g.accessCode)}`}>
                          Preview
                        </Link>
                      </Button>
                      <form action={regenerateGhostCode}>
                        <input type="hidden" name="groupId" value={id} />
                        <input type="hidden" name="ghostId" value={g.id} />
                        <Button size="sm" variant="ghost" type="submit">
                          Regenerate
                        </Button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add someone</CardTitle>
          <CardDescription>
            They&apos;ll get an access code. Send it to them — they don&apos;t
            need to download or sign up for anything.
          </CardDescription>
        </CardHeader>
        <form action={addGhostMember}>
          <input type="hidden" name="groupId" value={id} />
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="displayName">Display name</Label>
              <Input
                id="displayName"
                name="displayName"
                placeholder="e.g. Riley"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="declaredIncome">
                Monthly income (optional, for by-income rules)
              </Label>
              <Input
                id="declaredIncome"
                name="declaredIncome"
                inputMode="numeric"
                placeholder="e.g. 5000"
              />
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit">Add member</Button>
          </CardFooter>
        </form>
      </Card>

      {claimed.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Claimed accounts</CardTitle>
            <CardDescription>
              These people created accounts. Their original invite codes no
              longer work — that&apos;s on purpose.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {claimed.map((g) => (
                <li
                  key={g.id}
                  className="flex justify-between text-muted-foreground"
                >
                  <span className="text-foreground">{g.displayName}</span>
                  <span>
                    claimed{" "}
                    {g.claimedAt
                      ? new Date(g.claimedAt).toLocaleDateString()
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
