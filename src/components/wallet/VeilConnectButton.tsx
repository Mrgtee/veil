import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

type VeilConnectButtonProps = {
  className?: string;
  fullWidth?: boolean;
};

export function VeilConnectButton({ className, fullWidth = false }: VeilConnectButtonProps) {
  return (
    <ConnectButton.Custom>
      {({ account, chain, mounted, openAccountModal, openChainModal, openConnectModal }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        const label = !connected ? "Connect Wallet" : chain.unsupported ? "Wrong Network" : account.displayName;
        const onClick = !connected ? openConnectModal : chain.unsupported ? openChainModal : openAccountModal;

        return (
          <button
            type="button"
            onClick={onClick}
            disabled={!ready}
            className={cn(
              "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground shadow-sm transition",
              "hover:border-walnut/50 hover:bg-secondary/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              "disabled:pointer-events-none disabled:opacity-60",
              fullWidth && "w-full",
              connected && !chain.unsupported && "bg-gradient-brand text-primary-foreground hover:border-transparent hover:opacity-95",
              chain?.unsupported && "border-warning/40 bg-warning/15 text-warning-foreground",
              className
            )}
          >
            <Wallet className="h-4 w-4 shrink-0" />
            <span className="truncate">{label}</span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
