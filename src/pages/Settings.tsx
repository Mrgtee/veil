import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useAccount } from "wagmi";
import { CheckCircle2, Copy, ExternalLink, Server, ShieldCheck, Wallet, Wifi } from "lucide-react";
import { SectionHeader } from "@/components/veil/SectionHeader";
import { Button } from "@/components/ui/button";
import { APP_API_BASE, VEIL_SHIELD_ADDRESS, VEIL_SHIELD_TRANSFER_VERIFIER_ADDRESS, VEIL_SHIELD_WITHDRAW_VERIFIER_ADDRESS } from "@/lib/env";
import { ACTIVE_ARC_DEPLOYMENT, getArcExplorerAddressUrl, shortAddress } from "@/lib/deployment";
import { cn } from "@/lib/utils";

type ApiState = "checking" | "online" | "offline";

export default function Settings() {
  const { address, isConnected, chain } = useAccount();
  const [apiState, setApiState] = useState<ApiState>("checking");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function checkApi() {
      try {
        const response = await fetch(`${APP_API_BASE}/api/config`);
        if (!cancelled) setApiState(response.ok ? "online" : "offline");
      } catch {
        if (!cancelled) setApiState("offline");
      }
    }

    checkApi();
    return () => {
      cancelled = true;
    };
  }, []);

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1500);
  }

  const shieldConfigured = Boolean(
    VEIL_SHIELD_ADDRESS && VEIL_SHIELD_TRANSFER_VERIFIER_ADDRESS && VEIL_SHIELD_WITHDRAW_VERIFIER_ADDRESS
  );

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Workspace"
        title="Settings"
        description="Live configuration for this Veilarc session."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <InfoCard icon={<Wallet className="h-4 w-4" />} title="Wallet">
          <InfoRow label="Status" value={isConnected ? "Connected" : "Not connected"} />
          <InfoRow
            label="Address"
            value={address ? shortAddress(address) : "—"}
            fullValue={address}
            onCopy={address ? () => copy(address, "Wallet") : undefined}
            copied={copied === "Wallet"}
          />
          <InfoRow label="Wallet network" value={chain ? `${chain.name} (${chain.id})` : "—"} />
        </InfoCard>

        <InfoCard icon={<Wifi className="h-4 w-4" />} title="Network">
          <InfoRow label="Settlement" value={`${ACTIVE_ARC_DEPLOYMENT.network} (${ACTIVE_ARC_DEPLOYMENT.chainId})`} />
          <InfoRow label="Token" value="USDC" />
          <AddressRow label="Arc USDC" value={ACTIVE_ARC_DEPLOYMENT.usdc} copied={copied === "USDC"} onCopy={() => copy(ACTIVE_ARC_DEPLOYMENT.usdc, "USDC")} />
        </InfoCard>

        <InfoCard icon={<Server className="h-4 w-4" />} title="API ledger">
          <InfoRow label="Status" value={apiState === "checking" ? "Checking" : apiState === "online" ? "Online" : "Unavailable"} tone={apiState} />
          <InfoRow label="Endpoint" value={APP_API_BASE} fullValue={APP_API_BASE} onCopy={() => copy(APP_API_BASE, "API")} copied={copied === "API"} />
          <InfoRow label="Ledger" value="Temporary testnet ledger" />
        </InfoCard>

        <InfoCard icon={<ShieldCheck className="h-4 w-4" />} title="Contracts">
          <AddressRow label="VeilHub" value={ACTIVE_ARC_DEPLOYMENT.veilHub} copied={copied === "VeilHub"} onCopy={() => copy(ACTIVE_ARC_DEPLOYMENT.veilHub, "VeilHub")} />
          <InfoRow label="Private Payment" value="Coming soon with Arc Private Kit" />
          <InfoRow label="VeilShield" value={shieldConfigured ? "Experimental research configured" : "Experimental research only"} />
        </InfoCard>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="surface-card p-5">
      <div className="mb-4 flex items-center gap-2">
        <div className="rounded-md bg-beige p-2 text-walnut">{icon}</div>
        <h2 className="font-display text-lg">{title}</h2>
      </div>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}

function InfoRow({
  label,
  value,
  fullValue,
  onCopy,
  copied,
  tone,
}: {
  label: string;
  value: string;
  fullValue?: string;
  onCopy?: () => void;
  copied?: boolean;
  tone?: ApiState;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-2 text-right">
        <span
          title={fullValue || value}
          className={cn(
            "truncate font-medium",
            tone === "online" && "text-success",
            tone === "offline" && "text-destructive",
            tone === "checking" && "text-muted-foreground"
          )}
        >
          {value}
        </span>
        {onCopy && (
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onCopy} aria-label={`Copy ${label}`}>
            {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}

function AddressRow({ label, value, copied, onCopy }: { label: string; value: string; copied: boolean; onCopy: () => void }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-1.5">
        <a
          href={getArcExplorerAddressUrl(value)}
          target="_blank"
          rel="noreferrer"
          className="truncate font-mono text-xs font-medium underline-offset-4 hover:underline"
        >
          {shortAddress(value)}
        </a>
        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onCopy} aria-label={`Copy ${label}`}>
          {copied ? <CheckCircle2 className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
