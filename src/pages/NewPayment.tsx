import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { isAddress } from "viem";
import { useAccount } from "wagmi";
import { AlertCircle, CheckCircle2, ExternalLink, Lock, RefreshCw, Send, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionHeader } from "@/components/veil/SectionHeader";
import type { PaymentMode } from "@/types/veil";
import {
  PAYMENT_MODE_OPTIONS,
  PAYMENT_SOURCE_OPTIONS,
  getPaymentModeLabel,
  getPaymentSourceLabel,
  type PaymentSource,
} from "@/lib/payments/types";
import {
  getVeilHubSetup,
  parseUsdcAmount,
  registerUnifiedBalanceReference,
  sendVeilHubOpenPayment,
} from "@/lib/payments/arcDirect";
import { formatPaymentError, getErrorMessage, isSettlementDelay } from "@/lib/payments/errors";
import { makeBytes32Id, makeId } from "@/lib/payments/ids";
import { recordSinglePayment } from "@/lib/payments/recording";
import {
  balanceReducedEnough,
  getActiveUnifiedSources,
  getBalanceNumber,
  getExplorerUrl,
  getFinalTxHash,
  normalizeSteps,
  readUnifiedBalance,
  readUnifiedBalanceCache,
  spendUnifiedBalanceToArc,
  type UnifiedBalanceData,
  type UnifiedBalanceResult,
  type UnifiedBalanceStep,
} from "@/lib/payments/unifiedBalance";
import { cn } from "@/lib/utils";

type PaymentResult = {
  status: "settled" | "pending";
  txHash?: string;
  reference?: string;
  message: string;
  raw?: UnifiedBalanceResult;
};

const ARC_EXPLORER = "https://testnet.arcscan.app/tx/";
const SETTLEMENT_TIMEOUT_MS = 90_000;

function withSettlementTimeout<T>(promise: Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error("Unified USDC is still finalizing."));
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

function OptionButton({
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
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card hover:border-primary/40"
      )}
    >
      <div className="font-medium">{title}</div>
      <div className={cn("mt-1 text-sm", active ? "text-primary-foreground/80" : "text-muted-foreground")}>
        {description}
      </div>
    </button>
  );
}

