import { ClientIntakeForm } from "@/components/clients/intake-form";

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">New client</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Capture intake details. SSN and DOB are encrypted at rest. Addresses are
          server-side geocoded when a Mapbox token is configured.
        </p>
      </header>
      <ClientIntakeForm />
    </div>
  );
}
