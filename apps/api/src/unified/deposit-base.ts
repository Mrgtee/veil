import "dotenv/config";
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { inspect } from "node:util";

const kit = new AppKit();

const adapter = createViemAdapterFromPrivateKey({
  privateKey: process.env.UB_EVM_PRIVATE_KEY as `0x${string}`,
});

async function main() {
  const amount = process.env.UB_DEPOSIT_AMOUNT || "1.00";

  console.log(`Depositing ${amount} USDC from Base Sepolia into Unified Balance...\n`);

  const result = await kit.unifiedBalance.deposit({
    from: {
      adapter,
      chain: "Base_Sepolia",
    },
    amount,
    token: "USDC",
  });

  console.log(inspect(result, false, null, true));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
