import {
  createPublicClient,
  createWalletClient,
  custom,
  formatUnits,
  http,
  isAddress,
  parseUnits,
  type Hash,
} from "viem";
import { arcTestnet } from "@/lib/arc";
import { erc20Abi, veilHubAbi } from "@/lib/abi";
import { ARC_RPC_URL, ARC_USDC_ADDRESS, USE_VEIL_HUB, VEIL_HUB_ADDRESS } from "@/lib/env";
import { ensureArcNetwork, getInjectedProvider, requestWalletAccount } from "./wallet";

export type BatchRecipientRow = {
  id: string;
  recipient: string;
  amount: string;
  recipientLabel: string;
  memo: string;
};

export type VeilHubSetup = {
  ready: boolean;
  missing: string[];
};

export type VeilHubPaymentResult = {
  txHash: Hash;
  approvalTxHash?: Hash;
  amountBase: string;
  decimals: number;
  paymentId?: `0x${string}`;
  batchId?: `0x${string}`;
};

export const ZERO_BYTES32 = `0x${"0".repeat(64)}` as `0x${string}`;

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_RPC_URL),
});

function getWalletClient(account: `0x${string}`) {
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: custom(getInjectedProvider()),
  });
}

export function getVeilHubSetup(): VeilHubSetup {
  const missing: string[] = [];

  if (!USE_VEIL_HUB) missing.push("VITE_USE_VEIL_HUB=true");
  if (!VEIL_HUB_ADDRESS || !isAddress(VEIL_HUB_ADDRESS)) missing.push("VITE_VEIL_HUB_ADDRESS");
  if (!ARC_USDC_ADDRESS || !isAddress(ARC_USDC_ADDRESS)) missing.push("VITE_ARC_USDC_ADDRESS");

  return {
    ready: missing.length === 0,
    missing,
  };
}

export function assertVeilHubReady() {
  const setup = getVeilHubSetup();
  if (!setup.ready) {
    throw new Error(`Arc Direct requires VeilHub setup: ${setup.missing.join(", ")}.`);
  }
}

export function parseUsdcAmount(value: string, decimals = 6) {
  const clean = value.trim();

  if (!clean || Number(clean) <= 0) {
    throw new Error("Enter a valid USDC amount.");
  }

  return parseUnits(clean, decimals);
}

export function validateArcRecipient(recipient: string) {
  if (!isAddress(recipient)) {
    throw new Error("Enter a valid Arc recipient address.");
  }
}

export async function readArcUsdcDecimals() {
  assertVeilHubReady();

  return Number(
    await publicClient.readContract({
      address: ARC_USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "decimals",
    })
  );
}

async function readArcUsdcBalance(account: `0x${string}`) {
  return await publicClient.readContract({
    address: ARC_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
  });
}

async function readArcUsdcAllowance(account: `0x${string}`) {
  return await publicClient.readContract({
    address: ARC_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, VEIL_HUB_ADDRESS],
  });
}

async function ensureUsdcAllowance(input: {
  account: `0x${string}`;
  amountBase: bigint;
  walletClient: ReturnType<typeof getWalletClient>;
}) {
  const allowance = await readArcUsdcAllowance(input.account);
  if (allowance >= input.amountBase) return undefined;

  const approvalTxHash = await input.walletClient.writeContract({
    address: ARC_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "approve",
    args: [VEIL_HUB_ADDRESS, input.amountBase],
    chain: arcTestnet,
  });

  await publicClient.waitForTransactionReceipt({ hash: approvalTxHash });
  return approvalTxHash;
}

async function prepareVeilHubPayment(amount: string) {
  assertVeilHubReady();
  await ensureArcNetwork();

  const account = await requestWalletAccount();
  const walletClient = getWalletClient(account as `0x${string}`);
  const decimals = await readArcUsdcDecimals();
  const amountBase = parseUsdcAmount(amount, decimals);
  const balance = await readArcUsdcBalance(account as `0x${string}`);

  if (balance < amountBase) {
    throw new Error(
      `The connected wallet has ${formatUnits(balance, decimals)} USDC on Arc, which is below this payment amount.`
    );
  }

  const approvalTxHash = await ensureUsdcAllowance({
    account: account as `0x${string}`,
    amountBase,
    walletClient,
  });

  return {
    account: account as `0x${string}`,
    walletClient,
    decimals,
    amountBase,
    approvalTxHash,
  };
}

