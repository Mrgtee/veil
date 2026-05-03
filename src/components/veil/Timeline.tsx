import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimelineStep {
  label: string;
  description?: string;
  state: "done" | "active" | "pending" | "failed";
  timestamp?: string;
}

export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        return (
          <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast && <span className={cn("absolute left-[11px] top-6 h-full w-px", s.state === "done" ? "bg-walnut/40" : "bg-border")} />}
            <div className="relative z-10 mt-0.5">
              {s.state === "done" && <CheckCircle2 className="h-6 w-6 text-success" />}
              {s.state === "active" && <Loader2 className="h-6 w-6 text-walnut animate-spin" />}
              {s.state === "pending" && <Circle className="h-6 w-6 text-muted-foreground/40" />}
              {s.state === "failed" && <Circle className="h-6 w-6 text-destructive" />}
            </div>
            <div className="flex-1 pt-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className={cn("font-medium text-sm", s.state === "pending" && "text-muted-foreground")}>{s.label}</span>
                {s.timestamp && <span className="text-xs text-muted-foreground tabular-nums">{s.timestamp}</span>}
              </div>
              {s.description && <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
