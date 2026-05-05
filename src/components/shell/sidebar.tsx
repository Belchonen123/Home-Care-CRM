"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  FileSpreadsheet,
  Gauge,
  Receipt,
  Settings,
  ShieldCheck,
  Stethoscope,
  Users,
  UserSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: `/${string}`;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}

const NAV: NavItem[] = [
  { href: "/app", label: "Dashboard", Icon: Gauge },
  { href: "/app/clients", label: "Clients", Icon: UserSquare },
  { href: "/app/caregivers", label: "Caregivers", Icon: Users },
  { href: "/app/schedule", label: "Schedule", Icon: CalendarDays },
  { href: "/app/visits", label: "Visits", Icon: Stethoscope },
  { href: "/app/billing", label: "Billing", Icon: Receipt },
  { href: "/app/reports", label: "Reports", Icon: FileSpreadsheet },
  { href: "/app/compliance", label: "Compliance", Icon: ShieldCheck },
  { href: "/app/settings", label: "Settings", Icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r bg-card lg:flex"
    >
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <ClipboardList className="h-5 w-5 text-primary" />
        <span className="text-sm font-semibold">Home Care CRM</span>
      </div>
      <ul className="flex-1 space-y-0.5 px-2 py-3">
        {NAV.map(({ href, label, Icon }) => {
          const active =
            pathname === href ||
            (href !== "/app" && pathname?.startsWith(`${href}/`));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
