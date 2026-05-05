import type { Payment } from "@/types/veil";
import { Button } from "@/components/ui/button";
import { ExternalLink, Lock, WalletCards, X } from "lucide-react";
import { formatAmount, formatDateTime } from "@/lib/format";
import { getArcExplorerTxUrl } from "@/lib/deployment";
import { getPaymentSourceLabel } from "@/lib/payments/types";
import { cn } from "@/lib/utils";

type ExtendedPayment = Payment & {
  liquiditySource?: string;
  sourceChain?: string;
  destinationChain?: string;
  memo?: string;
  bridgeUsed?: boolean;
  bridgeTxHashes?: string[];
  batchId?: string;
  batchCount?: number;
};

function modeLabel(mode: string) {
  return mode === "confidential" ? "Closed" : "Open";
}

function getLiquiditySource(payment: ExtendedPayment) {
  return getPaymentSourceLabel(payment.source || payment.liquiditySource || payment.sourceChain);
}

function getDestination(payment: ExtendedPayment) {
  return payment.destinationChain || "Arc Testnet";
}

function isUnifiedPayment(payment: ExtendedPayment) {
  return getLiquiditySource(payment).toLowerCase().includes("unified");
}

function isArcDirectPayment(payment: ExtendedPayment) {
  return !isUnifiedPayment(payment) && payment.source !== "veilshield_closed";
}

function isExplorerTx(value: string) {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

function Row({
  label,
  value,
  mono,
  children,
}: {
  label: string;
  value?: string;
  mono?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="grid gap-1 rounded-lg border bg-background p-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>

      {children ? (
        children
      ) : (
        <div className={cn("text-sm font-medium break-all", mono && "font-mono text-xs")}>
          {value || "—"}
        </div>
      )}
    </div>
  );
}

function ModeBadge({ mode }: { mode: string }) {
  const isClosed = mode === "confidential";

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
        isClosed
          ? "border-purple-200 bg-purple-50 text-purple-700"
          : "border-amber-200 bg-amber-50 text-amber-800"
      )}
    >
      {isClosed && <Lock className="h-3 w-3" />}
      {modeLabel(mode)}
    </span>
  );
}

