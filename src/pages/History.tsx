import { useEffect, useMemo, useState } from "react";
import { SectionHeader } from "@/components/veil/SectionHeader";
import { veilApi } from "@/services/veilApi";
import type { Payment } from "@/types/veil";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, ExternalLink, Eye, Lock, Download, WalletCards } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatAmount, formatDateTime } from "@/lib/format";
import { PaymentDetailsDrawer } from "@/components/veil/PaymentDetailsDrawer";
import { getArcExplorerTxUrl } from "@/lib/deployment";
import { getPaymentSourceLabel, isUnifiedPaymentSource } from "@/lib/payments/types";

type Filter =
  | "all"
  | "open"
  | "confidential"
  | "single"
  | "batch"
  | "pending"
  | "settled"
  | "failed"
  | "unified";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "confidential", label: "Closed" },
  { id: "unified", label: "Unified Balance" },
  { id: "single", label: "Single" },
  { id: "batch", label: "Batch" },
  { id: "pending", label: "Pending" },
  { id: "settled", label: "Settled" },
  { id: "failed", label: "Failed" },
];

function getLiquiditySource(payment: Payment) {
  const p = payment as Payment & {
    liquiditySource?: string;
    sourceChain?: string;
    destinationChain?: string;
  };

  const raw = p.liquiditySource || p.source || p.sourceChain;
  return getPaymentSourceLabel(raw, {
    sequential: p.type === "batch" && isUnifiedPaymentSource(raw || p.source),
  });
}

function getDestination(payment: Payment) {
  const p = payment as Payment & {
    destinationChain?: string;
  };

  return p.destinationChain || "Arc Testnet";
}

function isUnifiedPayment(payment: Payment) {
  return getLiquiditySource(payment).toLowerCase().includes("unified");
}

function isExplorerTx(value?: string): value is string {
  return Boolean(value && /^0x[a-fA-F0-9]{64}$/.test(value));
}

function modeLabel(mode: string) {
  return mode === "confidential" ? "Closed" : "Open";
}

function operationLabel(payment: Payment) {
  if (payment.operation === "shield_deposit") return "VeilShield deposit";
  if (payment.operation === "shield_transfer") return "VeilShield hidden transfer";
  if (payment.operation === "shield_withdraw") return "VeilShield withdraw";
  return `${payment.type} payment`;
}

function ModeBadge({ mode }: { mode: string }) {
  const isPrivate = mode === "confidential";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
        isPrivate
          ? "border-purple-200 bg-purple-50 text-purple-700"
          : "border-amber-200 bg-amber-50 text-amber-800"
      )}
    >
      {isPrivate && <Lock className="h-3 w-3" />}
      {modeLabel(mode)}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === "settled";
  const label = status.replaceAll("_", " ");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-1 text-xs font-medium capitalize",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-orange-200 bg-orange-50 text-orange-700"
      )}
    >
      {label}
    </span>
  );
}

function SourceBadge({ payment }: { payment: Payment }) {
  const source = getLiquiditySource(payment);
  const unified = isUnifiedPayment(payment);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
        unified
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-stone-200 bg-stone-50 text-stone-700"
      )}
    >
      {unified && <WalletCards className="h-3 w-3" />}
      {source}
    </span>
  );
}

