import { useEffect, useState } from "react";
import { SectionHeader } from "@/components/veil/SectionHeader";
import { veilApi } from "@/services/veilApi";
import type { AuditEvent, ConfidentialRecord, DisclosureAccess } from "@/types/veil";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DisclosureBadge } from "@/components/veil/StatusBadges";
import { Plus, X, ShieldCheck, History as HistoryIcon } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

export default function AccessControl() {
  const [records, setRecords] = useState<ConfidentialRecord[]>([]);
  const [access, setAccess] = useState<DisclosureAccess[]>([]);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [selected, setSelected] = useState<ConfidentialRecord | null>(null);
  const [viewer, setViewer] = useState("");
  const [days, setDays] = useState("30");
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");

  async function loadAccessState() {
    try {
      const [nextRecords, nextAccess, nextAudit] = await Promise.all([
        veilApi.listConfidentialRecords(),
        veilApi.listDisclosureAccess(),
        veilApi.listAuditTrail(),
      ]);
      setRecords(nextRecords);
      setAccess(nextAccess);
      setAudit(nextAudit);
      setStatus("");
    } catch (err) {
      setRecords([]);
      setAccess([]);
      setAudit([]);
      setStatus(err instanceof Error ? err.message : "Veil API ledger is unavailable.");
    }
  }

  useEffect(() => {
    loadAccessState();
  }, []);

  const grant = async () => {
    if (!selected || !viewer) return;
    try {
      const nextAccess = await veilApi.grantAccess({ recordId: selected.id, viewer, durationDays: parseInt(days) || undefined });
      setAccess((a) => [nextAccess, ...a]);
      setRecords((rs) => rs.map((r) => r.id === selected.id ? { ...r, disclosureStatus: "granted", authorizedViewers: [...new Set([...r.authorizedViewers, viewer])] } : r));
      await veilApi.listAuditTrail().then(setAudit);
      toast.success("Access granted", { description: `${viewer} can now view ${selected.commitmentId}` });
      setOpen(false); setViewer("");
    } catch (err) {
      toast.error("Access grant failed", { description: err instanceof Error ? err.message : "Veil API ledger is unavailable." });
    }
  };

  const revoke = async (a: DisclosureAccess) => {
    try {
      await veilApi.revokeAccess(a.id);
      setAccess((all) => all.map((x) => x.id === a.id ? { ...x, revoked: true } : x));
      await veilApi.listAuditTrail().then(setAudit);
      toast.success("Access revoked");
    } catch (err) {
      toast.error("Access revoke failed", { description: err instanceof Error ? err.message : "Veil API ledger is unavailable." });
    }
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Compliance"
        title="Access control"
        description="Manage disclosure permissions for VeilShield closed-payment records and review the audit trail."
      />

      <div className="rounded-lg border border-confidential/30 bg-confidential-soft/60 p-4 text-sm">
        Closed-payment access is ready for VeilShield records, but hidden-amount settlement is blocked until verifier/circuit-backed VeilShield transfers are deployed and audited.
      </div>

      {status && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
          <div className="font-medium">API ledger unavailable</div>
          <p className="mt-1 text-muted-foreground">{status}</p>
        </div>
      )}

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        <div className="space-y-6">
          {/* Records -> grant access */}
          <div className="surface-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg">Closed records</h3>
                <p className="text-xs text-muted-foreground">Grant or revoke disclosure access</p>
              </div>
            </div>
            <div className="divide-y divide-border">
              {records.map((r) => {
                const grants = access.filter((a) => a.recordId === r.id && !a.revoked);
                return (
                  <div key={r.id} className="px-5 py-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm">{r.commitmentId}</span>
                        <DisclosureBadge status={r.disclosureStatus} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Payment {r.paymentId} · {formatDateTime(r.createdAt)}
                      </div>
                      {grants.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {grants.map((g) => (
                            <span key={g.id} className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-md bg-beige text-walnut border border-sand">
                              {g.viewerLabel ?? g.viewer}
                              <button onClick={() => revoke(g)} aria-label="Revoke" className="hover:text-destructive">
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <Dialog open={open && selected?.id === r.id} onOpenChange={(o) => { setOpen(o); if (o) setSelected(r); }}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">
                          <Plus className="h-3.5 w-3.5 mr-1.5" />Grant access
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle className="font-display">Grant disclosure access</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                          <div className="rounded-md bg-secondary/60 px-3 py-2 text-xs font-mono">{r.commitmentId}</div>
                          <div className="space-y-1.5">
                            <Label>Viewer (email or wallet)</Label>
                            <Input value={viewer} onChange={(e) => setViewer(e.target.value)} placeholder="auditor@firm.com or 0x…" />
                          </div>
                          <div className="space-y-1.5">
                            <Label>Access duration (days)</Label>
                            <Input type="number" value={days} onChange={(e) => setDays(e.target.value)} />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
                          <Button onClick={grant} disabled={!viewer.trim()} className="bg-confidential text-confidential-foreground hover:opacity-95">
                            <ShieldCheck className="h-4 w-4 mr-2" />Grant access
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                );
              })}
              {records.length === 0 && !status && (
                <div className="px-5 py-8 text-sm text-muted-foreground">
                  No VeilShield records are available yet. Closed settlement remains setup-required.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Audit trail */}
        <div className="space-y-4">
          <div className="surface-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <HistoryIcon className="h-4 w-4 text-walnut" />
              <h3 className="font-display text-base">Audit trail</h3>
            </div>
            <ol className="space-y-4">
              {audit.map((e) => (
                <li key={e.id} className="text-sm relative pl-4 border-l border-border">
                  <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-walnut" />
                  <div className="font-medium">{e.action}</div>
                  <div className="text-xs text-muted-foreground">{e.actor}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{e.target}</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{formatDateTime(e.timestamp)}</div>
                </li>
              ))}
              {audit.length === 0 && (
                <li className="text-sm text-muted-foreground">No audit events yet.</li>
              )}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
