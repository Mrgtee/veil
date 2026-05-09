import { Buffer } from "buffer";
import type { SourceChain, SourceChainValue } from "./types";
import { getWalletProvider, requestWalletAccount, switchEvmChain } from "./wallet";

export type { SourceChainValue } from "./types";

export type UnifiedBalanceStep = {
  name?: string;
  state?: string;
  txHash?: string;
  explorerUrl?: string;
};

export type UnifiedBalanceResult = {
  txHash?: string;
  steps?: UnifiedBalanceStep[];
  result?: {
    steps?: UnifiedBalanceStep[];
  };
};

export type UnifiedBalanceData = {
  totalConfirmedBalance?: string;
  totalPendingBalance?: string;
  breakdown?: Array<{
    depositor?: string;
    breakdown?: Array<{
      chain?: string;
      confirmedBalance?: string;
      pendingBalance?: string;
    }>;
  }>;
};

type WalletAdapter = unknown;

type CircleKit = {
  unifiedBalance: {
    getBalances: (input: {
      sources: Array<{ adapter: WalletAdapter }>;
      networkType: "testnet";
      includePending: boolean;
    }) => Promise<UnifiedBalanceData>;
    deposit: (input: {
      from: { adapter: WalletAdapter; chain: SourceChainValue };
      amount: string;
      token: "USDC";
    }) => Promise<UnifiedBalanceResult>;
    spend: (input: {
      amount: string;
      token: "USDC";
      from: { adapter: WalletAdapter };
      to: { adapter: WalletAdapter; chain: "Arc_Testnet"; recipientAddress: `0x${string}` };
    }) => Promise<UnifiedBalanceResult>;
  };
};

type CircleTools = {
  kit: CircleKit;
  createViemAdapterFromProvider: (input: { provider: NonNullable<Window["ethereum"]> }) => WalletAdapter;
};

let cachedKit: CircleKit | null = null;

export const UNIFIED_BALANCE_SOURCE_CHAINS: SourceChain[] = [
  {
    label: "Base Sepolia",
    value: "Base_Sepolia",
    chainIdHex: "0x14A34",
    rpcUrl: "https://sepolia.base.org",
    explorerUrl: "https://sepolia.basescan.org",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  },
  {
    label: "Ethereum Sepolia",
    value: "Ethereum_Sepolia",
    chainIdHex: "0xaa36a7",
    rpcUrl: "https://sepolia.drpc.org",
    explorerUrl: "https://sepolia.etherscan.io",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  },
  {
    label: "Arc Testnet",
    value: "Arc_Testnet",
    chainIdHex: "0x4CEF52",
    rpcUrl: "https://rpc.testnet.arc.network",
    explorerUrl: "https://testnet.arcscan.app",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  },
];

export function getSourceChain(value: SourceChainValue) {
  const chain = UNIFIED_BALANCE_SOURCE_CHAINS.find((item) => item.value === value);
  if (!chain) throw new Error(`Unsupported source chain: ${value}`);
  return chain;
}

export function getUnifiedBalanceCacheKey(account?: string) {
  return `veil.unified.balance.${(account || "").toLowerCase()}`;
}

export function readUnifiedBalanceCache(account?: string): UnifiedBalanceData | null {
  if (!account) return null;

  try {
    const raw = localStorage.getItem(getUnifiedBalanceCacheKey(account));
    return raw ? (JSON.parse(raw) as UnifiedBalanceData) : null;
  } catch {
    return null;
  }
}

export function saveUnifiedBalanceCache(account: string | undefined, balance: UnifiedBalanceData | null) {
  if (!account || !balance) return;
  localStorage.setItem(getUnifiedBalanceCacheKey(account), JSON.stringify(balance));
  localStorage.setItem("veil.unified.balance.lastWallet", account);
}

export function normalizeSteps(result: UnifiedBalanceResult | null | undefined): UnifiedBalanceStep[] {
  if (Array.isArray(result?.steps)) return result.steps;
  if (Array.isArray(result?.result?.steps)) return result.result.steps;
  return [];
}

export function getFinalTxHash(result: UnifiedBalanceResult | null | undefined) {
  if (result?.txHash) return result.txHash as string;

  const hashes = normalizeSteps(result)
    .map((step) => step.txHash)
    .filter(Boolean);

  return hashes[hashes.length - 1] || "";
}

