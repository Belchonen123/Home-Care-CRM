"use client";

import { useQuery } from "convex/react";
import { format, formatDistanceToNow } from "date-fns";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function CaregiverTimeline({
  caregiverId,
}: {
  caregiverId: Id<"caregivers">;
}) {
  const rows = useQuery(api.auditLog.timelineFor, {
    targetTable: "caregivers",
    targetId: caregiverId,
    limit: 200,
  });

  if (!rows) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">Loading…</Card>
    );
  }
  if (rows.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        No events recorded yet.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <ol className="divide-y">
        {rows.map((r) => (
          <li
            key={r._id}
            className="grid grid-cols-[140px_140px_1fr] gap-3 px-4 py-2 text-sm"
          >
            <span
              className="text-muted-foreground"
              title={format(new Date(r.at), "PPpp")}
            >
              {formatDistanceToNow(new Date(r.at), { addSuffix: true })}
            </span>
            <span>
              <Badge variant="outline">{r.actorRole ?? "unknown"}</Badge>
            </span>
            <span className="font-mono text-xs">
              {r.action}
              {r.summary && (
                <span className="ml-2 text-muted-foreground">— {r.summary}</span>
              )}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
