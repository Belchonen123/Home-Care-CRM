"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { Bell } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { api } from "@convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function Notifications() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClick);
      return () => document.removeEventListener("mousedown", onClick);
    }
  }, [open]);

  const count = useQuery(api.alerts.unreadCount, {});
  const alerts = useQuery(api.alerts.listOpen, open ? { limit: 30 } : "skip");
  const acknowledge = useMutation(api.alerts.acknowledge);
  const acknowledgeAll = useMutation(api.alerts.acknowledgeAll);

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell className="h-5 w-5" />
        {count !== undefined && count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-destructive-foreground">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="menu"
          className={cn(
            "absolute right-0 top-full z-50 mt-2 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border bg-popover shadow-lg",
          )}
        >
          <header className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">Notifications</span>
            {alerts && alerts.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void acknowledgeAll({})}
              >
                Mark all as read
              </Button>
            )}
          </header>
          {alerts === undefined && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          )}
          {alerts && alerts.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              All caught up.
            </div>
          )}
          <ol className="max-h-96 divide-y overflow-auto">
            {alerts?.map((a) => (
              <li key={a._id} className="space-y-1 px-3 py-2 text-sm">
                <div className="flex items-start gap-2">
                  <SeverityDot severity={a.severity} />
                  <div className="flex-1">
                    <p className="font-medium">{a.title}</p>
                    <p className="text-xs text-muted-foreground">{a.body}</p>
                    <p
                      className="mt-0.5 text-[10px] text-muted-foreground"
                      title={format(new Date(a.createdAt), "PPpp")}
                    >
                      {formatDistanceToNow(new Date(a.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void acknowledge({ alertId: a._id })}
                  >
                    Dismiss
                  </Button>
                </div>
                {a.targetCaregiverId && (
                  <Link
                    href={`/app/caregivers/${a.targetCaregiverId}`}
                    className="ml-5 inline-block text-xs text-primary underline"
                    onClick={() => setOpen(false)}
                  >
                    Open caregiver
                  </Link>
                )}
              </li>
            ))}
          </ol>
          <footer className="border-t px-3 py-2 text-right">
            <Link
              href="/app/compliance"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              View compliance dashboard
            </Link>
          </footer>
        </div>
      )}
    </div>
  );
}

function SeverityDot({
  severity,
}: {
  severity: "info" | "warning" | "critical";
}) {
  const cls =
    severity === "critical"
      ? "bg-destructive"
      : severity === "warning"
        ? "bg-warning"
        : "bg-primary";
  return (
    <span
      className={cn("mt-1.5 inline-block h-2 w-2 flex-shrink-0 rounded-full", cls)}
      aria-hidden
    />
  );
}

// Re-export Badge so the file's imports stay co-located when other consumers grow.
export { Badge };
