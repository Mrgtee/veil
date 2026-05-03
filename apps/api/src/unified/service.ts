import "dotenv/config";
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";

const kit = new AppKit();

function getAdapter() {
  const privateKey = process.env.UB_EVM_PRIVATE_KEY;

  if (!privateKey || !privateKey.startsWith("0x")) {
    throw new Error("UB_EVM_PRIVATE_KEY is missing or invalid");
  }

  return createViemAdapterFromPrivateKey({
    privateKey: privateKey as `0x${string}`,
  });
}

export async function getUnifiedBalance() {
  const adapter = getAdapter();

  return await kit.unifiedBalance.getBalances({
    sources: [{ adapter }],
    networkType: "testnet",
    includePending: true,
  });
}

export async function spendUnifiedBalanceToArc(input: {
  amount: string;
  recipientAddress: string;
}) {
  const adapter = getAdapter();

  if (!input.recipientAddress || !input.recipientAddress.startsWith("0x")) {
    throw new Error("A valid Arc recipient address is required");
  }

  return await kit.unifiedBalance.spend({
    amount: input.amount,
    token: "USDC",
    from: [{ adapter }],
    to: {
      adapter,
      chain: "Arc_Testnet",
      recipientAddress: input.recipientAddress,
    },
  });
}
