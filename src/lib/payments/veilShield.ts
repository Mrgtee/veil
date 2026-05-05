import { isAddress } from "viem";
import {
  ARC_USDC_ADDRESS,
  VEIL_SHIELD_ADDRESS,
  VEIL_SHIELD_VERIFIER_ADDRESS,
} from "@/lib/env";

export type VeilShieldSetup = {
  prototypeFilesReady: boolean;
  deployed: boolean;
  verifierConfigured: boolean;
  settlementReady: boolean;
  missing: string[];
  statusLabel: string;
  detail: string;
};

function hasAddress(value: string | undefined): value is `0x${string}` {
  return Boolean(value && isAddress(value));
}

export function getVeilShieldSetup(): VeilShieldSetup {
  const hasUsdc = hasAddress(ARC_USDC_ADDRESS);
  const deployed = hasAddress(VEIL_SHIELD_ADDRESS);
  const verifierConfigured = hasAddress(VEIL_SHIELD_VERIFIER_ADDRESS);
  const missing: string[] = [];

  if (!hasUsdc) missing.push("VITE_ARC_USDC_ADDRESS");
  if (!deployed) missing.push("VITE_VEIL_SHIELD_ADDRESS");

  if (!hasUsdc) {
    return {
      prototypeFilesReady: true,
      deployed,
      verifierConfigured,
      settlementReady: false,
      missing,
      statusLabel: "Setup required",
      detail: "Arc USDC must be configured before a VeilShield deployment can be used.",
    };
  }

  if (!deployed) {
    return {
      prototypeFilesReady: true,
      deployed: false,
      verifierConfigured,
      settlementReady: false,
      missing,
      statusLabel: "Prototype ready, deployment required",
      detail: "No VeilShield address is configured. Circuit files exist, but closed settlement stays blocked until verifier artifacts and VeilShield are deployed.",
    };
  }

  if (!verifierConfigured) {
    return {
      prototypeFilesReady: true,
      deployed,
      verifierConfigured: false,
      settlementReady: false,
      missing,
      statusLabel: "Deployment configured, verifier setup required",
      detail: "A VeilShield address is configured, but the frontend has no verifier/prover configuration for generating real proofs.",
    };
  }

  return {
    prototypeFilesReady: true,
    deployed,
    verifierConfigured,
    settlementReady: false,
    missing,
    statusLabel: "Prototype configured, proof flow still blocked",
    detail: "VeilShield env values are present, but the app still needs audited proof generation and verifier wiring before Closed Payment submission can be enabled.",
  };
}
