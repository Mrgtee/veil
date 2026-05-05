import { ARC_CHAIN_ID, ARC_USDC_ADDRESS, VEIL_HUB_ADDRESS } from "@/lib/env";

export const ARC_TESTNET_DEPLOYMENT = {
  network: "Arc Testnet",
  chainId: 5042002,
  veilHub: "0x30c77c1C20A5cBB171DE9090789F3dB98aA9734b",
  usdc: "0x3600000000000000000000000000000000000000",
  explorerUrl: "https://testnet.arcscan.app",
} as const;

export const ACTIVE_ARC_DEPLOYMENT = {
  network: ARC_TESTNET_DEPLOYMENT.network,
  chainId: ARC_CHAIN_ID || ARC_TESTNET_DEPLOYMENT.chainId,
  veilHub: VEIL_HUB_ADDRESS || ARC_TESTNET_DEPLOYMENT.veilHub,
  usdc: ARC_USDC_ADDRESS || ARC_TESTNET_DEPLOYMENT.usdc,
  explorerUrl: ARC_TESTNET_DEPLOYMENT.explorerUrl,
} as const;

export function getArcExplorerTxUrl(txHash: string) {
  return `${ARC_TESTNET_DEPLOYMENT.explorerUrl}/tx/${txHash}`;
}

export function getArcExplorerAddressUrl(address: string) {
  return `${ARC_TESTNET_DEPLOYMENT.explorerUrl}/address/${address}`;
}

export function shortAddress(address: string, head = 6, tail = 4) {
  if (!address) return "";
  if (address.length <= head + tail) return address;
  return `${address.slice(0, head)}...${address.slice(-tail)}`;
}
