import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Home Care CRM</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Multi-tenant home-care CRM with Electronic Visit Verification for
        agencies in New York and Michigan.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/sign-in">Sign in</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/sign-up">Sign up</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/app">Open dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
