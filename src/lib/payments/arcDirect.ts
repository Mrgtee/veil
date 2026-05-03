import { isAddress, parseUnits } from "viem";
import { ensureArcNetwork, getInjectedProvider, requestWalletAccount } from "./wallet";

export function parseUsdcAmount(value: string) {
  const clean = value.trim();

  if (!clean || Number(clean) <= 0) {
    throw new Error("Enter a valid USDC amount.");
  }

  return parseUnits(clean, 18);
}

export function validateArcRecipient(recipient: string) {
  if (!isAddress(recipient)) {
    throw new Error("Enter a valid Arc recipient address.");
  }
}

export async function sendArcDirectPayment(input: {
  recipient: `0x${string}`;
  amount: string;
}) {
  validateArcRecipient(input.recipient);
  await ensureArcNetwork();

  const provider = getInjectedProvider();
  const from = await requestWalletAccount();
  const value = `0x${parseUsdcAmount(input.amount).toString(16)}`;

  return await provider.request({
    method: "eth_sendTransaction",
    params: [
      {
        from,
        to: input.recipient,
        value,
      },
    ],
  }) as string;
}

export type BatchRecipientRow = {
  id: string;
  recipient: string;
  amount: string;
  recipientLabel: string;
  memo: string;
};

export function cleanBatchRows(rows: BatchRecipientRow[]) {
  const cleanRows = rows
    .map((row) => ({
      ...row,
      recipient: row.recipient.trim(),
      amount: row.amount.trim(),
      recipientLabel: row.recipientLabel.trim(),
      memo: row.memo.trim(),
    }))
    .filter((row) => row.recipient || row.amount || row.recipientLabel || row.memo);

  if (cleanRows.length === 0) {
    throw new Error("Add at least one recipient before submitting.");
  }

  for (const [index, row] of cleanRows.entries()) {
    if (!isAddress(row.recipient)) {
      throw new Error(`Recipient ${index + 1} has an invalid wallet address.`);
    }

    if (!row.amount || Number(row.amount) <= 0) {
      throw new Error(`Recipient ${index + 1} has an invalid amount.`);
    }
  }

  return cleanRows;
}

export function getBatchTotal(rows: BatchRecipientRow[]) {
  const total = rows.reduce((sum, row) => {
    const n = Number(row.amount || "0");
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);

  return total.toFixed(6).replace(/\.?0+$/, "") || "0";
}

