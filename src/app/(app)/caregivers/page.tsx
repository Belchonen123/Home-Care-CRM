import { EmptyState } from "@/components/shell/empty-state";

export default function CaregiversStub() {
  return (
    <EmptyState
      title="Caregivers"
      description="Caregiver records, credential expiry alerts, and availability land in Prompt 8."
      ctaLabel="Add a caregiver"
      ctaHref="/app/caregivers/new"
    />
  );
}