export function getExplorerUrl(chainValue: SourceChainValue, txHash: string) {
  const chain = getSourceChain(chainValue);
  return `${chain.explorerUrl}/tx/${txHash}`;
}

async function getCircleTools(): Promise<CircleTools> {
  const globalWithBuffer = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
  if (!globalWithBuffer.Buffer) {
    globalWithBuffer.Buffer = Buffer;
  }

  const appKitModule = await import("@circle-fin/app-kit") as {
    AppKit?: new () => CircleKit;
  };
  const adapterModule = await import("@circle-fin/adapter-viem-v2") as {
    createViemAdapterFromProvider?: CircleTools["createViemAdapterFromProvider"];
  };

  const AppKit = appKitModule.AppKit;
  const createViemAdapterFromProvider = adapterModule.createViemAdapterFromProvider;

  if (!AppKit) {
    throw new Error("Circle AppKit failed to load in the browser.");
  }

  if (!createViemAdapterFromProvider) {
    throw new Error("Circle viem adapter failed to load in the browser.");
  }

  if (!cachedKit) {
    cachedKit = new AppKit();
  }

  if (!cachedKit.unifiedBalance) {
    throw new Error("Unified USDC Balance is not available in this Circle AppKit version.");
  }

  return { kit: cachedKit, createViemAdapterFromProvider };
}

export async function getWalletAdapter() {
  await requestWalletAccount();
  const provider = await getWalletProvider();
  const { createViemAdapterFromProvider } = await getCircleTools();

  return createViemAdapterFromProvider({ provider });
}

export async function readUnifiedBalance(account?: string): Promise<UnifiedBalanceData> {
  const owner = account || (await requestWalletAccount());
  const { kit } = await getCircleTools();
  const adapter = await getWalletAdapter();

  const balance = await kit.unifiedBalance.getBalances({
    sources: [{ adapter }],
    networkType: "testnet",
    includePending: true,
  });

  saveUnifiedBalanceCache(owner, balance);
  return balance;
}

export async function depositUnifiedBalance(input: {
  sourceChain: SourceChainValue;
  amount: string;
  account?: string;
}) {
  const chain = getSourceChain(input.sourceChain);
  await switchEvmChain(chain);

  const { kit } = await getCircleTools();
  const adapter = await getWalletAdapter();

  const result = await kit.unifiedBalance.deposit({
    from: {
      adapter,
      chain: input.sourceChain,
    },
    amount: input.amount,
    token: "USDC",
  });

  if (input.account) {
    await readUnifiedBalance(input.account);
  }

  return result;
}

export async function spendUnifiedBalanceToArc(input: {
  amount: string;
  recipientAddress: `0x${string}`;
}) {
  const { kit } = await getCircleTools();
  const adapter = await getWalletAdapter();

  return await kit.unifiedBalance.spend({
    amount: input.amount,
    token: "USDC",
    from: { adapter },
    to: {
      adapter,
      chain: "Arc_Testnet",
      recipientAddress: input.recipientAddress,
    },
  });
}

export function getBalanceNumber(balance: UnifiedBalanceData | null | undefined, key: "totalConfirmedBalance" | "totalPendingBalance" = "totalConfirmedBalance") {
  return Number(balance?.[key] || "0");
}

export function balanceReducedEnough(before: number, after: number, amount: number) {
  if (!Number.isFinite(before) || !Number.isFinite(after) || !Number.isFinite(amount)) {
    return false;
  }

  return before - after >= Math.max(amount * 0.9, amount - 0.000001);
}

export function getActiveUnifiedSources(balance: UnifiedBalanceData | null | undefined) {
  const rows: Array<{ depositor?: string; chain: string; confirmed: string; pending: string }> = [];

  for (const depositor of balance?.breakdown ?? []) {
    for (const item of depositor?.breakdown ?? []) {
      const confirmed = item.confirmedBalance ?? "0.000000";
      const pending = item.pendingBalance ?? "0.000000";

      if (confirmed !== "0.000000" || pending !== "0.000000") {
        rows.push({
          depositor: depositor.depositor,
          chain: item.chain || "Unknown chain",
          confirmed,
          pending,
        });
      }
    }
  }

  return rows;
}
