import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { AlertCircle, CheckCircle2, Clock, ExternalLink, Plus, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/veil/SectionHeader";
import {
  PAYMENT_MODE_OPTIONS,
  PAYMENT_SOURCE_OPTIONS,
  getPaymentSourceLabel,
  type PaymentSource,
} from "@/lib/payments/types";
import type { PaymentMode } from "@/types/veil";
import {
  cleanBatchRows,
  getBatchTotal,
  getVeilHubSetup,
  registerUnifiedBalanceReference,
  sendVeilHubOpenBatch,
  type BatchRecipientRow,
} from "@/lib/payments/arcDirect";
import { formatPaymentError, getErrorMessage, isSettlementDelay } from "@/lib/payments/errors";
import { makeBytes32Id, makeId } from "@/lib/payments/ids";
import { recordBatchPayment } from "@/lib/payments/recording";
import { getVeilShieldSetup } from "@/lib/payments/veilShield";
import {
  balanceReducedEnough,
  getBalanceNumber,
  getFinalTxHash,
  readUnifiedBalance,
  spendUnifiedBalanceToArc,
} from "@/lib/payments/unifiedBalance";
import { cn } from "@/lib/utils";

type RowResult = {
  rowId: string;
  recipientLabel: string;
  recipient: string;
  amount: string;
  status:
    | "pending"
    | "processing"
    | "awaiting_wallet_approval"
    | "settled"
    | "pending_settlement"
    | "pending_veilhub_registration"
    | "failed";
  txHash?: string;
  veilHubTxHash?: string;
  error?: string;
};

const SETTLEMENT_TIMEOUT_MS = 90_000;

function emptyRow(): BatchRecipientRow {
  return {
    id: makeId("row"),
    recipient: "",
    amount: "",
    recipientLabel: "",
    memo: "",
  };
}

function withSettlementTimeout<T>(promise: Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("Unified Balance spend is still finalizing Arc settlement."));
    }, SETTLEMENT_TIMEOUT_MS);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
}

function SelectionButton({
  active,
  title,
  description,
  onClick,
  disabled,
}: {
  active: boolean;
  title: string;
  description: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-lg border p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        active ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary/40"
      )}
    >
      <div className="font-medium">{title}</div>
      <div className={cn("mt-1 text-sm", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
        {description}
      </div>
    </button>
  );
}

function getBatchSourceTitle(source: PaymentSource) {
  return source === "arc-direct" ? "Arc Direct (recommended)" : "Unified Balance (sequential)";
}

function getBatchSourceDescription(source: PaymentSource) {
  return source === "arc-direct"
    ? "One USDC approval if needed, then one VeilHub batch transaction for every recipient."
    : "One Circle AppKit spend and wallet approval per recipient for now.";
}

function getRowStatusLabel(status: RowResult["status"]) {
  switch (status) {
    case "awaiting_wallet_approval":
      return "awaiting wallet approval";
    case "pending_settlement":
      return "pending settlement";
    case "pending_veilhub_registration":
      return "pending VeilHub registration";
    case "processing":
      return "submitting";
    case "pending":
      return "queued";
    default:
      return status;
  }
}

function getRowStatusClass(status: RowResult["status"]) {
  if (status === "settled") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "failed") return "border-destructive/30 bg-destructive/5 text-destructive";
  if (status === "pending_settlement" || status === "pending_veilhub_registration") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }
  return "border-blue-200 bg-blue-50 text-blue-700";
}

