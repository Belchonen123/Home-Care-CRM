import { CaregiverIntakeForm } from "@/components/caregivers/intake-form";

export default function NewCaregiverPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">New caregiver</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Capture the basics — credentials, availability, and assignments are
          managed on the detail page.
        </p>
      </header>
      <CaregiverIntakeForm />
    </div>
  );
}
