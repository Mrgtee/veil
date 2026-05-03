import "dotenv/config";
import { AppKit } from "@circle-fin/app-kit";
import { createCircleWalletsAdapter } from "@circle-fin/adapter-circle-wallets";

const adapter = createCircleWalletsAdapter({
  apiKey: process.env.CIRCLE_API_KEY!,
  entitySecret: process.env.CIRCLE_ENTITY_SECRET!,
});

const kit = new AppKit();

export async function bridgeEthSepoliaToArcTestnet(amount: string) {
  return await kit.bridge({
    from: {
      adapter,
      chain: "Ethereum_Sepolia",
      address: process.env.CIRCLE_WALLET_ADDRESS_ETH_SEPOLIA!,
    },
    to: {
      adapter,
      chain: "Arc_Testnet",
      address: process.env.CIRCLE_WALLET_ADDRESS_ARC_TESTNET!,
    },
    amount,
  });
}

export async function bridgeArcTestnetToEthSepolia(amount: string) {
  return await kit.bridge({
    from: {
      adapter,
      chain: "Arc_Testnet",
      address: process.env.CIRCLE_WALLET_ADDRESS_ARC_TESTNET!,
    },
    to: {
      adapter,
      chain: "Ethereum_Sepolia",
      address: process.env.CIRCLE_WALLET_ADDRESS_ETH_SEPOLIA!,
    },
    amount,
  });
}
