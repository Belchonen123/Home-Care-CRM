import { EmptyState } from "@/components/shell/empty-state";

export default function ClientsStub() {
  return (
    <EmptyState
      title="Clients"
      description="Intake, addresses, authorizations, plans of care, and document uploads land in Prompt 7."
      ctaLabel="Add a client"
      ctaHref="/app/clients/new"
    />
  );
}