export async function sendVeilHubOpenPayment(input: {
  paymentId: `0x${string}`;
  recipient: `0x${string}`;
  amount: string;
  reference?: `0x${string}`;
}): Promise<VeilHubPaymentResult> {
  validateArcRecipient(input.recipient);
  const prepared = await prepareVeilHubPayment(input.amount);

  const txHash = await prepared.walletClient.writeContract({
    address: VEIL_HUB_ADDRESS,
    abi: veilHubAbi,
    functionName: "payOpen",
    args: [input.paymentId, input.recipient, prepared.amountBase, input.reference || ZERO_BYTES32],
    chain: arcTestnet,
  });

  return {
    txHash,
    approvalTxHash: prepared.approvalTxHash,
    amountBase: prepared.amountBase.toString(),
    decimals: prepared.decimals,
    paymentId: input.paymentId,
  };
}

export async function sendVeilHubOpenBatch(input: {
  batchId: `0x${string}`;
  recipients: `0x${string}`[];
  amounts: string[];
  paymentIds: `0x${string}`[];
  reference?: `0x${string}`;
}): Promise<VeilHubPaymentResult> {
  if (input.recipients.length === 0) {
    throw new Error("Add at least one recipient before submitting.");
  }

  if (input.recipients.length !== input.amounts.length || input.recipients.length !== input.paymentIds.length) {
    throw new Error("Batch recipients, amounts, and payment IDs must match.");
  }

  input.recipients.forEach(validateArcRecipient);
  assertVeilHubReady();
  await ensureArcNetwork();

  const account = await requestWalletAccount();
  const walletClient = getWalletClient(account as `0x${string}`);
  const decimals = await readArcUsdcDecimals();
  const amountBases = input.amounts.map((amount) => parseUsdcAmount(amount, decimals));
  const totalBase = amountBases.reduce((sum, amount) => sum + amount, 0n);
  const balance = await readArcUsdcBalance(account as `0x${string}`);

  if (balance < totalBase) {
    throw new Error(
      `The connected wallet has ${formatUnits(balance, decimals)} USDC on Arc, which is below the batch total.`
    );
  }

  const approvalTxHash = await ensureUsdcAllowance({
    account: account as `0x${string}`,
    amountBase: totalBase,
    walletClient,
  });

  const txHash = await walletClient.writeContract({
    address: VEIL_HUB_ADDRESS,
    abi: veilHubAbi,
    functionName: "payOpenBatch",
    args: [input.batchId, input.recipients, amountBases, input.paymentIds, input.reference || ZERO_BYTES32],
    chain: arcTestnet,
  });

  return {
    txHash,
    approvalTxHash,
    amountBase: totalBase.toString(),
    decimals,
    batchId: input.batchId,
  };
}

export async function registerUnifiedBalanceReference(input: {
  paymentId: `0x${string}`;
  recipient: `0x${string}`;
  amount: string;
  settlementReference: `0x${string}`;
}) {
  const setup = getVeilHubSetup();
  if (!setup.ready) {
    return {
      registered: false as const,
      missing: setup.missing,
    };
  }

  validateArcRecipient(input.recipient);
  await ensureArcNetwork();

  const account = await requestWalletAccount();
  const walletClient = getWalletClient(account as `0x${string}`);
  const decimals = await readArcUsdcDecimals();
  const amountBase = parseUsdcAmount(input.amount, decimals);
  const txHash = await walletClient.writeContract({
    address: VEIL_HUB_ADDRESS,
    abi: veilHubAbi,
    functionName: "recordUnifiedBalanceOpenPayment",
    args: [input.paymentId, input.recipient, amountBase, input.settlementReference],
    chain: arcTestnet,
  });

  return {
    registered: true as const,
    txHash,
    amountBase: amountBase.toString(),
    decimals,
  };
}

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
