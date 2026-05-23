import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function AppDashboard() {
  const session = await auth();
  if (!session?.user) redirect("/auth");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-6 py-12">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Faircutter</h1>
          <p className="text-sm text-muted-foreground">
            Welcome, {session.user.name || session.user.email}.
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <Button variant="outline" type="submit">
            Sign out
          </Button>
        </form>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Dashboard placeholder</CardTitle>
          <CardDescription>
            The real dashboard ships in Step 7. For now this proves you&apos;re
            signed in.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            User id: <code className="rounded bg-muted px-1.5 py-0.5">{session.user.id}</code>
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
