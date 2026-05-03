import "dotenv/config";
import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { inspect } from "node:util";

const kit = new AppKit();

const adapter = createViemAdapterFromPrivateKey({
  privateKey: process.env.UB_EVM_PRIVATE_KEY as `0x${string}`,
});

async function main() {
  console.log("Checking Unified Balance for the EVM depositor...\n");

  const result = await kit.unifiedBalance.getBalances({
    sources: [{ adapter }],
    networkType: "testnet",
    includePending: true,
  });

  console.log(inspect(result, false, null, true));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
