export type PaymentMode = "open" | "confidential";
export type PaymentType = "single" | "batch";
export type PaymentSourceKind = "arc_direct" | "unified_balance" | "veilshield_closed";
export type PaymentOperation = "payment" | "shield_deposit" | "shield_transfer" | "shield_withdraw";
export type PaymentStatus =
  | "idle"
  | "validating"
  | "encrypting"
  | "awaiting_signature"
  | "submitting"
  | "pending"
  | "pending_settlement"
  | "pending_veilhub_registration"
  | "settled"
  | "failed";
export type BatchStatus =
  | "uploaded"
  | "validating"
  | "invalid_rows"
  | "ready"
  | "encrypting"
  | "awaiting_signature"
  | "submitted"
  | "completed"
  | "partially_failed";
export type DisclosureStatus = "private" | "requested" | "granted" | "revoked";

export interface Payment {
  id: string;
  type: PaymentType;
  mode: PaymentMode;
  source?: PaymentSourceKind;
  operation?: PaymentOperation;
  status: PaymentStatus;
  recipient: string;
  recipients?: string[];
  sender?: string;
  owner?: string;
  payer?: string;
  walletAddress?: string;
  createdBy?: string;
  unifiedBalanceOwner?: string;
  batchSender?: string;
  recipientLabel?: string;
  amount: string;
  amountBase?: string;
  amountHidden?: boolean;
  token: string;
  txHash?: string;
  pendingReference?: string;
  veilHubTxHash?: string;
  paymentId?: string;
  commitmentId?: string;
  externalId?: string;
  batchId?: string;
  batchCount?: number;
  memo?: string;
  createdAt: string;
  liquiditySource?: string;
  sourceChain?: string;
  destinationChain?: string;
  bridgeUsed?: boolean;
  bridgeTxHashes?: string[];
  settlementNote?: string;
}

export interface ConfidentialRecord {
  id: string;
  paymentId: string;
  commitmentId: string;
  owner?: string;
  walletAddress?: string;
  createdBy?: string;
  disclosureStatus: DisclosureStatus;
  authorizedViewers: string[];
  createdAt: string;
}

export interface DisclosureAccess {
  id: string;
  recordId: string;
  viewer: string;
  viewerLabel?: string;
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
  revoked: boolean;
}

export interface AuditEvent {
  id: string;
  action: string;
  actor: string;
  target: string;
  timestamp: string;
}

export interface ActivityEvent {
  id: string;
  kind: "payment" | "batch" | "disclosure" | "access";
  title: string;
  description: string;
  timestamp: string;
}

export interface DashboardStats {
  totalPayments: number;
  openPayments: number;
  confidentialPayments: number;
  batchPayments: number;
  pendingCount: number;
  settledToday: number;
  volume30d: string;
}
