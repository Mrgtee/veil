import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import {
  registerEntitySecretCiphertext,
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";

const OUTPUT_DIR = path.join(process.cwd(), "output");

async function main() {
  const apiKey = process.env.CIRCLE_API_KEY;
  if (!apiKey) throw new Error("CIRCLE_API_KEY missing");

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const entitySecret =
    process.env.CIRCLE_ENTITY_SECRET || crypto.randomBytes(32).toString("hex");

  console.log("Registering entity secret...");
  await registerEntitySecretCiphertext({
    apiKey,
    entitySecret,
    recoveryFileDownloadPath: OUTPUT_DIR,
  });

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret,
  });

  console.log("Creating wallet set...");
  const walletSetResp = await client.createWalletSet({
    name: "Veil Bridge Wallet Set",
  });

  const walletSetId = walletSetResp.data?.walletSet?.id;
  if (!walletSetId) throw new Error("Wallet set creation failed");

  console.log("Wallet set ID:", walletSetId);

  console.log("Creating ETH Sepolia wallet...");
  const ethResp = await client.createWallets({
    walletSetId,
    blockchains: ["ETH-SEPOLIA"],
    count: 1,
    accountType: "EOA",
    metadata: [{ name: "Veil ETH Sepolia Bridge Wallet", refId: "veil_eth_sepolia" }],
  });

  console.log("Creating Arc Testnet wallet...");
  const arcResp = await client.createWallets({
    walletSetId,
    blockchains: ["ARC-TESTNET"],
    count: 1,
    accountType: "EOA",
    metadata: [{ name: "Veil Arc Testnet Bridge Wallet", refId: "veil_arc_testnet" }],
  });

  const ethWallet = ethResp.data?.wallets?.[0];
  const arcWallet = arcResp.data?.wallets?.[0];

  console.log("Entity Secret:", entitySecret);
  console.log("ETH_SEPOLIA wallet:", ethWallet);
  console.log("ARC_TESTNET wallet:", arcWallet);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