function SourceBadge({ payment }: { payment: ExtendedPayment }) {
  const source = getLiquiditySource(payment);
  const unified = isUnifiedPayment(payment);

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium",
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

export function PaymentDetailsDrawer({
  payment,
  onClose,
}: {
  payment: Payment | null;
  onClose: () => void;
}) {
  if (!payment) return null;

  const p = payment as ExtendedPayment;
  const isClosed = p.mode === "confidential";
  const isUnified = isUnifiedPayment(p);
  const isArcDirect = isArcDirectPayment(p);
  const transactionRefs = p.txHash
    ? p.txHash.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
  const veilHubRefs =
    p.veilHubTxHash && p.veilHubTxHash !== p.txHash
      ? p.veilHubTxHash.split(",").map((item) => item.trim()).filter(Boolean)
      : [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20 backdrop-blur-sm">
      <button
        aria-label="Close payment details"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l bg-background shadow-xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b bg-background/95 p-5 backdrop-blur">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Payment details
            </div>
            <h2 className="font-display text-2xl font-semibold">
              {p.recipientLabel || "Arc payment"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isUnified
                ? "Unified Balance USDC payment settled on Arc."
                : "Arc Direct payment settled through VeilHub on Arc."}
            </p>
          </div>

          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-5 p-5">
          <div className="rounded-xl border bg-secondary/30 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <ModeBadge mode={p.mode} />
              <SourceBadge payment={p} />
              <span className="inline-flex w-fit rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium capitalize text-emerald-700">
                {p.status.replaceAll("_", " ")}
              </span>
            </div>

            <div className="mt-4 text-3xl font-semibold">
              {formatAmount(p.amount, p.token)}
            </div>

            <p className="mt-1 text-sm text-muted-foreground">
              Completed on {getDestination(p)}
            </p>
          </div>

          <div className="grid gap-3">
            <Row label="Ledger record ID" value={p.id} mono />

            <Row label="Recipient">
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  {p.recipientLabel || p.recipient}
                </div>
                <div className="break-all font-mono text-xs text-muted-foreground">
                  {p.recipient}
                </div>
              </div>
            </Row>

            <div className="grid grid-cols-2 gap-3">
              <Row label="Mode">
                <ModeBadge mode={p.mode} />
              </Row>

              <Row label="Type" value={`${p.type} payment`} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Row label="Source">
                <SourceBadge payment={p} />
              </Row>

              <Row label="Status" value={p.status.replaceAll("_", " ")} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Row label="Token" value={p.token || "USDC"} />

              <Row label="Destination" value={getDestination(p)} />
            </div>

            <Row label="Created" value={formatDateTime(p.createdAt)} />

            {p.memo && <Row label="Memo / reference" value={p.memo} />}

            {p.paymentId && <Row label="VeilHub payment ID" value={p.paymentId} mono />}

            {p.batchId && <Row label="VeilHub batch ID" value={p.batchId} mono />}

            {p.batchCount !== undefined && (
              <Row label="Batch recipients" value={String(p.batchCount)} />
            )}

            {p.pendingReference && (
              <Row label="Pending reference" value={p.pendingReference} mono />
            )}
          </div>

          {transactionRefs.length > 0 && (
            <div className="rounded-xl border p-4">
              <div className="mb-3 text-sm font-medium">
                {isArcDirect ? "VeilHub tx hash" : "Arc transaction or settlement reference"}
              </div>
              <div className="space-y-2">
                {transactionRefs.map((tx) => (
                  <div key={tx} className="rounded-lg border bg-background p-3">
                    <div className="break-all font-mono text-xs text-muted-foreground">{tx}</div>
                    {isExplorerTx(tx) && (
                      <Button asChild variant="outline" size="sm" className="mt-3">
                        <a href={getArcExplorerTxUrl(tx)} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-3.5 w-3.5" />
                          View on Arc explorer
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {veilHubRefs.length > 0 && (
            <div className="rounded-xl border p-4">
              <div className="mb-3 text-sm font-medium">VeilHub registration tx hash</div>
              <div className="space-y-2">
                {veilHubRefs.map((tx) => (
                  <div key={tx} className="rounded-lg border bg-background p-3">
                    <div className="break-all font-mono text-xs text-muted-foreground">{tx}</div>
                    {isExplorerTx(tx) && (
                      <Button asChild variant="outline" size="sm" className="mt-3">
                        <a href={getArcExplorerTxUrl(tx)} target="_blank" rel="noreferrer">
                          <ExternalLink className="mr-2 h-3.5 w-3.5" />
                          View on Arc explorer
                        </a>
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {isClosed && (
            <div className="rounded-xl border border-purple-200 bg-purple-50/50 p-4">
              <div className="flex items-center gap-2 text-sm font-medium text-purple-800">
                <Lock className="h-4 w-4" />
                Closed payment reference
              </div>

              <p className="mt-2 text-sm text-muted-foreground">
                Closed payments are intended to hide the amount onchain through VeilShield. Records here are references only unless a deployed VeilShield settlement produced them.
              </p>

              {p.commitmentId && (
                <div className="mt-3 rounded-lg border bg-background p-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    Commitment reference
                  </div>
                  <div className="mt-1 break-all font-mono text-xs">
                    {p.commitmentId}
                  </div>
                </div>
              )}
            </div>
          )}

          {Array.isArray(p.bridgeTxHashes) && p.bridgeTxHashes.length > 0 && (
            <div className="rounded-xl border p-4">
              <div className="mb-3 text-sm font-medium">Related transaction hashes</div>

              <div className="space-y-2">
                {p.bridgeTxHashes.map((tx, idx) => (
                  <a
                    key={`${tx}-${idx}`}
                    href={getArcExplorerTxUrl(tx)}
                    target="_blank"
                    rel="noreferrer"
                    className="block break-all rounded-lg border bg-background p-3 font-mono text-xs underline"
                  >
                    {tx}
                  </a>
                ))}
              </div>
            </div>
          )}

          {p.settlementNote && (
            <div className="rounded-xl border bg-secondary/20 p-4 text-sm">
              <div className="font-medium">Settlement note</div>
              <p className="mt-1 text-muted-foreground">{p.settlementNote}</p>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
