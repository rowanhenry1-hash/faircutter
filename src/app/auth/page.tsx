import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";
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

/**
 * Only allow `next` redirects to internal paths to prevent open-redirect.
 */
function safeNext(raw: string | undefined): string {
  if (!raw) return "/app";
  if (!raw.startsWith("/")) return "/app";
  if (raw.startsWith("//")) return "/app";
  return raw;
}

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; error?: string; next?: string }>;
}) {
  const { mode, error, next } = await searchParams;
  const safe = safeNext(next);

  const session = await auth();
  if (session?.user) redirect(safe);

  const passwordMode = mode === "password";

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to Faircutter</CardTitle>
          <CardDescription>
            {passwordMode
              ? "Use your email and password."
              : "We'll email you a magic link. No password needed."}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {decodeURIComponent(error)}
            </div>
          ) : null}

          {passwordMode ? (
            <form
              action={async (formData) => {
                "use server";
                await signIn("credentials", {
                  email: formData.get("email"),
                  password: formData.get("password"),
                  redirectTo: safe,
                });
              }}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full">
                Sign in
              </Button>
            </form>
          ) : (
            <form
              action={async (formData) => {
                "use server";
                await signIn("resend", {
                  email: formData.get("email"),
                  redirectTo: safe,
                });
              }}
              className="space-y-3"
            >
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <Button type="submit" className="w-full">
                Email me a sign-in link
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <Link
            href={
              passwordMode
                ? `/auth${next ? `?next=${encodeURIComponent(next)}` : ""}`
                : `/auth?mode=password${next ? `&next=${encodeURIComponent(next)}` : ""}`
            }
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            {passwordMode ? "Use a magic link instead" : "Use a password instead"}
          </Link>
          <Link
            href="/"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Back home
          </Link>
        </CardFooter>
      </Card>
    </main>
  );
}
