import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Faircutter — Fair splits, not just equal ones",
  description:
    "A household money app built around rules, not transactions. Define how your household handles money once; expenses split themselves.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
