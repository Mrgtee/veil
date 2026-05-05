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
import { erc20Abi, veilShieldAbi } from "@/lib/abi";
import {
  ARC_RPC_URL,
  ARC_USDC_ADDRESS,
  VEIL_SHIELD_ADDRESS,
  VEIL_SHIELD_TRANSFER_VERIFIER_ADDRESS,
  VEIL_SHIELD_WITHDRAW_VERIFIER_ADDRESS,
} from "@/lib/env";
import { ensureArcNetwork, getInjectedProvider, requestWalletAccount } from "./wallet";

export type VeilShieldSetup = {
  prototypeFilesReady: boolean;
  deployed: boolean;
  transferVerifierConfigured: boolean;
  withdrawVerifierConfigured: boolean;
  settlementReady: boolean;
  missing: string[];
  statusLabel: string;
  detail: string;
  checklist: Array<{ label: string; complete: boolean }>;
};

export type VeilShieldDepositResult = {
  txHash: Hash;
  approvalTxHash?: Hash;
  amountBase: string;
  decimals: number;
  noteCommitment: `0x${string}`;
  encryptedNoteRef: `0x${string}`;
};

export const ZERO_BYTES32 = `0x${"0".repeat(64)}` as `0x${string}`;

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http(ARC_RPC_URL),
});

function hasAddress(value: string | undefined): value is `0x${string}` {
  return Boolean(value && isAddress(value));
}

function getWalletClient(account: `0x${string}`) {
  return createWalletClient({
    account,
    chain: arcTestnet,
    transport: custom(getInjectedProvider()),
  });
}

export function isBytes32(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{64}$/.test(value.trim());
}

export function assertVeilShieldDepositReady() {
  const missing: string[] = [];
  if (!hasAddress(ARC_USDC_ADDRESS)) missing.push("VITE_ARC_USDC_ADDRESS");
  if (!hasAddress(VEIL_SHIELD_ADDRESS)) missing.push("VITE_VEIL_SHIELD_ADDRESS");

  if (missing.length > 0) {
    throw new Error(`VeilShield deposit requires setup: ${missing.join(", ")}.`);
  }
}

async function readShieldUsdcDecimals() {
  assertVeilShieldDepositReady();

  return Number(
    await publicClient.readContract({
      address: ARC_USDC_ADDRESS,
      abi: erc20Abi,
      functionName: "decimals",
    })
  );
}

async function readShieldUsdcBalance(account: `0x${string}`) {
  return await publicClient.readContract({
    address: ARC_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [account],
  });
}

async function readShieldUsdcAllowance(account: `0x${string}`) {
  const shieldAddress = VEIL_SHIELD_ADDRESS as `0x${string}`;
  return await publicClient.readContract({
    address: ARC_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "allowance",
    args: [account, shieldAddress],
  });
}

function parseShieldUsdcAmount(value: string, decimals: number) {
  const clean = value.trim();
  if (!clean || Number(clean) <= 0) {
    throw new Error("Enter a valid USDC amount to shield.");
  }

  return parseUnits(clean, decimals);
}

async function ensureShieldUsdcAllowance(input: {
  account: `0x${string}`;
  amountBase: bigint;
  walletClient: ReturnType<typeof getWalletClient>;
}) {
  const shieldAddress = VEIL_SHIELD_ADDRESS as `0x${string}`;
  const allowance = await readShieldUsdcAllowance(input.account);
  if (allowance >= input.amountBase) return undefined;

  const approvalTxHash = await input.walletClient.writeContract({
    address: ARC_USDC_ADDRESS,
    abi: erc20Abi,
    functionName: "approve",
    args: [shieldAddress, input.amountBase],
    chain: arcTestnet,
  });

  await publicClient.waitForTransactionReceipt({ hash: approvalTxHash });
  return approvalTxHash;
}

