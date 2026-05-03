export const APP_API_BASE =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8787";

export const PAYMENT_VAULT_ADDRESS =
  import.meta.env.VITE_PAYMENT_VAULT_ADDRESS as `0x${string}`;

export const BATCH_PAYOUT_ADDRESS =
  import.meta.env.VITE_BATCH_PAYOUT_ADDRESS as `0x${string}`;

export const VEIL_HUB_ADDRESS =
  import.meta.env.VITE_VEIL_HUB_ADDRESS as `0x${string}`;

export const ARC_USDC_ADDRESS =
  import.meta.env.VITE_ARC_USDC_ADDRESS as `0x${string}`;
