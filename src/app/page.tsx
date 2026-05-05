export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-3xl font-semibold tracking-tight">Home Care CRM</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Multi-tenant home-care CRM with Electronic Visit Verification. Phase 1
        scaffold &mdash; auth, schema, and features land in subsequent prompts.
      </p>
    </main>
  );
}
