import { parseUnits } from "viem";
import { makeId } from "./ids";
import { veilApi } from "@/services/veilApi";
import type { PaymentMode } from "@/types/veil";
import type { PaymentSource } from "./types";
import { getPaymentSourceLabel } from "./types";

function displayAmountFromBase(baseAmount: string, decimals = 6) {
  const whole = BigInt(baseAmount);
  const divisor = 10n ** BigInt(decimals);
  const units = whole / divisor;
  const fraction = whole % divisor;
  const fractional = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fractional ? `${units}.${fractional}` : units.toString();
}

export function getLedgerSource(source: PaymentSource) {
  return source === "unified-balance" ? "unified_balance" as const : "arc_direct" as const;
}

export async function recordSinglePayment(input: {
  mode: PaymentMode;
  source: PaymentSource;
  recipient: string;
  recipientLabel?: string;
  amount: string;
  amountBase?: string;
  decimals?: number;
  memo?: string;
  txHash?: string;
  pendingReference?: string;
  veilHubTxHash?: string;
  paymentId?: string;
  commitmentId?: string;
  status?: "settled" | "pending_settlement" | "pending_veilhub_registration" | "failed";
  settlementNote?: string;
  error?: string;
}) {
  const amountBase = input.amountBase || parseUnits(input.amount, input.decimals ?? 6).toString();

  return await veilApi.recordPayment({
    type: "single",
    mode: input.mode,
    source: getLedgerSource(input.source),
    status: input.status || "settled",
    recipient: input.recipient,
    recipientLabel: input.recipientLabel,
    amount: input.amount || displayAmountFromBase(amountBase, input.decimals),
    amountBase,
    token: "USDC",
    txHash: input.txHash,
    pendingReference: input.pendingReference,
    veilHubTxHash: input.veilHubTxHash,
    paymentId: input.paymentId,
    commitmentId: input.commitmentId,
    externalId: input.paymentId || input.txHash || input.pendingReference,
    memo: input.memo,
    liquiditySource: getPaymentSourceLabel(input.source),
    sourceChain: input.source === "unified-balance" ? "User-owned Unified USDC Balance" : "Arc Testnet",
    destinationChain: "Arc Testnet",
    settlementNote: input.settlementNote,
    error: input.error,
  });
}

export async function recordBatchPayment(input: {
  mode: PaymentMode;
  source: PaymentSource;
  rows: Array<{ recipient: string; amount: string; memo?: string; recipientLabel?: string }>;
  txHash?: string;
  pendingReference?: string;
  veilHubTxHash?: string;
  batchId: string;
  batchCommitment?: string;
  amountBase?: string;
  decimals?: number;
  status?: "settled" | "pending_settlement" | "pending_veilhub_registration" | "failed";
  settlementNote?: string;
  error?: string;
}) {
  const decimals = input.decimals ?? 6;
  const amountBase =
    input.amountBase ||
    input.rows
      .reduce((sum, row) => sum + parseUnits(row.amount, decimals), 0n)
      .toString();

  return await veilApi.recordPayment({
    type: "batch",
    mode: input.mode,
    source: getLedgerSource(input.source),
    status: input.status || "settled",
    recipient: `${input.rows.length} recipients`,
    recipientLabel: `${input.rows.length} recipients`,
    amount: displayAmountFromBase(amountBase, decimals),
    amountBase,
    token: "USDC",
    txHash: input.txHash,
    pendingReference:
      input.pendingReference ||
      (input.status === "pending_settlement" || input.status === "pending_veilhub_registration"
        ? makeId("pending_batch")
        : undefined),
    veilHubTxHash: input.veilHubTxHash,
    batchId: input.batchId,
    batchCount: input.rows.length,
    commitmentId: input.batchCommitment,
    externalId: input.batchId,
    liquiditySource: getPaymentSourceLabel(input.source, { sequential: input.source === "unified-balance" }),
    sourceChain: input.source === "unified-balance" ? "User-owned Unified USDC Balance" : "Arc Testnet",
    destinationChain: "Arc Testnet",
    settlementNote: input.settlementNote,
    error: input.error,
  });
}