export default function History() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Payment | null>(null);
  const [ledgerStatus, setLedgerStatus] = useState("");

  useEffect(() => {
    veilApi
      .listPayments()
      .then((items) => {
        setPayments(items);
        setLedgerStatus("");
      })
      .catch((err) => {
        setLedgerStatus(err instanceof Error ? err.message : "Veil API ledger is unavailable.");
        setPayments([]);
      });
  }, []);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const q = query.toLowerCase();

      const matchesQ =
        !q ||
        p.id.toLowerCase().includes(q) ||
        p.recipient.toLowerCase().includes(q) ||
        (p.recipientLabel ?? "").toLowerCase().includes(q) ||
        (p.txHash ?? "").toLowerCase().includes(q) ||
        getLiquiditySource(p).toLowerCase().includes(q);

      const matchesF =
        filter === "all"
          ? true
          : filter === "open"
          ? p.mode === "open"
          : filter === "confidential"
          ? p.mode === "confidential"
          : filter === "unified"
          ? isUnifiedPayment(p)
          : filter === "single"
          ? p.type === "single"
          : filter === "batch"
          ? p.type === "batch"
          : filter === "pending"
            ? p.status === "pending" || p.status === "pending_settlement" || p.status === "pending_veilhub_registration"
            : p.status === filter;

      return matchesQ && matchesF;
    });
  }, [payments, filter, query]);

  function exportCsv() {
    const header = [
      "id",
      "recipientLabel",
      "recipient",
      "amount",
      "token",
      "mode",
      "type",
      "status",
      "liquiditySource",
      "destination",
      "txHash",
      "commitmentId",
      "createdAt",
    ];

    const rows = filtered.map((p) => [
      p.id,
      p.recipientLabel ?? "",
      p.recipient,
      p.amount,
      p.token,
      modeLabel(p.mode),
      p.type,
      p.status,
      getLiquiditySource(p),
      getDestination(p),
      p.txHash ?? "",
      p.commitmentId ?? "",
      p.createdAt,
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "veil-payment-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Ledger"
        title="Payment history"
        description="Search and inspect open payments, pending settlements, and closed-payment references."
        actions={
          <Button variant="outline" onClick={exportCsv}>
            <Download className="h-4 w-4 mr-2" /> Export CSV
          </Button>
        }
      />

      <div className="surface-card p-4 space-y-4">
        {ledgerStatus && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
            <div className="font-medium">API ledger unavailable</div>
            <p className="mt-1 text-muted-foreground">{ledgerStatus}</p>
          </div>
        )}

        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ID, recipient, tx, source…"
            className="pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                filter === f.id
                  ? "bg-walnut text-primary-foreground border-walnut"
                  : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-walnut/40"
              )}
            >
              {f.label}
              {filter === f.id && <span className="ml-1.5 opacity-70">{filtered.length}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="bg-secondary/50 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-5 py-3">Payment</th>
                <th className="text-left font-medium px-5 py-3">Recipient</th>
                <th className="text-right font-medium px-5 py-3">Amount</th>
                <th className="text-left font-medium px-5 py-3">Mode</th>
                <th className="text-left font-medium px-5 py-3">Source</th>
                <th className="text-left font-medium px-5 py-3">Destination</th>
                <th className="text-left font-medium px-5 py-3">Status</th>
                <th className="text-left font-medium px-5 py-3">Final Tx / Reference</th>
                <th className="text-left font-medium px-5 py-3">Date</th>
                <th className="text-right font-medium px-5 py-3">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-secondary/40 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="font-mono text-xs text-muted-foreground">{p.id}</div>
                    <div className="text-xs text-muted-foreground capitalize mt-1">
                      {operationLabel(p)}
                    </div>
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="font-medium">{p.recipientLabel ?? p.recipient}</div>
                    {p.recipientLabel && (
                      <div className="text-xs text-muted-foreground font-mono break-all">
                        {p.recipient}
                      </div>
                    )}
                  </td>

                  <td className="px-5 py-3.5 text-right tabular-nums font-medium">
                    {p.amountHidden ? "Hidden amount" : formatAmount(p.amount, p.token)}
                  </td>

                  <td className="px-5 py-3.5">
                    <ModeBadge mode={p.mode} />
                  </td>

                  <td className="px-5 py-3.5">
                    <SourceBadge payment={p} />
                  </td>

                  <td className="px-5 py-3.5 text-muted-foreground">
                    {getDestination(p)}
                  </td>

                  <td className="px-5 py-3.5">
                    <StatusBadge status={p.status} />
                  </td>

                  <td className="px-5 py-3.5 font-mono text-xs max-w-[240px]">
                    {isExplorerTx(p.txHash) ? (
                      <a
                        className="underline break-all"
                        href={getArcExplorerTxUrl(p.txHash)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {p.txHash}
                      </a>
                    ) : p.txHash || p.pendingReference ? (
                      <span className="break-all text-muted-foreground">{p.txHash || p.pendingReference}</span>
                    ) : p.mode === "confidential" && p.commitmentId ? (
                      <span className="inline-flex items-center gap-1 text-confidential break-all">
                        <Lock className="h-3 w-3 shrink-0" />
                        {p.commitmentId}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>

                  <td className="px-5 py-3.5 text-muted-foreground whitespace-nowrap">
                    {formatDateTime(p.createdAt)}
                  </td>

                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setActive(p)}>
                        <Eye className="h-3.5 w-3.5 mr-1" /> View
                      </Button>

                      {isExplorerTx(p.txHash) && (
                        <Button variant="ghost" size="sm" aria-label="Open in explorer" asChild>
                          <a
                            href={getArcExplorerTxUrl(p.txHash)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-5 py-12 text-center text-muted-foreground">
                    No payments match your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PaymentDetailsDrawer payment={active} onClose={() => setActive(null)} />
    </div>
  );
}
