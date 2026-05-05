import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, ScrollText, ShieldAlert } from "lucide-react";

export default function ComplianceLandingPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Compliance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          PHI access logs, EVV exceptions, and credential expiry tracking. Every
          mutation that touches PHI lands here.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ScrollText className="h-4 w-4" /> Audit log
            </CardTitle>
            <CardDescription>
              Append-only record of every read and write that touches PHI. Restricted
              to <code className="rounded bg-muted px-1">owner</code>,{" "}
              <code className="rounded bg-muted px-1">admin</code>, and{" "}
              <code className="rounded bg-muted px-1">compliance</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" size="sm">
              <Link href="/app/compliance/audit">
                Open audit log <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ShieldAlert className="h-4 w-4" /> EVV exceptions
            </CardTitle>
            <CardDescription>
              Visits that can&apos;t bill until a reason code + note is captured. Lands
              in Phase 4.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" disabled>
              Coming in Phase 4
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
