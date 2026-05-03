import type {
  ActivityEvent,
  AuditEvent,
  ConfidentialRecord,
  DashboardStats,
  DisclosureAccess,
  Payment,
  PaymentMode,
} from "@/types/veil";

const PAYMENTS_KEY = "veil.live.payments";
const RECORDS_KEY = "veil.live.records";
const ACCESS_KEY = "veil.live.access";
const AUDIT_KEY = "veil.live.audit";

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function nowIso() {
  return new Date().toISOString();
}

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function isWithin30Days(iso: string) {
  const ts = new Date(iso).getTime();
  return Date.now() - ts <= 30 * 24 * 60 * 60 * 1000;
}

function formatDisplayAmountFromBase(baseAmount: string) {
  const n = Number(baseAmount) / 1e18;
  return n.toString();
}

function makeId(prefix: string) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}

function getPayments(): Payment[] {
  return readJson<Payment[]>(PAYMENTS_KEY, []);
}

function setPayments(payments: Payment[]) {
  writeJson(PAYMENTS_KEY, payments);
}

function getRecords(): ConfidentialRecord[] {
  return readJson<ConfidentialRecord[]>(RECORDS_KEY, []);
}

function setRecords(records: ConfidentialRecord[]) {
  writeJson(RECORDS_KEY, records);
}

function getAccess(): DisclosureAccess[] {
  return readJson<DisclosureAccess[]>(ACCESS_KEY, []);
}

function setAccess(access: DisclosureAccess[]) {
  writeJson(ACCESS_KEY, access);
}

function getAudit(): AuditEvent[] {
  return readJson<AuditEvent[]>(AUDIT_KEY, []);
}

function setAudit(audit: AuditEvent[]) {
  writeJson(AUDIT_KEY, audit);
}

function addAudit(action: string, actor: string, target: string) {
  const audit = getAudit();
  audit.unshift({
    id: makeId("audit"),
    action,
    actor,
    target,
    timestamp: nowIso(),
  });
  setAudit(audit);
}

