import {
  LogOut,
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
import { truncateAddress } from "@/lib/format";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { VeilWordmark } from "@/components/brand/VeilLogo";
import { useAccount, useDisconnect } from "wagmi";

const mobileNav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard },
  { to: "/app/payments/new", label: "New Payment", icon: Send },
  { to: "/app/batch", label: "Batch Payments", icon: Layers },
  { to: "/app/unified-balance", label: "Unified USDC", icon: WalletCards },
  { to: "/app/history", label: "History", icon: History },
  { to: "/app/confidential", label: "Private Records", icon: Lock },
  { to: "/app/access", label: "Access Control", icon: ShieldCheck },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export function TopBar() {
  const { address } = useAccount();
  const { disconnect } = useDisconnect();
  const navigate = useNavigate();
  const label = "Operator";

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
              <DropdownMenuLabel>Veil workspace</DropdownMenuLabel>
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
                    {item.label}
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 sm:gap-3 rounded-lg pl-1 sm:pl-2 pr-1 sm:pr-3 py-1.5 hover:bg-secondary/60 transition-colors shrink-0">
              <div className="h-8 w-8 rounded-full bg-gradient-brand text-primary-foreground flex items-center justify-center text-xs font-medium">
                {label.slice(0, 2).toUpperCase()}
              </div>

              <div className="text-left hidden sm:block">
                <div className="text-sm font-medium leading-none">{label}</div>
                <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                  {address ? truncateAddress(address) : "—"}
                </div>
              </div>
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Wallet connected</DropdownMenuLabel>
            <DropdownMenuItem className="font-mono text-xs break-all">
              {address ?? "—"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate("/app/settings")}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                disconnect();
                navigate("/");
              }}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