export async function depositVeilShieldNote(input: {
  amount: string;
  noteCommitment: `0x${string}`;
  encryptedNoteRef?: `0x${string}`;
}): Promise<VeilShieldDepositResult> {
  assertVeilShieldDepositReady();
  if (!isBytes32(input.noteCommitment)) throw new Error("Enter a valid bytes32 note commitment.");
  if (input.encryptedNoteRef && !isBytes32(input.encryptedNoteRef)) {
    throw new Error("Encrypted note reference must be bytes32.");
  }

  await ensureArcNetwork();
  const account = await requestWalletAccount();
  const walletClient = getWalletClient(account as `0x${string}`);
  const decimals = await readShieldUsdcDecimals();
  const amountBase = parseShieldUsdcAmount(input.amount, decimals);
  const balance = await readShieldUsdcBalance(account as `0x${string}`);

  if (balance < amountBase) {
    throw new Error(
      `The connected wallet has ${formatUnits(balance, decimals)} USDC on Arc, which is below this shield deposit.`
    );
  }

  const approvalTxHash = await ensureShieldUsdcAllowance({
    account: account as `0x${string}`,
    amountBase,
    walletClient,
  });

  const encryptedNoteRef = input.encryptedNoteRef || ZERO_BYTES32;
  const shieldAddress = VEIL_SHIELD_ADDRESS as `0x${string}`;
  const txHash = await walletClient.writeContract({
    address: shieldAddress,
    abi: veilShieldAbi,
    functionName: "deposit",
    args: [amountBase, input.noteCommitment, encryptedNoteRef],
    chain: arcTestnet,
  });

  return {
    txHash,
    approvalTxHash,
    amountBase: amountBase.toString(),
    decimals,
    noteCommitment: input.noteCommitment,
    encryptedNoteRef,
  };
}

export function getVeilShieldSetup(): VeilShieldSetup {
  const hasUsdc = hasAddress(ARC_USDC_ADDRESS);
  const deployed = hasAddress(VEIL_SHIELD_ADDRESS);
  const transferVerifierConfigured = hasAddress(VEIL_SHIELD_TRANSFER_VERIFIER_ADDRESS);
  const withdrawVerifierConfigured = hasAddress(VEIL_SHIELD_WITHDRAW_VERIFIER_ADDRESS);
  const missing: string[] = [];

  if (!hasUsdc) missing.push("VITE_ARC_USDC_ADDRESS");
  if (!deployed) missing.push("VITE_VEIL_SHIELD_ADDRESS");
  if (!transferVerifierConfigured) missing.push("VITE_VEIL_SHIELD_TRANSFER_VERIFIER_ADDRESS");
  if (!withdrawVerifierConfigured) missing.push("VITE_VEIL_SHIELD_WITHDRAW_VERIFIER_ADDRESS");

  const checklist = [
    { label: "Noir transfer and withdraw circuits exist", complete: true },
    { label: "Generated Solidity verifiers are committed", complete: true },
    { label: "VeilShield is deployed on Arc Testnet", complete: deployed },
    { label: "Transfer verifier address is configured", complete: transferVerifierConfigured },
    { label: "Withdraw verifier address is configured", complete: withdrawVerifierConfigured },
    { label: "Local encrypted note storage is wired", complete: true },
    { label: "Local Noir/BB proof helper exists", complete: true },
    { label: "Frontend proof generation is wired", complete: false },
    { label: "Recipient note handoff and indexer are wired", complete: false },
    { label: "Closed Payment flow is audited", complete: false },
  ];

  if (!hasUsdc) {
    return {
      prototypeFilesReady: true,
      deployed,
      transferVerifierConfigured,
      withdrawVerifierConfigured,
      settlementReady: false,
      missing,
      statusLabel: "Setup required",
      detail: "Arc USDC must be configured before a VeilShield deployment can be used.",
      checklist,
    };
  }

  if (!deployed) {
    return {
      prototypeFilesReady: true,
      deployed: false,
      transferVerifierConfigured,
      withdrawVerifierConfigured,
      settlementReady: false,
      missing,
      statusLabel: "Prototype ready, deployment required",
      detail: "Circuit files and verifier contracts exist, but no VeilShield address is configured. Closed settlement stays blocked until verifiers and VeilShield are deployed.",
      checklist,
    };
  }

  if (!transferVerifierConfigured || !withdrawVerifierConfigured) {
    return {
      prototypeFilesReady: true,
      deployed,
      transferVerifierConfigured,
      withdrawVerifierConfigured,
      settlementReady: false,
      missing,
      statusLabel: "Deployment configured, verifier setup required",
      detail: "A VeilShield address is configured, but one or both verifier addresses are missing. Proof generation is still not wired.",
      checklist,
    };
  }

  return {
    prototypeFilesReady: true,
    deployed,
    transferVerifierConfigured,
    withdrawVerifierConfigured,
    settlementReady: false,
    missing,
    statusLabel: "VeilShield deployed, proof generation pending",
    detail: "VeilShield and verifier addresses are configured on Arc Testnet. Developer-preview deposits and local note storage are available, but hidden transfer submission stays blocked until browser proof generation, recipient note handoff, indexing, and audit review are complete.",
    checklist,
  };
}