export default function NewPayment() {
  const { address } = useAccount();
  const [mode, setMode] = useState<PaymentMode | null>(null);
  const [source, setSource] = useState<PaymentSource | null>(null);
  const [recipient, setRecipient] = useState("");
  const [recipientLabel, setRecipientLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<PaymentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<UnifiedBalanceData | null>(null);
  const [balanceStatus, setBalanceStatus] = useState("");
  const submittingRef = useRef(false);
  const veilHubSetup = getVeilHubSetup();

  const isClosedMode = mode === "confidential";
  const confirmedBalance = getBalanceNumber(balance, "totalConfirmedBalance");
  const pendingBalance = getBalanceNumber(balance, "totalPendingBalance");
  const activeSources = getActiveUnifiedSources(balance);
  const amountNumber = Number(amount || "0");
  const unifiedBalanceTooLow =
    source === "unified-balance" && amountNumber > 0 && confirmedBalance < amountNumber;
  const arcDirectSetupMissing = source === "arc-direct" && !veilHubSetup.ready;

  const canSubmit = useMemo(() => {
    if (!mode || !source || isClosedMode) return false;
    if (!isAddress(recipient)) return false;

    try {
      parseUsdcAmount(amount);
    } catch {
      return false;
    }

    if (source === "arc-direct" && arcDirectSetupMissing) {
      return false;
    }

    if (source === "unified-balance") {
      return !unifiedBalanceTooLow;
    }

    return true;
  }, [amount, arcDirectSetupMissing, isClosedMode, mode, recipient, source, unifiedBalanceTooLow]);

  async function loadUnifiedBalance(showCached = true) {
    if (!address) return;

    try {
      if (showCached) {
        const cached = readUnifiedBalanceCache(address);
        if (cached) {
          setBalance(cached);
          setBalanceStatus("Refreshing balance...");
        } else {
          setBalanceStatus("Loading Unified USDC Balance...");
        }
      } else {
        setBalanceStatus("Refreshing Unified USDC Balance...");
      }

      const latest = await readUnifiedBalance(address);
      setBalance(latest);
      setBalanceStatus("Balance refreshed.");
    } catch (err) {
      setBalanceStatus(formatPaymentError(err, "Unable to load Unified USDC Balance."));
    }
  }

  useEffect(() => {
    if (source === "unified-balance" && address) {
      loadUnifiedBalance();
    }
  }, [address, source]);

  async function submitUnifiedBalancePayment(paymentId: `0x${string}`, commitmentId?: string) {
    if (!address) throw new Error("Wallet is not connected in the app.");

    const latestBefore = balance || (await readUnifiedBalance(address));
    const beforeBalance = getBalanceNumber(latestBefore, "totalConfirmedBalance");
    const spendAmount = Number(amount);

    try {
      const raw = await withSettlementTimeout(
        spendUnifiedBalanceToArc({
          amount,
          recipientAddress: recipient as `0x${string}`,
        })
      );
      const txHash = getFinalTxHash(raw);
      const pendingReference = makeId("pending_veilhub");
      let veilHubTxHash: string | undefined;
      let recordStatus: "settled" | "pending_settlement" | "pending_veilhub_registration" = "settled";
      let settlementNote = "Unified USDC spend settled and registered with VeilHub.";

      if (!txHash) {
        recordStatus = "pending_settlement";
        settlementNote = "Unified USDC is still finalizing.";
      } else {
        const registration = await registerUnifiedBalanceReference({
          paymentId,
          recipient: recipient as `0x${string}`,
          amount,
          settlementReference: txHash as `0x${string}`,
        }).catch((registrationErr) => ({
          registered: false as const,
          missing: [getErrorMessage(registrationErr, "VeilHub registration failed.")],
        }));

        if (registration.registered) {
          veilHubTxHash = registration.txHash;
        } else {
          recordStatus = "pending_veilhub_registration";
          settlementNote = `Unified USDC settled, but VeilHub registration is pending: ${registration.missing.join(", ")}.`;
        }
      }

      try {
        await recordSinglePayment({
          mode: mode as PaymentMode,
          source: "unified-balance",
          walletAddress: address,
          recipient,
          recipientLabel,
          amount,
          memo,
          txHash,
          pendingReference: recordStatus === "settled" ? undefined : pendingReference,
          veilHubTxHash,
          paymentId,
          commitmentId,
          status: recordStatus,
          settlementNote,
        });
      } catch (ledgerErr) {
        throw new Error(`Transaction submitted (${txHash || pendingReference}), but API ledger write failed: ${getErrorMessage(ledgerErr)}`);
      }

      return {
        status: recordStatus === "settled" ? "settled" as const : "pending" as const,
        txHash: txHash || undefined,
        reference: recordStatus === "settled" ? undefined : pendingReference,
        message: settlementNote,
        raw,
      };
    } catch (err) {
      if (!isSettlementDelay(err)) throw err;

      const latestAfter = await readUnifiedBalance(address);
      const afterBalance = getBalanceNumber(latestAfter, "totalConfirmedBalance");
      setBalance(latestAfter);

      if (!balanceReducedEnough(beforeBalance, afterBalance, spendAmount)) {
        throw new Error("Settlement was not confirmed and Unified USDC was not deducted. No payment was recorded.");
      }

      const pendingRef = makeId("pending_settlement");

      try {
        await recordSinglePayment({
          mode: mode as PaymentMode,
          source: "unified-balance",
          walletAddress: address,
          recipient,
          recipientLabel,
          amount,
          memo,
          pendingReference: pendingRef,
          paymentId,
          commitmentId,
          status: "pending_settlement",
          settlementNote: "Unified USDC was deducted but final settlement is delayed.",
        });
      } catch (ledgerErr) {
        throw new Error(`Unified USDC appears deducted (${pendingRef}), but API ledger write failed: ${getErrorMessage(ledgerErr)}`);
      }

      return {
        status: "pending" as const,
        reference: pendingRef,
        message: "Unified USDC is still finalizing. Payment saved as pending.",
      };
    }
  }

  async function submitPayment() {
    if (submittingRef.current) return;
    submittingRef.current = true;

    try {
      setLoading(true);
      setResult(null);
      setStatus("Preparing payment...");

      if (!mode) throw new Error("Choose Open Payment or Private Payment.");
      if (!source) throw new Error("Choose Arc Direct or Unified USDC.");
      if (!address) throw new Error("Wallet is not connected in the app.");
      if (!isAddress(recipient)) throw new Error("Enter a valid Arc recipient address.");
      parseUsdcAmount(amount);

      if (isClosedMode) {
        throw new Error(
          "Private payments are coming soon with Arc Private Kit."
        );
      }

      const paymentId = makeBytes32Id();
      let nextResult: PaymentResult;

      if (source === "unified-balance") {
        setStatus("Waiting for wallet approval.");
        nextResult = await submitUnifiedBalancePayment(paymentId);
        await loadUnifiedBalance(false);
      } else {
        if (!veilHubSetup.ready) {
          throw new Error(`Arc Direct requires VeilHub setup: ${veilHubSetup.missing.join(", ")}.`);
        }

        setStatus("Checking allowance.");
        const hubResult = await sendVeilHubOpenPayment({
          paymentId,
          recipient: recipient as `0x${string}`,
          amount,
        });

        try {
          await recordSinglePayment({
            mode,
            source: "arc-direct",
            walletAddress: address,
            recipient,
            recipientLabel,
            amount,
            amountBase: hubResult.amountBase,
            decimals: hubResult.decimals,
            memo,
            txHash: hubResult.txHash,
            paymentId,
            status: "settled",
            settlementNote: hubResult.approvalTxHash
              ? `USDC approval ${hubResult.approvalTxHash} confirmed before VeilHub payment.`
              : "Existing USDC allowance was sufficient for VeilHub.",
          });
        } catch (ledgerErr) {
          throw new Error(`Transaction submitted (${hubResult.txHash}), but API ledger write failed: ${getErrorMessage(ledgerErr)}`);
        }

        nextResult = {
          status: "settled",
          txHash: hubResult.txHash,
          message: "Arc Direct payment settled through VeilHub on Arc.",
        };
      }

      setResult(nextResult);
      setStatus(nextResult.message);
    } catch (err) {
      setStatus(formatPaymentError(err, "Payment failed."));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  }

  const submitLabel = loading
    ? "Processing..."
    : !mode
      ? "Choose payment mode"
      : !source
        ? "Choose payment source"
        : isClosedMode
          ? "Coming soon with Arc Private Kit"
          : arcDirectSetupMissing
            ? "VeilHub setup required"
            : unifiedBalanceTooLow
          ? "Insufficient Unified USDC"
            : "Send Payment";

  const resultTxHash = result?.txHash;
  const resultSteps = normalizeSteps(result?.raw);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Payments"
        title="New payment"
        description="Choose the payment mode and funding source before sending USDC on Arc."
      />

      <div className="surface-card p-5 space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="recipient">Recipient address</Label>
            <Input
              id="recipient"
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder="0x..."
              autoComplete="off"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00 USDC"
              inputMode="decimal"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="label">Optional label</Label>
            <Input
              id="label"
              value={recipientLabel}
              onChange={(event) => setRecipientLabel(event.target.value)}
              placeholder="Recipient name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="memo">Optional reference</Label>
            <Input
              id="memo"
              value={memo}
              onChange={(event) => setMemo(event.target.value)}
              placeholder="Invoice, payroll run, or note"
            />
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-medium">Payment mode</h2>
              <p className="text-sm text-muted-foreground">No mode is preselected.</p>
            </div>

            <div className="grid gap-3">
              {PAYMENT_MODE_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  active={mode === option.value}
                  title={option.label}
                  description={option.description}
                  onClick={() => setMode(option.value)}
                />
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-medium">Payment source</h2>
              <p className="text-sm text-muted-foreground">Choose where spendable USDC comes from.</p>
            </div>

            <div className="grid gap-3">
              {PAYMENT_SOURCE_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  active={source === option.value}
                  title={option.label}
                  description={option.description}
                  onClick={() => setSource(option.value)}
                />
              ))}
            </div>
          </div>
        </div>

        {isClosedMode && (
          <div className="rounded-lg border border-confidential/30 bg-confidential-soft/60 p-4 text-sm">
            <div className="flex items-start gap-3">
              <Lock className="mt-0.5 h-4 w-4 text-confidential" />
              <div>
                <div className="font-medium">Coming soon with Arc Private Kit.</div>
                <p className="mt-1 text-muted-foreground">
                  Veil is preparing native Arc privacy support. Open payments are live today.
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Visible transfers are blocked as private payments.
                </p>
              </div>
            </div>
          </div>
        )}

        {source === "arc-direct" && (
          <div
            className={cn(
              "rounded-lg border p-4 text-sm",
              veilHubSetup.ready ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5"
            )}
          >
            <div className="font-medium">
              {veilHubSetup.ready ? "Arc Direct routes through VeilHub." : "Arc Direct setup required."}
            </div>
            <p className="mt-1 text-muted-foreground">
              Uses USDC approval and `VeilHub.payOpen`.
            </p>
            {!veilHubSetup.ready && (
              <div className="mt-2 font-mono text-xs">
                Missing: {veilHubSetup.missing.join(", ")}
              </div>
            )}
          </div>
        )}

        {source === "unified-balance" && (
          <div className="rounded-lg border bg-secondary/30 p-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="font-medium">Unified USDC Balance</div>
                <p className="text-sm text-muted-foreground">
                  Confirmed balance is spendable. Pending balance is visible but cannot be spent yet.
                </p>
              </div>

              <Button type="button" variant="outline" size="sm" onClick={() => loadUnifiedBalance(false)} disabled={loading}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border bg-card p-3">
                <div className="text-xs text-muted-foreground">Confirmed</div>
                <div className="text-xl font-semibold tabular-nums">{confirmedBalance.toFixed(6)}</div>
                <div className="text-xs text-muted-foreground">USDC</div>
              </div>

              <div className="rounded-lg border bg-card p-3">
                <div className="text-xs text-muted-foreground">Pending</div>
                <div className="text-xl font-semibold tabular-nums">{pendingBalance.toFixed(6)}</div>
                <div className="text-xs text-muted-foreground">USDC</div>
              </div>
            </div>

            {activeSources.length > 0 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {activeSources.map((item, index) => (
                  <div key={`${item.chain}-${index}`} className="rounded-lg border bg-card p-3 text-sm">
                    <div className="font-medium">{item.chain}</div>
                    <div className="text-muted-foreground">Confirmed {item.confirmed} USDC</div>
                    <div className="text-muted-foreground">Pending {item.pending} USDC</div>
                  </div>
                ))}
              </div>
            )}

            {unifiedBalanceTooLow && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                Insufficient confirmed Unified USDC. Deposit more or reduce the amount.
              </div>
            )}

            {balanceStatus && <div className="text-xs text-muted-foreground">{balanceStatus}</div>}
          </div>
        )}

        <div className="flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground">
            {source ? `${getPaymentSourceLabel(source)} will use the globally connected wallet in the top bar.` : "Select a source to continue."}
          </div>

          <Button type="button" onClick={submitPayment} disabled={loading || !canSubmit} className="sm:w-auto">
            <Send className="mr-2 h-4 w-4" />
            {submitLabel}
          </Button>
        </div>

        {status && (
          <div
            className={cn(
              "rounded-lg border p-3 text-sm",
              result?.status === "settled" && "border-success/30 bg-success/5",
              result?.status === "pending" && "border-warning/30 bg-warning/5"
            )}
          >
            <div className="flex items-start gap-2">
              {result?.status === "settled" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 text-success" />
              ) : (
                <AlertCircle className="mt-0.5 h-4 w-4 text-muted-foreground" />
              )}
              <span>{status}</span>
            </div>
          </div>
        )}
      </div>

      {result && (
        <div className="surface-card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-secondary p-2">
              {source === "unified-balance" ? <WalletCards className="h-4 w-4" /> : <Send className="h-4 w-4" />}
            </div>
            <div>
              <h2 className="text-lg font-medium">Payment result</h2>
              <p className="text-sm text-muted-foreground">{result.message}</p>
            </div>
          </div>

          <div className="grid gap-3 text-sm md:grid-cols-2">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Mode</div>
              <div className="font-medium">{mode ? getPaymentModeLabel(mode) : "—"}</div>
            </div>

            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Source</div>
              <div className="font-medium">{getPaymentSourceLabel(source || undefined)}</div>
            </div>

            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Amount</div>
              <div className="font-medium tabular-nums">{amount} USDC</div>
            </div>

            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Recipient</div>
              <div className="break-all font-mono text-xs">{recipient}</div>
            </div>
          </div>

          {(resultTxHash || result.reference) && (
            <div className="rounded-lg border p-3 text-sm">
              <div className="text-xs text-muted-foreground">{resultTxHash ? "Final Arc transaction" : "Pending reference"}</div>
              {resultTxHash ? (
                <a
                  className="mt-1 inline-flex items-center gap-2 break-all font-mono text-xs underline"
                  href={`${ARC_EXPLORER}${resultTxHash}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {resultTxHash}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              ) : (
                <div className="mt-1 break-all font-mono text-xs">{result.reference}</div>
              )}
            </div>
          )}

          {resultSteps.length > 0 && (
            <div className="space-y-2">
              <div className="font-medium text-sm">Unified USDC steps</div>
              {resultSteps.map((step: UnifiedBalanceStep, index: number) => {
                const txHash = step?.txHash;
                return (
                  <div key={index} className="rounded-lg border p-3 text-sm">
                    <div className="font-medium">{step.name ?? `Step ${index + 1}`}</div>
                    <div className="text-muted-foreground">{step.state ?? "submitted"}</div>
                    {txHash && (
                      <a
                        href={getExplorerUrl("Arc_Testnet", txHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 block break-all font-mono text-xs underline"
                      >
                        {txHash}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <Button asChild variant="outline">
            <Link to="/app/history">View History</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
