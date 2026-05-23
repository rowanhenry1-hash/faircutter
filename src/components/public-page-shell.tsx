import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export function PublicPageShell({
  children,
  narrow = false,
}: {
  children: React.ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/" className="text-lg font-semibold">
            Faircutter
          </Link>
          <div className="flex items-center gap-4 text-sm">
            <Link
              href="/pricing"
              className="text-muted-foreground hover:text-foreground"
            >
              Pricing
            </Link>
            <Link
              href="/help"
              className="text-muted-foreground hover:text-foreground"
            >
              Help
            </Link>
            <Link
              href="/auth"
              className="text-muted-foreground hover:text-foreground"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>
      <main
        className={`mx-auto flex-1 px-6 py-10 ${narrow ? "max-w-2xl" : "max-w-3xl"}`}
      >
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
