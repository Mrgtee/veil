import { useState } from "react";
import type { ReactNode } from "react";
import { useAccount } from "wagmi";
import { CheckCircle2, Copy, ExternalLink, Wallet, Wifi } from "lucide-react";
import { SectionHeader } from "@/components/veil/SectionHeader";
import { Button } from "@/components/ui/button";
import { ACTIVE_ARC_DEPLOYMENT, shortAddress } from "@/lib/deployment";

const ARC_TESTNET_FAUCET_URL = "https://faucet.circle.com";

export default function Settings() {
  const { address, isConnected, chain } = useAccount();
  const [copied, setCopied] = useState("");

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 1500);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Workspace"
        title="Settings"
        description="Wallet and Arc Testnet setup."
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
          <div className="flex min-h-12 items-center justify-between gap-4 py-3 text-sm">
            <span className="text-muted-foreground">Test USDC</span>
            <Button asChild variant="outline" size="sm" className="gap-2">
              <a href={ARC_TESTNET_FAUCET_URL} target="_blank" rel="noreferrer">
                Open faucet
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
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
}: {
  label: string;
  value: string;
  fullValue?: string;
  onCopy?: () => void;
  copied?: boolean;
}) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-2 text-right">
        <span
          title={fullValue || value}
          className="truncate font-medium"
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
