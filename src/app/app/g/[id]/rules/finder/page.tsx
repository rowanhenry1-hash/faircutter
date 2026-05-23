import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { groups } from "@/db/schema";
import {
  FINDER_QUESTIONS,
  compileFinderAnswers,
  type FinderAnswers,
  type FinderQuestionId,
} from "@/rules/finder";
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
import { applyRuleFinderResult } from "../../actions";

function decodeAnswers(s: string | undefined): FinderAnswers {
  if (!s) return {};
  try {
    return JSON.parse(decodeURIComponent(s));
  } catch {
    return {};
  }
}

function encodeAnswers(a: FinderAnswers): string {
  return encodeURIComponent(JSON.stringify(a));
}

export default async function FinderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ step?: string; a?: string }>;
}) {
  const { id } = await params;
  const { step = "0", a } = await searchParams;
  const stepIdx = Math.max(0, Math.min(FINDER_QUESTIONS.length, Number(step) || 0));
  const answers = decodeAnswers(a);

  const [group] = await db.select().from(groups).where(eq(groups.id, id));
  if (!group) return null;

  // Past the last question — show the preview/confirm screen.
  if (stepIdx >= FINDER_QUESTIONS.length) {
    const participants = await loadGroupParticipants(id);
    const compiled = compileFinderAnswers(
      answers,
      participants.map((p) => p.id),
    );

    return (
      <div className="space-y-6">
        <div>
          <Link
            href={`/app/g/${id}/rules`}
            className="text-xs text-muted-foreground hover:underline"
          >
            ← Rules
          </Link>
          <h1 className="text-2xl font-semibold">Your rule set</h1>
          <p className="text-sm text-muted-foreground">
            Review the rules we built from your answers. You can save and edit
            after, or go back to change an answer.
          </p>
        </div>

        {compiled.notes.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Heads up</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm text-muted-foreground">
              {compiled.notes.map((n, i) => (
                <p key={i}>· {n}</p>
              ))}
            </CardContent>
          </Card>
        ) : null}

        <ul className="space-y-2">
          {compiled.rules.map((r, i) => (
            <li key={i}>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{r.name}</CardTitle>
                  <CardDescription>
                    {r.splitType}
                    {r.appliesToCategories.length > 0
                      ? ` · ${r.appliesToCategories.join(", ")}`
                      : " · all"}
                  </CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center gap-2">
          <form action={applyRuleFinderResult}>
            <input type="hidden" name="groupId" value={id} />
            <input
              type="hidden"
              name="payload"
              value={JSON.stringify({ rules: compiled.rules })}
            />
            <Button type="submit">Save these rules</Button>
          </form>
          <Button asChild variant="outline">
            <Link
              href={`?step=${stepIdx - 1}&a=${encodeAnswers(answers)}`}
            >
              Back
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href={`?step=0`}>Start over</Link>
          </Button>
        </div>
      </div>
    );
  }

  const q = FINDER_QUESTIONS[stepIdx];

  return (
    <div className="space-y-6">
      <div>
        <Link
          href={`/app/g/${id}/rules`}
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Rules
        </Link>
        <h1 className="text-2xl font-semibold">Rule finder</h1>
        <p className="text-sm text-muted-foreground">
          Question {stepIdx + 1} of {FINDER_QUESTIONS.length}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{q.question}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2">
            {q.cards.map((c, i) => {
              const nextAnswers: FinderAnswers = {
                ...answers,
                [q.id as FinderQuestionId]: { cardIndex: i, skipped: false },
              };
              return (
                <Link
                  key={i}
                  href={`?step=${stepIdx + 1}&a=${encodeAnswers(nextAnswers)}`}
                  className="rounded-lg border border-border p-4 text-sm transition hover:bg-muted"
                >
                  {c.label}
                </Link>
              );
            })}
            {(() => {
              const nextAnswers: FinderAnswers = {
                ...answers,
                [q.id as FinderQuestionId]: { cardIndex: -1, skipped: true },
              };
              return (
                <Link
                  href={`?step=${stepIdx + 1}&a=${encodeAnswers(nextAnswers)}`}
                  className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground transition hover:bg-muted"
                >
                  Skip
                </Link>
              );
            })()}
          </div>
        </CardContent>
        <CardFooter className="justify-between text-xs text-muted-foreground">
          {stepIdx > 0 ? (
            <Link
              href={`?step=${stepIdx - 1}&a=${encodeAnswers(answers)}`}
              className="hover:underline"
            >
              ← Back
            </Link>
          ) : (
            <span />
          )}
          <span>
            {Object.keys(answers).length} of {FINDER_QUESTIONS.length} answered
          </span>
        </CardFooter>
      </Card>
    </div>
  );
}
