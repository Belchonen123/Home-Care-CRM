import { cn } from "@/lib/utils";

interface Props {
  steps: readonly { id: number; label: string }[];
  current: number;
}

export function Stepper({ steps, current }: Props) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs">
      {steps.map((s, i) => {
        const status =
          s.id < current ? "done" : s.id === current ? "current" : "future";
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-semibold",
                status === "done" && "border-primary bg-primary text-primary-foreground",
                status === "current" && "border-primary text-primary",
                status === "future" && "border-border text-muted-foreground",
              )}
              aria-current={status === "current" ? "step" : undefined}
            >
              {s.id}
            </span>
            <span
              className={cn(
                "font-medium",
                status === "future" ? "text-muted-foreground" : "text-foreground",
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 && <span className="text-border">/</span>}
          </li>
        );
      })}
    </ol>
  );
}
