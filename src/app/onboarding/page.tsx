import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function OnboardingStubPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Welcome.</h1>
      <p className="text-sm text-muted-foreground">
        We&apos;ll walk you through agency onboarding next: states &amp; programs,
        provider IDs, billing contacts, and BAA acknowledgment. The full wizard
        lands in Prompt 6.
      </p>
      <Button asChild>
        <Link href="/app">Continue to dashboard</Link>
      </Button>
    </main>
  );
}
