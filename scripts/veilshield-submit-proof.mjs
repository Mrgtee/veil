#!/usr/bin/env node
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  addressToField,
  amountBaseToDisplay,
  normalizeHex,
  readArtifact,
  validateTransferArtifact,
  validateWithdrawArtifact,
} from "./lib/veilshield-artifacts.mjs";

const veilShieldAbi = [
  {
    type: "function",
    name: "transferNote",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proof", type: "bytes" },
      { name: "nullifierHash", type: "bytes32" },
      { name: "inputNoteCommitment", type: "bytes32" },
      { name: "outputNoteCommitment", type: "bytes32" },
      { name: "changeNoteCommitment", type: "bytes32" },
      { name: "encryptedNoteRef", type: "bytes32" },
      { name: "recipient", type: "address" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "withdraw",
    stateMutability: "nonpayable",
    inputs: [
      { name: "proof", type: "bytes" },
      { name: "nullifierHash", type: "bytes32" },
      { name: "noteCommitment", type: "bytes32" },
      { name: "recipient", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "noteCommitments",
    stateMutability: "view",
    inputs: [{ name: "noteCommitment", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "nullifiers",
    stateMutability: "view",
    inputs: [{ name: "nullifierHash", type: "bytes32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "usdc",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
];

function usage() {
  console.log(`
VeilShield proof artifact submitter

Commands:
  transfer --artifact <path> [--record-ledger]
  withdraw --artifact <path> [--record-ledger]

Required env:
  PRIVATE_KEY=<testnet account that owns the note>
  ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
  VEIL_SHIELD_ADDRESS=0x1BC23d45aEc7229809841a6FCd578A9C61A5667D
  ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000

Optional ledger env:
  VEIL_API_BASE_URL=http://localhost:8787

Examples:
  node scripts/veilshield-submit-proof.mjs transfer --artifact /tmp/veil-transfer-artifact.json --record-ledger
  node scripts/veilshield-submit-proof.mjs withdraw --artifact /tmp/veil-withdraw-artifact.json --record-ledger
`.trim());
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) {
      args._.push(item);
      continue;
    }

    const key = item.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    args[key] = value;
  }
  return args;
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Add it to contracts/.env and source it before running this script.`);
  return value;
}

function requireArg(args, name) {
  const value = args[name];
  if (!value || value === "true") throw new Error(`Missing --${name}`);
  return String(value);
}

function arcChain(chainId) {
  return {
    id: chainId,
    name: "Arc Testnet",
    nativeCurrency: { name: "Arc Testnet ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [process.env.ARC_TESTNET_RPC_URL] } },
    blockExplorers: { default: { name: "Arcscan", url: "https://testnet.arcscan.app" } },
  };
}

function getClients() {
  const privateKey = requireEnv("PRIVATE_KEY");
  const rpcUrl = requireEnv("ARC_TESTNET_RPC_URL");
  const chainId = Number(process.env.ARC_CHAIN_ID || 5042002);
  const chain = arcChain(chainId);
  const account = privateKeyToAccount(privateKey.startsWith("0x") ? privateKey : `0x${privateKey}`);

  return {
    account,
    publicClient: createPublicClient({ chain, transport: http(rpcUrl) }),
    walletClient: createWalletClient({ account, chain, transport: http(rpcUrl) }),
  };
}

function getEnvAddresses() {
  return {
    veilShield: requireEnv("VEIL_SHIELD_ADDRESS"),
    usdc: requireEnv("ARC_USDC_ADDRESS"),
  };
}

function assertArtifactMatchesEnv(artifact, account, addresses) {
  const expectedOwnerField = addressToField(account.address);
  const publicInputs = artifact.publicInputs;
  const ownerField = artifact.kind === "transfer" ? publicInputs.sender : publicInputs.owner;

  if (normalizeHex(ownerField) !== expectedOwnerField) {
    throw new Error(`Artifact owner/sender does not match PRIVATE_KEY account ${account.address}.`);
  }

  if (normalizeHex(publicInputs.tokenAddress) !== normalizeHex(addresses.usdc)) {
    throw new Error("Artifact token does not match ARC_USDC_ADDRESS.");
  }
}

async function assertContractConfig(publicClient, addresses) {
  const configuredUsdc = await publicClient.readContract({
    address: addresses.veilShield,
    abi: veilShieldAbi,
    functionName: "usdc",
  });

  if (normalizeHex(configuredUsdc) !== normalizeHex(addresses.usdc)) {
    throw new Error(`VeilShield USDC mismatch. Contract has ${configuredUsdc}; env has ${addresses.usdc}.`);
  }
}

async function recordLedger(artifact, txHash) {
  const base = process.env.VEIL_API_BASE_URL || process.env.VITE_API_BASE_URL;
  if (!base) {
    return { skipped: true, reason: "VEIL_API_BASE_URL is not set." };
  }

  const isTransfer = artifact.kind === "transfer";
  const p = artifact.publicInputs;
  const ownerAddress = isTransfer ? p.senderAddress : p.ownerAddress;
  const body = {
    type: "single",
    mode: "confidential",
    source: "veilshield_closed",
    operation: isTransfer ? "shield_transfer" : "shield_withdraw",
    status: "settled",
    recipient: isTransfer ? p.recipientAddress : p.recipientAddress,
    sender: isTransfer ? ownerAddress : undefined,
    owner: ownerAddress,
    payer: ownerAddress,
    walletAddress: ownerAddress,
    createdBy: ownerAddress,
    recipientLabel: isTransfer ? "VeilShield recipient" : "VeilShield withdrawal recipient",
    amount: isTransfer ? "hidden" : amountBaseToDisplay(p.withdrawAmountBase),
    amountBase: isTransfer ? "0" : p.withdrawAmountBase,
    amountHidden: isTransfer,
    token: "USDC",
    txHash,
    commitmentId: isTransfer ? p.outputCommitment : p.commitment,
    externalId: txHash,
    liquiditySource: "VeilShield closed-payment pool",
    sourceChain: "VeilShield pool on Arc Testnet",
    destinationChain: isTransfer ? "VeilShield pool on Arc Testnet" : "Arc Testnet wallet",
    settlementNote: isTransfer
      ? "Developer-preview hidden transfer submitted with a local Noir/BB proof artifact. Amount is intentionally not stored in the ledger."
      : "Developer-preview withdrawal submitted with a local Noir/BB proof artifact. Withdrawal amount is public onchain.",
  };

  const response = await fetch(`${base}/api/payments`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    throw new Error(payload?.error || `Ledger write failed with HTTP ${response.status}.`);
  }

  return { skipped: false, payment: payload.data };
}

async function submitTransfer(args) {
  const artifact = validateTransferArtifact(readArtifact(requireArg(args, "artifact")));
  const addresses = getEnvAddresses();
  const { account, publicClient, walletClient } = getClients();
  assertArtifactMatchesEnv(artifact, account, addresses);
  await assertContractConfig(publicClient, addresses);

  const p = artifact.publicInputs;
  const inputExists = await publicClient.readContract({
    address: addresses.veilShield,
    abi: veilShieldAbi,
    functionName: "noteCommitments",
    args: [p.inputCommitment],
  });
  if (!inputExists) throw new Error("Input note commitment is not registered in VeilShield. Deposit the note first.");

  const nullifierUsed = await publicClient.readContract({
    address: addresses.veilShield,
    abi: veilShieldAbi,
    functionName: "nullifiers",
    args: [p.nullifier],
  });
  if (nullifierUsed) throw new Error("Nullifier is already spent in VeilShield.");

  for (const [label, commitment] of [["output", p.outputCommitment], ["change", p.changeCommitment]]) {
    const exists = await publicClient.readContract({
      address: addresses.veilShield,
      abi: veilShieldAbi,
      functionName: "noteCommitments",
      args: [commitment],
    });
    if (exists) throw new Error(`${label} note commitment already exists in VeilShield.`);
  }

  const argsForContract = [
    artifact.proof.bytes,
    p.nullifier,
    p.inputCommitment,
    p.outputCommitment,
    p.changeCommitment,
    p.encryptedNoteRef,
    p.recipientAddress,
  ];

  const { request } = await publicClient.simulateContract({
    account,
    address: addresses.veilShield,
    abi: veilShieldAbi,
    functionName: "transferNote",
    args: argsForContract,
  });
  const txHash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error(`VeilShield transfer reverted: ${txHash}`);

  const ledger = args["record-ledger"] === "true" ? await recordLedger(artifact, txHash) : { skipped: true, reason: "--record-ledger not set." };
  return { txHash, receiptStatus: receipt.status, ledger };
}

async function submitWithdraw(args) {
  const artifact = validateWithdrawArtifact(readArtifact(requireArg(args, "artifact")));
  const addresses = getEnvAddresses();
  const { account, publicClient, walletClient } = getClients();
  assertArtifactMatchesEnv(artifact, account, addresses);
  await assertContractConfig(publicClient, addresses);

  const p = artifact.publicInputs;
  const commitmentExists = await publicClient.readContract({
    address: addresses.veilShield,
    abi: veilShieldAbi,
    functionName: "noteCommitments",
    args: [p.commitment],
  });
  if (!commitmentExists) throw new Error("Withdraw note commitment is not registered in VeilShield.");

  const nullifierUsed = await publicClient.readContract({
    address: addresses.veilShield,
    abi: veilShieldAbi,
    functionName: "nullifiers",
    args: [p.nullifier],
  });
  if (nullifierUsed) throw new Error("Nullifier is already spent in VeilShield.");

  const argsForContract = [
    artifact.proof.bytes,
    p.nullifier,
    p.commitment,
    p.recipientAddress,
    BigInt(p.withdrawAmountBase),
  ];

  const { request } = await publicClient.simulateContract({
    account,
    address: addresses.veilShield,
    abi: veilShieldAbi,
    functionName: "withdraw",
    args: argsForContract,
  });
  const txHash = await walletClient.writeContract(request);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") throw new Error(`VeilShield withdraw reverted: ${txHash}`);

  const ledger = args["record-ledger"] === "true" ? await recordLedger(artifact, txHash) : { skipped: true, reason: "--record-ledger not set." };
  return { txHash, receiptStatus: receipt.status, ledger };
}

try {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  if (!command || command === "help" || command === "--help") {
    usage();
    process.exit(command ? 0 : 1);
  }

  let result;
  if (command === "transfer") result = await submitTransfer(args);
  else if (command === "withdraw") result = await submitWithdraw(args);
  else throw new Error(`Unknown command: ${command}`);

  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
