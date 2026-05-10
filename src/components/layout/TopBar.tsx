import {
  Menu,
  LayoutDashboard,
  Send,
  Layers,
  WalletCards,
  History,
  Lock,
  ShieldCheck,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VeilWordmark } from "@/components/brand/VeilLogo";
import { VeilConnectButton } from "@/components/wallet/VeilConnectButton";

const mobileNav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/payments/new", label: "New Payment", icon: Send },
  { to: "/app/batch", label: "Batch Payments", icon: Layers },
  { to: "/app/unified-balance", label: "Unified USDC", icon: WalletCards },
  { to: "/app/history", label: "History", icon: History },
  { to: "/app/confidential", label: "Private Records", icon: Lock, badge: "Soon" },
  { to: "/app/access", label: "Access Control", icon: ShieldCheck, badge: "Preview" },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export function TopBar() {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border">
      <div className="flex items-center gap-2 sm:gap-4 px-3 sm:px-6 h-16">
        <div className="lg:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open navigation">
                <Menu className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="start" className="w-64">
              <DropdownMenuLabel>Veilarc workspace</DropdownMenuLabel>
              <DropdownMenuSeparator />

              {mobileNav.map((item) => {
                const Icon = item.icon;

                return (
                  <DropdownMenuItem
                    key={item.to}
                    onClick={() => navigate(item.to)}
                    className="cursor-pointer"
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="rounded-md border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {item.badge}
                      </span>
                    )}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="lg:hidden shrink-0">
          <VeilWordmark size="sm" />
        </div>

        <div className="flex-1" />

        <VeilConnectButton />
      </div>
    </header>
  );
}
