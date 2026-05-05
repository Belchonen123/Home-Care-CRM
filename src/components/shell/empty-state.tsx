import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaHref?: `/${string}`;
}

export function EmptyState({ title, description, ctaLabel, ctaHref }: Props) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="rounded-lg border border-dashed bg-card/50 p-10 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Sparkles className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          {description}
        </p>
        {ctaLabel && ctaHref && (
          <Button asChild className="mt-6">
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
