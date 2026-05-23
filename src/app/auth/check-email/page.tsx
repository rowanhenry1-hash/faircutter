import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function CheckEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            We sent you a sign-in link. It expires in 24 hours.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            Didn&apos;t get it? Check spam, or{" "}
            <Link href="/auth" className="underline-offset-4 hover:underline">
              try again
            </Link>
            .
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
