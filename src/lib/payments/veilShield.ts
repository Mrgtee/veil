import { isAddress } from "viem";
import {
  ARC_USDC_ADDRESS,
  VEIL_SHIELD_ADDRESS,
  VEIL_SHIELD_TRANSFER_VERIFIER_ADDRESS,
  VEIL_SHIELD_WITHDRAW_VERIFIER_ADDRESS,
} from "@/lib/env";

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

function hasAddress(value: string | undefined): value is `0x${string}` {
  return Boolean(value && isAddress(value));
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
    { label: "Frontend proof generation is wired", complete: false },
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
    detail: "VeilShield and verifier addresses are configured on Arc Testnet, but the app still needs real proof generation, note management, and audit review before Closed Payment submission can be enabled.",
    checklist,
  };
}
