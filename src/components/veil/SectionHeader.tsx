import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function SectionHeader({ eyebrow, title, description, actions, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="space-y-1.5">
        {eyebrow && <div className="text-xs uppercase tracking-[0.2em] text-walnut/70 font-medium">{eyebrow}</div>}
        <h1 className="text-3xl md:text-[2rem] font-display font-medium text-foreground tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground max-w-2xl text-balance">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
