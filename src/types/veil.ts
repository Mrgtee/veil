export type PaymentMode = "open" | "confidential";
export type PaymentType = "single" | "batch";
export type PaymentStatus = "pending" | "settled" | "failed";
export type DisclosureStatus = "private" | "requested" | "granted" | "revoked";

export interface Payment {
  id: string;
  type: PaymentType;
  mode: PaymentMode;
  status: PaymentStatus;
  recipient: string;
  recipientLabel?: string;
  amount: string;
  token: string;
  txHash?: string;
  commitmentId?: string;
  externalId?: string;
  batchId?: string;
  batchCount?: number;
  memo?: string;
  createdAt: string;
}

export interface ConfidentialRecord {
  id: string;
  paymentId: string;
  commitmentId: string;
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
  batchPayouts: number;
  pendingCount: number;
  settledToday: number;
  volume30d: string;
}