export const veilApi = {
  async listPayments(): Promise<Payment[]> {
    return getPayments().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },

  async listConfidentialRecords(): Promise<ConfidentialRecord[]> {
    return getRecords().sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  },

  async listDisclosureAccess(): Promise<DisclosureAccess[]> {
    return getAccess().sort((a, b) => +new Date(b.grantedAt) - +new Date(a.grantedAt));
  },

  async listAuditTrail(): Promise<AuditEvent[]> {
    return getAudit().sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
  },

  async requestReveal(recordId: string): Promise<void> {
    const records = getRecords().map((r) =>
      r.id === recordId ? { ...r, disclosureStatus: "requested" as const } : r
    );
    setRecords(records);
    addAudit("Reveal requested", "current-user", recordId);
  },

  async grantAccess(input: { recordId: string; viewer: string; durationDays?: number }): Promise<void> {
    const access = getAccess();
    const grantedAt = nowIso();
    const expiresAt = input.durationDays
      ? new Date(Date.now() + input.durationDays * 86400e3).toISOString()
      : undefined;

    access.unshift({
      id: makeId("acc"),
      recordId: input.recordId,
      viewer: input.viewer,
      viewerLabel: input.viewer,
      grantedBy: "current-user",
      grantedAt,
      expiresAt,
      revoked: false,
    });
    setAccess(access);

    const records = getRecords().map((r) =>
      r.id === input.recordId ? { ...r, disclosureStatus: "granted" as const } : r
    );
    setRecords(records);

    addAudit("Access granted", "current-user", input.recordId);
  },

  async revokeAccess(accessId: string): Promise<void> {
    const access = getAccess().map((a) =>
      a.id === accessId ? { ...a, revoked: true } : a
    );
    setAccess(access);
    addAudit("Access revoked", "current-user", accessId);
  },

  async listActivity(): Promise<ActivityEvent[]> {
    const payments = getPayments();
    const records = getRecords();
    const access = getAccess();

    const events: ActivityEvent[] = [
      ...payments.map((p) => ({
        id: `evt_${p.id}`,
        kind: p.type === "batch" ? "batch" : "payment",
        title:
          p.type === "batch"
            ? `${p.mode === "confidential" ? "Confidential" : "Open"} ${p.bridgeUsed ? "bridged " : ""}batch submitted`
            : `${p.mode === "confidential" ? "Confidential" : "Open"} ${p.bridgeUsed ? "bridged " : ""}payment submitted`,
        description: p.txHash || p.id,
        timestamp: p.createdAt,
      })),
      ...records
        .filter((r) => r.disclosureStatus !== "private")
        .map((r) => ({
          id: `evt_rec_${r.id}`,
          kind: "disclosure",
          title:
            r.disclosureStatus === "requested"
              ? "Reveal requested"
              : r.disclosureStatus === "granted"
              ? "Disclosure access granted"
              : "Disclosure access updated",
          description: r.commitmentId,
          timestamp: r.createdAt,
        })),
      ...access.map((a) => ({
        id: `evt_acc_${a.id}`,
        kind: "access",
        title: a.revoked ? "Access revoked" : "Access granted",
        description: a.viewerLabel || a.viewer,
        timestamp: a.grantedAt,
      })),
    ];

    return events.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
  },

  async getDashboardStats(): Promise<DashboardStats> {
    const payments = getPayments();

    const settledToday = payments.filter(
      (p) => p.status === "settled" && p.createdAt.slice(0, 10) === todayDateString()
    ).length;

    const volume30d = payments
      .filter((p) => isWithin30Days(p.createdAt))
      .reduce((sum, p) => sum + Number(p.amount || "0"), 0);

    return {
      totalPayments: payments.length,
      openPayments: payments.filter((p) => p.mode === "open").length,
      confidentialPayments: payments.filter((p) => p.mode === "confidential").length,
      batchPayouts: payments.filter((p) => p.type === "batch").length,
      pendingCount: payments.filter((p) => p.status === "pending").length,
      settledToday,
      volume30d: volume30d.toFixed(4),
    };
  },

  async recordSinglePayment(input: {
    mode: PaymentMode;
    recipient: string;
    recipientLabel?: string;
    amountBase: string;
    memo?: string;
    txHash: string;
    commitmentId?: string;
    externalId?: string;
    status?: Payment["status"];
    liquiditySource?: string;
    bridgeUsed?: boolean;
    sourceChain?: string;
    destinationChain?: string;
    bridgeTxHashes?: string[];
    settlementNote?: string;
  }): Promise<void> {
    const payments = getPayments();

    const payment: Payment = {
      id: makeId("pmt"),
      type: "single",
      mode: input.mode,
      status: input.status || "settled",
      recipient: input.recipient,
      recipientLabel: input.recipientLabel,
      amount: formatDisplayAmountFromBase(input.amountBase),
      token: "USDC",
      txHash: input.txHash,
      commitmentId: input.commitmentId,
      externalId: input.externalId,
      memo: input.memo,
      createdAt: nowIso(),
      liquiditySource: input.liquiditySource,
      bridgeUsed: input.bridgeUsed,
      sourceChain: input.sourceChain,
      destinationChain: input.destinationChain,
      bridgeTxHashes: input.bridgeTxHashes,
      settlementNote: input.settlementNote,
    } as Payment;

    payments.unshift(payment);
    setPayments(payments);

    if (input.mode === "confidential" && input.commitmentId) {
      const records = getRecords();
      records.unshift({
        id: makeId("rec"),
        paymentId: payment.id,
        commitmentId: input.commitmentId,
        disclosureStatus: "private",
        authorizedViewers: [],
        createdAt: payment.createdAt,
      });
      setRecords(records);
    }

    addAudit(
      input.mode === "confidential" ? "Confidential payment recorded" : "Open payment recorded",
      "current-user",
      payment.txHash || payment.id
    );
  },

  async recordBatchPayment(input: {
    mode: PaymentMode;
    rows: Array<{ recipient: string; amount: string; memo?: string; recipientLabel?: string }>;
    txHash: string;
    batchId: string;
    batchCommitment?: string;
    status?: Payment["status"];
    liquiditySource?: string;
    bridgeUsed?: boolean;
    sourceChain?: string;
    destinationChain?: string;
    bridgeTxHashes?: string[];
    settlementNote?: string;
  }): Promise<void> {
    const payments = getPayments();

    const totalBase = input.rows.reduce((sum, row) => sum + Number(row.amount), 0);

    const payment: Payment = {
      id: makeId("pmt"),
      type: "batch",
      mode: input.mode,
      status: input.status || "settled",
      recipient: `${input.rows.length} recipients`,
      recipientLabel: `${input.rows.length} recipients`,
      amount: formatDisplayAmountFromBase(String(totalBase)),
      token: "USDC",
      txHash: input.txHash,
      commitmentId: input.batchCommitment,
      batchId: input.batchId,
      batchCount: input.rows.length,
      createdAt: nowIso(),
      liquiditySource: input.liquiditySource,
      bridgeUsed: input.bridgeUsed,
      sourceChain: input.sourceChain,
      destinationChain: input.destinationChain,
      bridgeTxHashes: input.bridgeTxHashes,
      settlementNote: input.settlementNote,
    } as Payment;

    payments.unshift(payment);
    setPayments(payments);

    if (input.mode === "confidential" && input.batchCommitment) {
      const records = getRecords();
      records.unshift({
        id: makeId("rec"),
        paymentId: payment.id,
        commitmentId: input.batchCommitment,
        disclosureStatus: "private",
        authorizedViewers: [],
        createdAt: payment.createdAt,
      });
      setRecords(records);
    }

    addAudit(
      input.mode === "confidential" ? "Confidential batch recorded" : "Open batch recorded",
      "current-user",
      payment.txHash || payment.id
    );
  },

  async recordBridge(input: {
    mode: PaymentMode;
    amount: string;
    sourceChain: string;
    destinationChain: string;
    recipientLabel?: string;
    memo?: string;
    txHashes: string[];
    commitmentId?: string | null;
  }): Promise<void> {
    const payments = getPayments();

    const payment: Payment = {
      id: makeId("pmt"),
      type: "single",
      mode: input.mode,
      status: "settled",
      recipient: input.recipientLabel || "Bridge settlement",
      recipientLabel: input.recipientLabel || "Bridge settlement",
      amount: input.amount,
      token: "USDC",
      txHash: input.txHashes[input.txHashes.length - 1] || "",
      memo: input.memo,
      createdAt: nowIso(),
      bridgeUsed: true,
      sourceChain: input.sourceChain,
      destinationChain: input.destinationChain,
      bridgeTxHashes: input.txHashes,
      commitmentId: input.commitmentId || undefined,
    } as Payment;

    payments.unshift(payment);
    setPayments(payments);

    if (input.mode === "confidential" && input.commitmentId) {
      const records = getRecords();
      records.unshift({
        id: makeId("rec"),
        paymentId: payment.id,
        commitmentId: input.commitmentId,
        disclosureStatus: "private",
        authorizedViewers: [],
        createdAt: payment.createdAt,
      });
      setRecords(records);
    }

    addAudit(
      input.mode === "confidential" ? "Confidential bridge recorded" : "Open bridge recorded",
      "current-user",
      payment.txHash || payment.id
    );
  },
};
