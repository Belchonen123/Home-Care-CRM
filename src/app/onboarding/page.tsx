"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useUser, useOrganization } from "@clerk/nextjs";
import { api } from "@convex/_generated/api";
import { OnboardingWizard } from "@/components/onboarding/wizard";

export default function OnboardingPage() {
  const router = useRouter();
  const { user } = useUser();
  const { organization } = useOrganization();
  const current = useQuery(api.agencies.current);
  const bootstrap = useMutation(api.agencies.bootstrap);
  const [bootstrapped, setBootstrapped] = useState(false);

  useEffect(() => {
    if (!user || !organization || bootstrapped) return;
    void bootstrap({
      primaryEmail: user.primaryEmailAddress?.emailAddress ?? "",
      agencyName: organization.name,
    }).then(() => setBootstrapped(true));
  }, [user, organization, bootstrap, bootstrapped]);

  useEffect(() => {
    if (current?.agency?.onboardingComplete) {
      router.replace("/app");
    }
  }, [current, router]);

  if (!user || !organization) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        Preparing your onboarding…
      </main>
    );
  }

  if (current === undefined) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8 text-sm text-muted-foreground">
        Loading…
      </main>
    );
  }

  return <OnboardingWizard agencyName={organization.name} />;
}
