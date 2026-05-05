export const APP_API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

export const VEIL_HUB_ADDRESS =
  import.meta.env.VITE_VEIL_HUB_ADDRESS as `0x${string}`;

export const ARC_USDC_ADDRESS =
  import.meta.env.VITE_ARC_USDC_ADDRESS as `0x${string}`;

export const USE_VEIL_HUB =
  String(import.meta.env.VITE_USE_VEIL_HUB || "").toLowerCase() === "true";

export const ARC_CHAIN_ID =
  Number(import.meta.env.VITE_ARC_CHAIN_ID || 5042002);

export const ARC_RPC_URL =
  import.meta.env.VITE_ARC_RPC_URL || "https://rpc.testnet.arc.network";

export const VEIL_SHIELD_ADDRESS =
  import.meta.env.VITE_VEIL_SHIELD_ADDRESS as `0x${string}` | undefined;

export const VEIL_SHIELD_TRANSFER_VERIFIER_ADDRESS =
  import.meta.env.VITE_VEIL_SHIELD_TRANSFER_VERIFIER_ADDRESS as `0x${string}` | undefined;

export const VEIL_SHIELD_WITHDRAW_VERIFIER_ADDRESS =
  import.meta.env.VITE_VEIL_SHIELD_WITHDRAW_VERIFIER_ADDRESS as `0x${string}` | undefined;
