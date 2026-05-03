import veilLogo from "@/assets/veil-logo.jpg";
import { cn } from "@/lib/utils";

export function VeilLogo({
  className,
  size = 32,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center rounded-lg overflow-hidden bg-cream border border-border/60 shrink-0",
        className
      )}
      style={{ width: size, height: size }}
      aria-label="Veil"
    >
      <img
        src={veilLogo}
        alt="Veil"
        className="block object-contain"
        style={{
          width: size * 0.86,
          height: size * 0.86,
          mixBlendMode: "multiply",
        }}
      />
    </div>
  );
}

export function VeilWordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const sz = { sm: 22, md: 28, lg: 36 }[size];
  const text = { sm: "text-base", md: "text-lg", lg: "text-2xl" }[size];

  return (
    <div className="inline-flex items-center gap-2.5">
      <VeilLogo size={sz} />
      <span className={cn("font-display tracking-tight font-medium text-foreground", text)}>
        Veil
      </span>
    </div>
  );
}
