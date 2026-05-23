import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groups } from "@/db/schema";
import { loadGroupParticipants } from "@/lib/groups";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createRule } from "../../actions";

const EXAMPLES: Record<string, unknown> = {
  equal: { participantIds: [] },
  percentage: {
    percentages: [
      { participantId: "<id>", basisPoints: 5000 },
      { participantId: "<id>", basisPoints: 5000 },
    ],
  },
  fixed_amount: {
    amounts: [{ participantId: "<id>", amount: 50000 }],
    remainderTo: "rest_equally",
  },
  by_income: { participantIds: [], excludeIds: [] },
  itemized: {
    items: [{ label: "Mains", amount: 3000, participantIds: ["<id>"] }],
  },
  weighted: { weights: [{ participantId: "<id>", weight: 1 }] },
  usage_based: {
    usage: [{ participantId: "<id>", units: 3 }],
    unitLabel: "nights",
  },
  exempt: { exemptIds: ["<id>"], fallback: "equal" },
  rotating: { rotationOrder: ["<id>"], currentIndex: 0 },
  subsidized: {
    subsidizerId: "<id>",
    subsidizerBasisPoints: 5000,
    remainder: "equal",
  },
};

export default async function RuleEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ splitType?: string }>;
}) {
  const { id } = await params;
  const { splitType = "equal" } = await searchParams;

  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  if (!group) return null;

  const participants = await loadGroupParticipants(id);

  const defaultRule = {
    name: `New ${splitType} rule`,
    priority: 100,
    appliesToCategories: [],
    splitType,
    parameters: EXAMPLES[splitType] ?? {},
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/g/${id}/rules`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Rules
        </Link>
        <h1 className="text-2xl font-semibold">Manual rule editor</h1>
        <p className="text-sm text-muted-foreground">
          Edit the JSON below and save. Parameter shape is validated.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Participants in this group</CardTitle>
          <CardDescription>
            Use these ids in your rule&apos;s `parameters`.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1 text-xs">
            {participants.map((p) => (
              <li key={p.id} className="font-mono">
                <span className="text-muted-foreground">{p.displayName}:</span>{" "}
                {p.id}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Split type</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {Object.keys(EXAMPLES).map((t) => (
            <Link
              key={t}
              href={`?splitType=${t}`}
              className={`rounded border px-3 py-1 text-xs ${
                t === splitType
                  ? "border-foreground bg-foreground text-background"
                  : "border-border hover:bg-muted"
              }`}
            >
              {t}
            </Link>
          ))}
        </CardContent>
      </Card>

      <form action={createRule}>
        <input type="hidden" name="groupId" value={id} />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rule JSON</CardTitle>
            <CardDescription>
              Edit the rule below. Save will validate via the Zod schema and
              insert it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <textarea
              name="ruleJson"
              defaultValue={JSON.stringify(defaultRule, null, 2)}
              spellCheck={false}
              className="h-96 w-full rounded border border-input bg-background p-3 font-mono text-xs"
            />
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit">Save rule</Button>
          </CardFooter>
        </Card>
      </form>
    </div>
  );
}
