import { cn } from "@/lib/utils";
import { FileQuestion } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center text-center px-6 py-16 surface-card bg-gradient-card", className)}>
      <div className="h-12 w-12 rounded-full bg-beige flex items-center justify-center text-walnut mb-4">
        {icon ?? <FileQuestion className="h-5 w-5" />}
      </div>
      <h3 className="font-display text-lg text-foreground">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
