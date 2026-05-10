import { useEffect, useState } from "react";
import { useAccount } from "wagmi";
import { SectionHeader } from "@/components/veil/SectionHeader";
import { veilApi } from "@/services/veilApi";
import type { ConfidentialRecord } from "@/types/veil";
import { Button } from "@/components/ui/button";
import { DisclosureBadge } from "@/components/veil/StatusBadges";
import { Lock, Eye, ShieldAlert, ShieldCheck, KeyRound } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function ConfidentialRecords() {
  const { address } = useAccount();
  const [records, setRecords] = useState<ConfidentialRecord[]>([]);
  const [loading, setLoading] = useState<string | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    let cancelled = false;
    setRecords([]);

    if (!address) {
      setStatus("");
      return;
    }

    veilApi
      .listConfidentialRecords(address)
      .then((items) => {
        if (cancelled) return;
        setRecords(items);
        setStatus("");
      })
      .catch((err) => {
        if (cancelled) return;
        setRecords([]);
        setStatus(err instanceof Error ? err.message : "Veilarc API ledger is unavailable.");
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  const requestReveal = async (id: string) => {
    try {
      setLoading(id);
      await veilApi.requestReveal(id);
      setRecords((rs) => rs.map((r) => r.id === id ? { ...r, disclosureStatus: "requested" } : r));
      toast.success("Reveal request submitted", { description: "An authorizer will review shortly." });
    } catch (err) {
      toast.error("Reveal request failed", { description: err instanceof Error ? err.message : "Veilarc API ledger is unavailable." });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Privacy"
        title="Private payment records"
        description="Coming soon with Arc Private Kit."
      />

      <div className="surface-card p-5 bg-confidential-soft/40 ring-confidential">
        <div className="flex items-start gap-3">
          <Lock className="h-4 w-4 mt-0.5 text-confidential" />
          <div className="text-sm">
            <div className="font-medium">Coming soon with Arc Private Kit.</div>
            <p className="text-muted-foreground text-xs mt-0.5">
              Veilarc is preparing native Arc privacy support. Open payments are live today.
            </p>
          </div>
        </div>
      </div>

      {status && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
          <div className="font-medium">API ledger unavailable</div>
          <p className="mt-1 text-muted-foreground">{status}</p>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {records.map((r) => (
          <article key={r.id} className={cn("surface-card p-5 space-y-4 transition-shadow hover:shadow-md",
            r.disclosureStatus === "granted" && "ring-confidential")}>
            <header className="flex items-start justify-between gap-3">
              <div className="space-y-1.5">
                <div className="text-xs text-muted-foreground">Reference</div>
                <div className="font-mono text-sm">{r.commitmentId}</div>
              </div>
              <DisclosureBadge status={r.disclosureStatus} />
            </header>

            <div className="space-y-2 text-sm">
              <Row label="Payment" value={r.paymentId} mono />
              <Row label="Created" value={formatDateTime(r.createdAt)} />
              <Row label="Authorized viewers" value={r.authorizedViewers.length === 0 ? "None" : `${r.authorizedViewers.length}`} />
            </div>

            <div className="border-t border-border pt-4">
              {r.disclosureStatus === "granted" && (
                <div className="rounded-lg bg-success/5 border border-success/20 p-3 text-sm">
                  <div className="flex items-center gap-2 text-success font-medium"><ShieldCheck className="h-4 w-4" />Access granted</div>
                  <p className="text-xs text-muted-foreground mt-1">You may decrypt and view the underlying payment payload.</p>
                  <Button size="sm" variant="outline" className="mt-3"><Eye className="h-3.5 w-3.5 mr-1.5" />Open record</Button>
                </div>
              )}
              {r.disclosureStatus === "requested" && (
                <div className="rounded-lg bg-warning/5 border border-warning/20 p-3 text-sm">
                  <div className="flex items-center gap-2 text-warning font-medium"><KeyRound className="h-4 w-4" />Awaiting approval</div>
                  <p className="text-xs text-muted-foreground mt-1">Reveal request is pending review by an authorizer.</p>
                </div>
              )}
              {(r.disclosureStatus === "private" || r.disclosureStatus === "revoked") && (
                <div className="rounded-lg bg-muted/40 border border-border p-3 text-sm">
                  <div className="flex items-center gap-2 font-medium"><ShieldAlert className="h-4 w-4 text-muted-foreground" />Not authorized</div>
                  <p className="text-xs text-muted-foreground mt-1">You don't have access to this record.</p>
                  <Button size="sm" className="mt-3 bg-confidential hover:bg-confidential/90 text-confidential-foreground"
                    disabled={loading === r.id} onClick={() => requestReveal(r.id)}>
                    Request reveal
                  </Button>
                </div>
              )}
            </div>
          </article>
        ))}

        {records.length === 0 && !status && (
          <div className="surface-card p-5 text-sm text-muted-foreground md:col-span-2">
            No private payment records yet for this wallet.
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground text-xs uppercase tracking-wider">{label}</span>
      <span className={mono ? "font-mono text-xs" : ""}>{value}</span>
    </div>
  );
}
