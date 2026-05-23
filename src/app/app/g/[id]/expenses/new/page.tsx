import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groups } from "@/db/schema";
import { loadGroupParticipants, loadGroupRules } from "@/lib/groups";
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
import { createExpense } from "../../actions";

const CATEGORIES = [
  "rent",
  "utilities",
  "internet",
  "groceries",
  "subscriptions",
  "dining",
  "transport",
  "hotel",
  "social",
  "other",
];

export default async function NewExpensePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ category?: string }>;
}) {
  const { id } = await params;
  const { category = "rent" } = await searchParams;
  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  if (!group) return null;

  const participants = await loadGroupParticipants(id);
  const rules = await loadGroupRules(id);
  const matchingRule =
    [...rules]
      .sort((a, b) => a.priority - b.priority)
      .find(
        (r) =>
          r.appliesToCategories.length === 0 ||
          r.appliesToCategories.includes(category),
      ) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/g/${id}`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← {group.name}
        </Link>
        <h1 className="text-2xl font-semibold">Add expense</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Suggested rule</CardTitle>
          <CardDescription>
            {matchingRule
              ? `Based on category "${category}", we'll apply: ${matchingRule.name} (${matchingRule.splitType})`
              : "No rule matches this category yet — it will fall back to an equal split."}
          </CardDescription>
        </CardHeader>
      </Card>

      <form action={createExpense}>
        <input type="hidden" name="groupId" value={id} />
        <Card>
          <CardContent className="space-y-4 pt-6">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount ({group.currency})</Label>
              <Input
                id="amount"
                name="amount"
                inputMode="decimal"
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>Category</Label>
              <div className="flex flex-wrap gap-1">
                {CATEGORIES.map((c) => (
                  <Link
                    key={c}
                    href={`?category=${c}`}
                    className={`rounded border px-2.5 py-1 text-xs ${
                      c === category
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    {c}
                  </Link>
                ))}
              </div>
              <input type="hidden" name="category" value={category} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description (optional)</Label>
              <Input id="description" name="description" />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="paidBy">Paid by</Label>
              <select
                id="paidBy"
                name="paidBy"
                required
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {participants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>Attendees</Label>
              <p className="text-xs text-muted-foreground">
                Leave all checked to include everyone in the group.
              </p>
              <div className="space-y-1">
                {participants.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="attendees"
                      value={p.id}
                      defaultChecked
                    />
                    {p.displayName}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit">Add expense</Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
