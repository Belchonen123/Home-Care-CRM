"use client";

import { cn } from "@/lib/utils";

interface Props {
  tabs: readonly { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, active, onChange }: Props) {
  return (
    <div role="tablist" aria-label="Client sections" className="border-b">
      <ul className="flex flex-wrap gap-1 -mb-px">
        {tabs.map((t) => {
          const isActive = t.id === active;
          return (
            <li key={t.id}>
              <button
                role="tab"
                aria-selected={isActive}
                onClick={() => onChange(t.id)}
                className={cn(
                  "relative -mb-px inline-flex h-9 items-center px-3 text-sm transition-colors",
                  "border-b-2",
                  isActive
                    ? "border-primary font-medium text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
