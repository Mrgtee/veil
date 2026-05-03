import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import type { EIP1193Provider } from "viem";

declare global {
  interface Window {
    ethereum?: EIP1193Provider;
  }
}

const kit = new AppKit();

export async function bridgeEthereumSepoliaToArcTestnet(amount: string) {
  if (!window.ethereum) {
    throw new Error("No browser wallet found. Open with MetaMask or another injected wallet.");
  }

  const adapter = await createViemAdapterFromProvider({
    provider: window.ethereum,
  });

  const result = await kit.bridge({
    from: { adapter, chain: "Ethereum_Sepolia" },
    to: { adapter, chain: "Arc_Testnet" },
    amount,
  });

  return result;
}

export async function bridgeArcTestnetToEthereumSepolia(amount: string) {
  if (!window.ethereum) {
    throw new Error("No browser wallet found. Open with MetaMask or another injected wallet.");
  }

  const adapter = await createViemAdapterFromProvider({
    provider: window.ethereum,
  });

  const result = await kit.bridge({
    from: { adapter, chain: "Arc_Testnet" },
    to: { adapter, chain: "Ethereum_Sepolia" },
    amount,
  });

  return result;
}