export default function BatchPayments() {
  const { address, isConnected } = useAccount();
  const [rows, setRows] = useState<BatchRecipientRow[]>([emptyRow()]);
  const [mode, setMode] = useState<PaymentMode | null>(null);
  const [source, setSource] = useState<PaymentSource | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [results, setResults] = useState<RowResult[]>([]);
  const submittingRef = useRef(false);
  const veilHubSetup = getVeilHubSetup();
  const veilShieldSetup = getVeilShieldSetup();

  const totalAmount = useMemo(() => getBatchTotal(rows), [rows]);
  const filledRows = useMemo(
    () => rows.filter((row) => row.recipient || row.amount || row.recipientLabel || row.memo).length,
    [rows]
  );
  const isClosedMode = mode === "confidential";

  const canSubmit = useMemo(() => {
    if (!mode || !source || isClosedMode) return false;
    if (source === "arc-direct" && !veilHubSetup.ready) return false;
    try {
      cleanBatchRows(rows);
      return true;
    } catch {
      return false;
    }
  }, [isClosedMode, mode, rows, source, veilHubSetup.ready]);

  function updateRow(id: string, field: keyof BatchRecipientRow, value: string) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, [field]: value } : row)));
  }

  function addRow() {
    setRows((current) => [...current, emptyRow()]);
  }

  function removeRow(id: string) {
    setRows((current) => (current.length === 1 ? current : current.filter((row) => row.id !== id)));
  }

  function setRowResult(rowId: string, patch: Partial<RowResult>) {
    setResults((current) => current.map((item) => (item.rowId === rowId ? { ...item, ...patch } : item)));
  }

  async function submitArcDirectBatch(cleanRows: BatchRecipientRow[], nextBatchId: `0x${string}`) {
    if (!veilHubSetup.ready) {
      throw new Error(`Arc Direct requires VeilHub setup: ${veilHubSetup.missing.join(", ")}.`);
    }

    const recipients = cleanRows.map((row) => row.recipient as `0x${string}`);
    const amounts = cleanRows.map((row) => row.amount);
    const paymentIds = cleanRows.map(() => makeBytes32Id());

    setResults(
      cleanRows.map((row) => ({
        rowId: row.id,
        recipientLabel: row.recipientLabel || row.recipient,
        recipient: row.recipient,
        amount: row.amount,
        status: "processing",
      }))
    );

    setStatus("Checking USDC allowance and submitting the batch through VeilHub...");
    const hubResult = await sendVeilHubOpenBatch({
      batchId: nextBatchId,
      recipients,
      amounts,
      paymentIds,
    });

    setResults((current) => current.map((row) => ({ ...row, status: "settled", txHash: hubResult.txHash })));

    try {
      await recordBatchPayment({
        mode: "open",
        source: "arc-direct",
        rows: cleanRows,
        txHash: hubResult.txHash,
        batchId: nextBatchId,
        amountBase: hubResult.amountBase,
        decimals: hubResult.decimals,
        status: "settled",
        settlementNote: hubResult.approvalTxHash
          ? `USDC approval ${hubResult.approvalTxHash} confirmed before VeilHub batch.`
          : "Existing USDC allowance was sufficient for VeilHub.",
      });
    } catch (ledgerErr) {
      throw new Error(`Batch transaction submitted (${hubResult.txHash}), but API ledger write failed: ${getErrorMessage(ledgerErr)}`);
    }

    setStatus("Arc Direct batch settled through VeilHub on Arc.");
  }

  async function submitUnifiedBalanceBatch(cleanRows: BatchRecipientRow[], nextBatchId: `0x${string}`) {
    if (!address) throw new Error("Wallet is not connected.");

    const settledTxHashes: string[] = [];
    const veilHubTxHashes: string[] = [];
    const pendingRegistrations: string[] = [];
    const pendingSettlements: string[] = [];
    const paymentIds = cleanRows.map(() => makeBytes32Id());

    setResults(
      cleanRows.map((row) => ({
        rowId: row.id,
        recipientLabel: row.recipientLabel || row.recipient,
        recipient: row.recipient,
        amount: row.amount,
        status: "pending",
      }))
    );

    for (let index = 0; index < cleanRows.length; index += 1) {
      const row = cleanRows[index];
      const before = await readUnifiedBalance(address);
      const beforeBalance = getBalanceNumber(before, "totalConfirmedBalance");

      setStatus(`Sequential Unified Balance batch: recipient ${index + 1} of ${cleanRows.length} is awaiting wallet approval. Each recipient creates its own spend.`);
      setRowResult(row.id, { status: "awaiting_wallet_approval" });

      try {
        const raw = await withSettlementTimeout(
          spendUnifiedBalanceToArc({
            amount: row.amount,
            recipientAddress: row.recipient as `0x${string}`,
          })
        );

        const txHash = getFinalTxHash(raw);
        settledTxHashes.push(txHash);
        let rowStatus: RowResult["status"] = "settled";

        if (txHash) {
          const registration = await registerUnifiedBalanceReference({
            paymentId: paymentIds[index],
            recipient: row.recipient as `0x${string}`,
            amount: row.amount,
            settlementReference: txHash as `0x${string}`,
          }).catch((registrationErr) => ({
            registered: false as const,
            missing: [getErrorMessage(registrationErr, "VeilHub registration failed.")],
          }));

          if (registration.registered) {
            veilHubTxHashes.push(registration.txHash);
          } else {
            rowStatus = "pending_veilhub_registration";
            pendingRegistrations.push(`recipient ${index + 1}: ${registration.missing.join(", ")}`);
          }
        } else {
          rowStatus = "pending_settlement";
          pendingSettlements.push(makeId(`pending_settlement_${index + 1}`));
        }

        setRowResult(row.id, { status: rowStatus, txHash });
      } catch (err) {
        const message = getErrorMessage(err, `Recipient ${index + 1} failed.`);

        if (isSettlementDelay(err)) {
          const after = await readUnifiedBalance(address);
          const afterBalance = getBalanceNumber(after, "totalConfirmedBalance");

          if (balanceReducedEnough(beforeBalance, afterBalance, Number(row.amount))) {
            const pendingRef = makeId("pending_unified_batch");
            setRowResult(row.id, { status: "pending_settlement", txHash: pendingRef, error: message });

            try {
              await recordBatchPayment({
                mode: "open",
                source: "unified-balance",
                rows: cleanRows,
                txHash: settledTxHashes.filter(Boolean).join(",") || undefined,
                pendingReference: pendingRef,
                veilHubTxHash: veilHubTxHashes.join(",") || undefined,
                batchId: nextBatchId,
                status: "pending_settlement",
                settlementNote: `Unified Balance was deducted for recipient ${index + 1}, but final Arc settlement confirmation was delayed.`,
              });
            } catch (ledgerErr) {
              throw new Error(`Unified Balance was deducted (${pendingRef}), but API ledger write failed: ${getErrorMessage(ledgerErr)}`);
            }

            setStatus(`Sequential Unified Balance batch: recipient ${index + 1} of ${cleanRows.length} was deducted, but final Arc settlement confirmation is delayed. The batch was saved as pending.`);
            return;
          }
        }

        setRowResult(row.id, { status: "failed", error: message });

        if (settledTxHashes.length > 0) {
          await recordBatchPayment({
            mode: "open",
            source: "unified-balance",
            rows: cleanRows,
            txHash: settledTxHashes.join(","),
            veilHubTxHash: veilHubTxHashes.join(",") || undefined,
            batchId: nextBatchId,
            status: "failed",
            settlementNote: `Sequential Unified Balance batch stopped at recipient ${index + 1}: ${message}`,
            error: message,
          });
        }

        throw new Error(message);
      }
    }

    const ledgerStatus =
      pendingSettlements.length > 0
        ? "pending_settlement"
        : pendingRegistrations.length > 0
          ? "pending_veilhub_registration"
          : "settled";

    try {
      await recordBatchPayment({
        mode: "open",
        source: "unified-balance",
        rows: cleanRows,
        txHash: settledTxHashes.filter(Boolean).join(",") || undefined,
        veilHubTxHash: veilHubTxHashes.join(",") || undefined,
        pendingReference:
          ledgerStatus === "settled"
            ? undefined
            : pendingSettlements[0] || makeId("pending_veilhub_batch"),
        batchId: nextBatchId,
        status: ledgerStatus,
        settlementNote:
          ledgerStatus === "settled"
            ? "Sequential Unified Balance batch completed: each recipient was paid through its own Circle AppKit spend and registered with VeilHub."
            : ledgerStatus === "pending_settlement"
              ? "Sequential Unified Balance batch returned without every final Arc settlement hash. Confirm settlement before treating it as complete."
              : `Sequential Unified Balance batch paid recipients one at a time, but VeilHub registration is pending: ${pendingRegistrations.join("; ")}.`,
      });
    } catch (ledgerErr) {
      throw new Error(`Batch settlement submitted (${settledTxHashes.join(",")}), but API ledger write failed: ${getErrorMessage(ledgerErr)}`);
    }

    setStatus(
      ledgerStatus === "settled"
        ? `Sequential Unified Balance batch settled for ${cleanRows.length} recipients.`
        : ledgerStatus === "pending_settlement"
          ? "Sequential Unified Balance batch was saved as pending settlement."
          : "Sequential Unified Balance batch settled on Arc and was saved as pending VeilHub registration."
    );
  }

  async function submitBatch() {
    if (submittingRef.current) return;
    submittingRef.current = true;

    try {
      setLoading(true);
      setStatus("Preparing batch...");
      setResults([]);
      setBatchId("");

      if (!isConnected || !address) throw new Error("Wallet is not connected in the app.");
      if (!mode) throw new Error("Choose Open Payment or Closed Payment.");
      if (!source) throw new Error("Choose Arc Direct or Unified Balance USDC.");
      if (isClosedMode) {
        throw new Error(
          `Closed batch payments require VeilShield deposit and proof generation. ${veilShieldSetup.statusLabel}. Visible batch transfers remain blocked.`
        );
      }

      const cleanRows = cleanBatchRows(rows);
      const nextBatchId = makeBytes32Id();
      setBatchId(nextBatchId);

      if (source === "arc-direct") {
        await submitArcDirectBatch(cleanRows, nextBatchId);
      } else {
        await submitUnifiedBalanceBatch(cleanRows, nextBatchId);
      }
    } catch (err) {
      setStatus(formatPaymentError(err, "Batch failed."));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  const submitLabel = loading
    ? "Processing batch..."
    : !mode
      ? "Choose payment mode"
      : !source
        ? "Choose payment source"
        : isClosedMode
          ? "Closed Batch needs VeilShield"
          : source === "arc-direct" && !veilHubSetup.ready
            ? "VeilHub setup required"
            : source === "unified-balance"
              ? "Start Sequential Payouts"
              : "Submit One-Transaction Batch";

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Payments"
        title="Batch payments"
        description="Arc Direct is the true one-transaction batch path. Unified Balance payouts are sequential today."
      />

      <div className="surface-card p-5 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-medium">Recipients</h2>
            <p className="text-sm text-muted-foreground">Each row is validated before any payment is submitted.</p>
          </div>

          <div className="rounded-lg border bg-secondary/30 px-4 py-3 text-sm">
            <div>Rows: <span className="font-medium">{filledRows}</span></div>
            <div>Total: <span className="font-medium tabular-nums">{totalAmount} USDC</span></div>
          </div>
        </div>

        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={row.id} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">Recipient {index + 1}</div>
                {rows.length > 1 && (
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeRow(row.id)} disabled={loading} aria-label="Remove recipient">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`${row.id}-recipient`}>Recipient address</Label>
                  <Input
                    id={`${row.id}-recipient`}
                    value={row.recipient}
                    onChange={(event) => updateRow(row.id, "recipient", event.target.value)}
                    placeholder="0x..."
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${row.id}-amount`}>Amount</Label>
                  <Input
                    id={`${row.id}-amount`}
                    value={row.amount}
                    onChange={(event) => updateRow(row.id, "amount", event.target.value)}
                    placeholder="0.00 USDC"
                    inputMode="decimal"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${row.id}-label`}>Optional label</Label>
                  <Input
                    id={`${row.id}-label`}
                    value={row.recipientLabel}
                    onChange={(event) => updateRow(row.id, "recipientLabel", event.target.value)}
                    placeholder="Recipient name"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${row.id}-memo`}>Optional reference</Label>
                  <Input
                    id={`${row.id}-memo`}
                    value={row.memo}
                    onChange={(event) => updateRow(row.id, "memo", event.target.value)}
                    placeholder="Invoice, payroll run, or note"
                    disabled={loading}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        <Button type="button" variant="outline" onClick={addRow} disabled={loading}>
          <Plus className="mr-2 h-4 w-4" />
          Add recipient
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="surface-card p-5 space-y-3">
          <div>
            <h2 className="text-sm font-medium">Payment mode</h2>
            <p className="text-sm text-muted-foreground">No mode is preselected.</p>
          </div>
          <div className="grid gap-3">
            {PAYMENT_MODE_OPTIONS.map((option) => (
              <SelectionButton
                key={option.value}
                active={mode === option.value}
                title={option.label}
                description={option.description}
                onClick={() => setMode(option.value)}
                disabled={loading}
              />
            ))}
          </div>

          {isClosedMode && (
            <div className="rounded-lg border border-confidential/30 bg-confidential-soft/60 p-3 text-sm">
              <div className="font-medium">Closed batch settlement must hide amounts onchain.</div>
              <p className="mt-1 text-muted-foreground">
                That requires VeilShield deposit, proof generation, hidden transfer, and withdraw. Visible batch
                transfers are intentionally blocked.
              </p>
              <div className="mt-3 rounded-md border border-confidential/20 bg-background/70 p-3">
                <div className="font-medium">{veilShieldSetup.statusLabel}</div>
                <p className="mt-1 text-muted-foreground">{veilShieldSetup.detail}</p>
                {veilShieldSetup.missing.length > 0 && (
                  <div className="mt-2 font-mono text-xs">
                    Missing: {veilShieldSetup.missing.join(", ")}
                  </div>
                )}
                <div className="mt-3 grid gap-1.5">
                  {veilShieldSetup.checklist.map((item) => (
                    <div key={item.label} className="flex items-center gap-2 text-xs">
                      <CheckCircle2
                        className={cn("h-3.5 w-3.5", item.complete ? "text-success" : "text-muted-foreground")}
                      />
                      <span className={item.complete ? "" : "text-muted-foreground"}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="surface-card p-5 space-y-3">
          <div>
            <h2 className="text-sm font-medium">Payment source</h2>
            <p className="text-sm text-muted-foreground">Choose where the spendable USDC comes from.</p>
          </div>
          <div className="grid gap-3">
            {PAYMENT_SOURCE_OPTIONS.map((option) => (
              <SelectionButton
                key={option.value}
                active={source === option.value}
                title={getBatchSourceTitle(option.value)}
                description={getBatchSourceDescription(option.value)}
                onClick={() => setSource(option.value)}
                disabled={loading}
              />
            ))}
          </div>

          {source === "arc-direct" && (
            <div
              className={cn(
                "rounded-lg border p-3 text-sm",
                veilHubSetup.ready ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"
              )}
            >
              <div className="font-medium">
                {veilHubSetup.ready ? "Recommended: one-transaction VeilHub batch." : "Arc Direct setup required."}
              </div>
              <p className="mt-1 text-muted-foreground">
                Arc Direct requests one USDC approval if needed, then calls `VeilHub.payOpenBatch` once for the full recipient list. Legacy batch contracts and native transfers are disabled.
              </p>
              {!veilHubSetup.ready && (
                <div className="mt-2 font-mono text-xs">
                  Missing: {veilHubSetup.missing.join(", ")}
                </div>
              )}
            </div>
          )}

          {source === "unified-balance" && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
              <div className="font-medium">Sequential Unified Balance batch.</div>
              <p className="mt-1 text-muted-foreground">
                The current Circle AppKit spend call targets one recipient at a time. Veil will process recipient 1 of N, then 2 of N, and so on; this is not a single batch transaction.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="surface-card p-5 space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {source === "unified-balance"
              ? "Sequential Unified Balance batch uses the globally connected wallet and requests one spend per recipient."
              : source
                ? `${getPaymentSourceLabel(source)} uses the globally connected wallet in the top bar.`
                : "Select a source to continue."}
          </div>

          <Button type="button" onClick={submitBatch} disabled={loading || !canSubmit}>
            <Send className="mr-2 h-4 w-4" />
            {submitLabel}
          </Button>
        </div>

        {status && (
          <div className="rounded-lg border p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground" />
              <span>{status}</span>
            </div>
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="surface-card p-5 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-medium">
                {source === "unified-balance" ? "Sequential payout progress" : "Batch progress"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {source === "unified-balance"
                  ? `One Unified Balance spend per recipient. ${batchId ? `Ledger batch ID: ${batchId}` : "Recipient settlement status."}`
                  : batchId
                    ? `VeilHub batch ID: ${batchId}`
                    : "Recipient settlement status."}
              </p>
            </div>

            <Button asChild variant="outline" size="sm">
              <Link to="/app/history">History</Link>
            </Button>
          </div>

          <div className="grid gap-3">
            {results.map((item, index) => (
              <div key={item.rowId} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="text-xs text-muted-foreground">Recipient {index + 1} of {results.length}</div>
                    <div className="font-medium">{item.recipientLabel}</div>
                    <div className="break-all text-muted-foreground">{item.amount} USDC · {item.recipient}</div>
                  </div>

                  <div className={cn("inline-flex w-fit items-center gap-1.5 rounded-md border px-2 py-1 text-xs capitalize", getRowStatusClass(item.status))}>
                    {item.status === "settled" ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Clock className="h-3 w-3" />
                    )}
                    {getRowStatusLabel(item.status)}
                  </div>
                </div>

                {item.txHash && !item.txHash.startsWith("pending_") && (
                  <a
                    className="mt-2 inline-flex items-center gap-2 break-all font-mono text-xs underline"
                    href={`https://testnet.arcscan.app/tx/${item.txHash}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {item.txHash}
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                )}

                {item.txHash?.startsWith("pending_") && (
                  <div className="mt-2 break-all rounded-lg border bg-secondary/30 p-2 font-mono text-xs text-muted-foreground">
                    {item.txHash}
                  </div>
                )}

                {item.error && <div className="mt-2 rounded-lg border border-warning/30 bg-warning/5 p-2">{item.error}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
