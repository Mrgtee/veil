import { arcTestnet } from "@/lib/arc";
import type { SourceChain } from "./types";

declare global {
  interface Window {
    ethereum?: {
      request: (input: { method: string; params?: unknown[] }) => Promise<unknown>;
    };
  }
}

export const ARC_CHAIN = {
  label: arcTestnet.name,
  chainIdHex: `0x${arcTestnet.id.toString(16)}` as `0x${string}`,
  rpcUrl: arcTestnet.rpcUrls.default.http[0],
  explorerUrl: arcTestnet.blockExplorers.default.url,
  nativeCurrency: arcTestnet.nativeCurrency,
};

export function getInjectedProvider() {
  if (!window.ethereum) {
    throw new Error("No wallet detected. Open Veil inside MetaMask, Rabby, Rainbow, OKX Wallet, or another EVM wallet browser.");
  }

  return window.ethereum;
}

export function rememberWallet(account: string) {
  localStorage.setItem("veil.wallet", account);
  localStorage.setItem("veil.operator", account);
}

export async function requestWalletAccount(options: { request?: boolean } = {}) {
  const provider = getInjectedProvider();
  const accounts = await provider.request({ method: options.request ? "eth_requestAccounts" : "eth_accounts" }) as string[] | undefined;
  let account = accounts?.[0];

  if (!account && options.request !== false) {
    const requested = await provider.request({ method: "eth_requestAccounts" }) as string[] | undefined;
    account = requested?.[0];
  }

  if (!account) {
    throw new Error("Wallet connection failed.");
  }

  rememberWallet(account);
  return account;
}

export async function switchEvmChain(chain: Pick<SourceChain, "label" | "chainIdHex" | "rpcUrl" | "explorerUrl" | "nativeCurrency">) {
  const provider = getInjectedProvider();

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chain.chainIdHex }],
    });
  } catch (err: unknown) {
    const code = typeof err === "object" && err !== null ? (err as { code?: number }).code : undefined;

    if (code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chain.chainIdHex,
            chainName: chain.label,
            rpcUrls: [chain.rpcUrl],
            nativeCurrency: chain.nativeCurrency,
            blockExplorerUrls: [chain.explorerUrl],
          },
        ],
      });
      return;
    }

    throw err;
  }
}

export async function ensureArcNetwork() {
  await switchEvmChain(ARC_CHAIN);
}

export function shortAddress(address?: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
