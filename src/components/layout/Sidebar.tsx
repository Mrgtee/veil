import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Send, Layers, History, Lock, ShieldCheck, Settings, ChevronRight, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";
import { VeilWordmark } from "@/components/brand/VeilLogo";

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/app/payments/new", label: "New Payment", icon: Send },
  { to: "/app/batch", label: "Batch Payments", icon: Layers },
  { to: "/app/unified-balance", label: "Unified Balance", icon: WalletCards },
  { to: "/app/history", label: "History", icon: History },
  { to: "/app/confidential", label: "Private Records", icon: Lock },
  { to: "/app/access", label: "Access Control", icon: ShieldCheck },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const loc = useLocation();
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="px-5 py-5 border-b border-sidebar-border">
        <div className="[&_span]:text-sidebar-foreground">
          <VeilWordmark size="md" />
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        <div className="px-2 pb-2 text-[10px] uppercase tracking-[0.2em] text-sidebar-foreground/50">Workspace</div>
        {nav.map((item) => {
          const Icon = item.icon;
          const active = item.end ? loc.pathname === item.to : loc.pathname.startsWith(item.to);
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-sidebar-primary" : "text-sidebar-foreground/60")} />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight className="h-3.5 w-3.5 text-sidebar-primary" />}
            </NavLink>
          );
        })}
      </nav>

      <div className="m-3 p-4 rounded-lg bg-sidebar-accent/60 border border-sidebar-border">
        <div className="flex items-center gap-2 text-xs text-sidebar-foreground/80">
          <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-subtle" />
          Network: Arc Testnet
        </div>
        <p className="mt-2 text-xs text-sidebar-foreground/60 leading-relaxed">
          Open settlement online. Arc Private Kit coming soon.
        </p>
      </div>
    </aside>
  );
}
