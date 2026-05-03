import { cn } from "@/lib/utils";
import { ArrowUpRight } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  trend?: { value: string; positive?: boolean };
  icon?: React.ReactNode;
  accent?: "default" | "confidential" | "open";
  className?: string;
}

export function StatCard({ label, value, hint, trend, icon, accent = "default", className }: StatCardProps) {
  const accentRing =
    accent === "confidential" ? "before:bg-confidential" :
    accent === "open" ? "before:bg-caramel" :
    "before:bg-walnut";

  return (
    <div className={cn(
      "relative overflow-hidden surface-card bg-gradient-card p-5",
      "before:absolute before:left-0 before:top-0 before:h-full before:w-[3px] before:opacity-80",
      accentRing,
      className,
    )}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
          <div className="text-3xl font-display font-medium text-foreground tabular-nums">{value}</div>
        </div>
        {icon && <div className="text-walnut/70">{icon}</div>}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        {trend && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", trend.positive ? "text-success" : "text-destructive")}>
            <ArrowUpRight className={cn("h-3 w-3", !trend.positive && "rotate-90")} />
            {trend.value}
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </div>
  );
}
