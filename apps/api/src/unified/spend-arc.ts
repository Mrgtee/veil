import "dotenv/config";
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { inspect } from "node:util";

const kit = new AppKit();

const adapter = createViemAdapterFromPrivateKey({
  privateKey: process.env.UB_EVM_PRIVATE_KEY as `0x${string}`,
});

async function main() {
  const amount = process.env.UB_SPEND_AMOUNT || "0.50";
  const recipientAddress = process.env.UB_ARC_RECIPIENT_ADDRESS;

  if (!recipientAddress) {
    throw new Error("UB_ARC_RECIPIENT_ADDRESS is missing");
  }

  console.log(`Spending ${amount} USDC from Unified Balance to Arc Testnet recipient ${recipientAddress}...\n`);

  const result = await kit.unifiedBalance.spend({
    amount,
    token: "USDC",
    from: [{ adapter }],
    to: {
      adapter,
      chain: "Arc_Testnet",
      recipientAddress,
    },
  });

  console.log(inspect(result, false, null, true));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
