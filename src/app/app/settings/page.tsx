import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth, signOut } from "@/auth";
import { db } from "@/db/client";
import { users } from "@/db/schema";
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
import { minorUnitsToString } from "@/lib/money";
import { DeleteAccountButton } from "@/components/delete-account-button";
import { updateProfile } from "./actions";

const CURRENCIES = ["USD", "CAD", "GBP", "AUD", "EUR"];

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id));

  if (!user) redirect("/auth");

  const incomeDisplay =
    user.declaredIncome != null
      ? minorUnitsToString(user.declaredIncome, user.preferredCurrency)
      : "";

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/app"
          className="text-xs text-muted-foreground hover:underline"
        >
          ← Dashboard
        </Link>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Profile and preferences for your Faircutter account.
        </p>
      </div>

      <form action={updateProfile}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>
              Income is optional and only used when a group rule splits by income.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                name="name"
                defaultValue={user.name ?? ""}
                placeholder="Your name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                value={user.email}
                readOnly
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                Email cannot be changed here yet.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="declaredIncome">
                Declared monthly income (optional)
              </Label>
              <Input
                id="declaredIncome"
                name="declaredIncome"
                defaultValue={incomeDisplay}
                placeholder="e.g. 5000"
                inputMode="decimal"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="preferredCurrency">Preferred currency</Label>
              <select
                id="preferredCurrency"
                name="preferredCurrency"
                defaultValue={user.preferredCurrency}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="language">Language</Label>
              <select
                id="language"
                name="language"
                disabled
                defaultValue="en"
                className="h-10 w-full rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground"
              >
                <option value="en">English</option>
              </select>
              <p className="text-xs text-muted-foreground">
                More languages coming soon.
              </p>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                name="dataSharingOptIn"
                defaultChecked={user.dataSharingOptIn}
                className="mt-1"
              />
              <span>
                <span className="font-medium">Anonymous data sharing</span>
                <br />
                <span className="text-muted-foreground">
                  Opt in to share anonymized usage patterns to help improve
                  Faircutter. We never sell personal data.
                </span>
              </span>
            </label>
          </CardContent>
          <CardFooter className="justify-end">
            <Button type="submit">Save changes</Button>
          </CardFooter>
        </Card>
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <Button type="submit" variant="outline">
              Sign out
            </Button>
          </form>
          <DeleteAccountButton />
        </CardContent>
      </Card>
    </div>
  );
}
