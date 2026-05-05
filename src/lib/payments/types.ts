import type { PaymentMode } from "@/types/veil";

export type PaymentSource = "arc-direct" | "unified-balance";

export type SourceChainValue = "Base_Sepolia" | "Ethereum_Sepolia" | "Arc_Testnet";

export type SourceChain = {
  label: string;
  value: SourceChainValue;
  chainIdHex: `0x${string}`;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
};

export const PAYMENT_MODE_OPTIONS: Array<{
  value: PaymentMode;
  label: string;
  shortLabel: string;
  description: string;
}> = [
  {
    value: "open",
    label: "Open Payment",
    shortLabel: "Open",
    description: "Visible USDC settlement on Arc.",
  },
  {
    value: "confidential",
    label: "Closed Payment",
    shortLabel: "Closed",
    description: "Sender and recipient stay visible; the amount belongs in VeilShield's hidden-amount layer.",
  },
];

export const PAYMENT_SOURCE_OPTIONS: Array<{
  value: PaymentSource;
  label: string;
  description: string;
}> = [
  {
    value: "arc-direct",
    label: "Arc Direct",
    description: "Send directly from the connected wallet on Arc.",
  },
  {
    value: "unified-balance",
    label: "Unified Balance USDC",
    description: "Spend confirmed user-owned Unified Balance USDC into Arc settlement.",
  },
];

export function getPaymentModeLabel(mode: PaymentMode) {
  return mode === "confidential" ? "Closed Payment" : "Open Payment";
}

export function getPaymentModeShortLabel(mode: PaymentMode) {
  return mode === "confidential" ? "Closed" : "Open";
}

export function isUnifiedPaymentSource(source: PaymentSource | string | undefined) {
  const normalized = String(source || "").toLowerCase().replaceAll("_", "-");
  return normalized === "unified-balance" || normalized.includes("unified");
}

export function getPaymentSourceLabel(
  source: PaymentSource | string | undefined,
  options: { sequential?: boolean } = {}
) {
  const normalized = String(source || "").toLowerCase().replaceAll("_", "-");

  if (normalized.includes("veilshield") || normalized.includes("closed")) {
    return "VeilShield closed-payment pool";
  }

  if (isUnifiedPaymentSource(source)) {
    if (options.sequential || normalized.includes("sequential")) {
      return "Sequential Unified Balance batch";
    }

    return "Unified Balance USDC";
  }

  return "Arc Direct via VeilHub";
}
