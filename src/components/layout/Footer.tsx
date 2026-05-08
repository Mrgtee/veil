import { VeilLogo } from "@/components/brand/VeilLogo";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="px-6 py-5 flex flex-wrap items-center justify-between gap-4 text-sm">
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <VeilLogo size={20} />
          <span className="font-display text-foreground">Veil</span>
          <span className="opacity-50">·</span>
          <span>Open payments today. Arc Private Kit coming soon.</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Built on</span>
          <span className="px-2 py-0.5 rounded-md bg-beige text-walnut font-medium tracking-wide">Arc</span>
        </div>
      </div>
    </footer>
  );
}
