import { parseUsdcAmount } from "./arcDirect";
import { makeId } from "./ids";
import { veilApi } from "@/services/veilApi";
import type { PaymentMode, PaymentStatus } from "@/types/veil";
import type { PaymentSource } from "./types";
import { getPaymentSourceLabel } from "./types";

export async function recordSinglePayment(input: {
  mode: PaymentMode;
  source: PaymentSource;
  recipient: string;
  recipientLabel?: string;
  amount: string;
  memo?: string;
  txHash?: string;
  commitmentId?: string;
  status?: PaymentStatus;
  settlementNote?: string;
}) {
  await veilApi.recordSinglePayment({
    mode: input.mode,
    recipient: input.recipient,
    recipientLabel: input.recipientLabel,
    amountBase: parseUsdcAmount(input.amount).toString(),
    memo: input.memo,
    txHash: input.txHash || makeId("pending"),
    commitmentId: input.commitmentId,
    status: input.status,
    liquiditySource: getPaymentSourceLabel(input.source),
    sourceChain: input.source === "unified-balance" ? "User-owned Unified Balance" : "Arc Testnet",
    destinationChain: "Arc Testnet",
    settlementNote: input.settlementNote,
  });
}

export async function recordBatchPayment(input: {
  mode: PaymentMode;
  source: PaymentSource;
  rows: Array<{ recipient: string; amount: string; memo?: string; recipientLabel?: string }>;
  txHash: string;
  batchId: string;
  batchCommitment?: string;
  status?: PaymentStatus;
  settlementNote?: string;
}) {
  await veilApi.recordBatchPayment({
    mode: input.mode,
    rows: input.rows.map((row) => ({
      ...row,
      amount: parseUsdcAmount(row.amount).toString(),
    })),
    txHash: input.txHash,
    batchId: input.batchId,
    batchCommitment: input.batchCommitment,
    status: input.status,
    liquiditySource: getPaymentSourceLabel(input.source),
    sourceChain: input.source === "unified-balance" ? "User-owned Unified Balance" : "Arc Testnet",
    destinationChain: "Arc Testnet",
    settlementNote: input.settlementNote,
  });
}

