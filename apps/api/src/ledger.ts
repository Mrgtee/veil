import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const paymentStatusSchema = z.enum([
  "settled",
  "pending_settlement",
  "pending_veilhub_registration",
  "failed",
]);

const paymentSourceSchema = z.enum([
  "arc_direct",
  "unified_balance",
  "veilshield_closed",
]);

const paymentModeSchema = z.enum(["open", "confidential"]);
const paymentTypeSchema = z.enum(["single", "batch"]);
const paymentOperationSchema = z.enum(["payment", "shield_deposit", "shield_transfer", "shield_withdraw"]);
const disclosureStatusSchema = z.enum(["private", "requested", "granted", "revoked"]);

const paymentSchema = z.object({
  id: z.string().min(1),
  type: paymentTypeSchema,
  mode: paymentModeSchema,
  source: paymentSourceSchema,
  operation: paymentOperationSchema.optional(),
  status: paymentStatusSchema,
  recipient: z.string().min(1),
  recipientLabel: z.string().optional(),
  amount: z.string().min(1),
  amountBase: z.string().min(1),
  token: z.string().default("USDC"),
  txHash: z.string().optional(),
  pendingReference: z.string().optional(),
  veilHubTxHash: z.string().optional(),
  paymentId: z.string().optional(),
  commitmentId: z.string().optional(),
  externalId: z.string().optional(),
  batchId: z.string().optional(),
  batchCount: z.number().int().nonnegative().optional(),
  memo: z.string().optional(),
  createdAt: z.string().datetime(),
  liquiditySource: z.string().optional(),
  sourceChain: z.string().optional(),
  destinationChain: z.string().optional(),
  bridgeUsed: z.boolean().optional(),
  bridgeTxHashes: z.array(z.string()).optional(),
  settlementNote: z.string().optional(),
  error: z.string().optional(),
});

const confidentialRecordSchema = z.object({
  id: z.string().min(1),
  paymentId: z.string().min(1),
  commitmentId: z.string().min(1),
  disclosureStatus: disclosureStatusSchema,
  authorizedViewers: z.array(z.string()),
  createdAt: z.string().datetime(),
});

const disclosureAccessSchema = z.object({
  id: z.string().min(1),
  recordId: z.string().min(1),
  viewer: z.string().min(1),
  viewerLabel: z.string().optional(),
  grantedBy: z.string().min(1),
  grantedAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
  revoked: z.boolean(),
});

const auditEventSchema = z.object({
  id: z.string().min(1),
  action: z.string().min(1),
  actor: z.string().min(1),
  target: z.string().min(1),
  timestamp: z.string().datetime(),
});

const ledgerSchema = z.object({
  version: z.literal(1),
  payments: z.array(paymentSchema),
  confidentialRecords: z.array(confidentialRecordSchema),
  disclosureAccess: z.array(disclosureAccessSchema),
  auditTrail: z.array(auditEventSchema),
});

export const createPaymentSchema = z.object({
  type: paymentTypeSchema,
  mode: paymentModeSchema,
  source: paymentSourceSchema,
  operation: paymentOperationSchema.optional().default("payment"),
  status: paymentStatusSchema,
  recipient: z.string().min(1),
  recipientLabel: z.string().optional().default(""),
  amount: z.string().min(1),
  amountBase: z.string().min(1),
  token: z.string().optional().default("USDC"),
  txHash: z.string().optional().default(""),
  pendingReference: z.string().optional().default(""),
  veilHubTxHash: z.string().optional().default(""),
  paymentId: z.string().optional().default(""),
  commitmentId: z.string().optional().default(""),
  externalId: z.string().optional().default(""),
  batchId: z.string().optional().default(""),
  batchCount: z.number().int().nonnegative().optional(),
  memo: z.string().optional().default(""),
  liquiditySource: z.string().optional().default(""),
  sourceChain: z.string().optional().default(""),
  destinationChain: z.string().optional().default("Arc Testnet"),
  bridgeUsed: z.boolean().optional().default(false),
  bridgeTxHashes: z.array(z.string()).optional().default([]),
  settlementNote: z.string().optional().default(""),
  error: z.string().optional().default(""),
});

export const grantAccessSchema = z.object({
  recordId: z.string().min(1),
  viewer: z.string().min(1),
  durationDays: z.number().int().positive().optional(),
});

export type Ledger = z.infer<typeof ledgerSchema>;
export type LedgerPayment = z.infer<typeof paymentSchema>;
export type LedgerPaymentInput = z.infer<typeof createPaymentSchema>;

function defaultLedger(): Ledger {
  return {
    version: 1,
    payments: [],
    confidentialRecords: [],
    disclosureAccess: [],
    auditTrail: [],
  };
}

function ledgerPath() {
  return process.env.VEIL_LEDGER_PATH || path.join(process.cwd(), "data", "veil-ledger.json");
}

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${randomUUID().slice(0, 8)}`;
}

function hasRealTxHash(value?: string) {
  if (!value) return false;
  return value
    .split(",")
    .map((item) => item.trim())
    .some((item) => /^0x[a-fA-F0-9]{64}$/.test(item));
}

function assertPaymentIsTruthful(input: LedgerPaymentInput) {
  if (input.status === "settled" && !hasRealTxHash(input.txHash)) {
    throw new Error("Settled payments require a real transaction hash.");
  }

  if (input.status === "pending_veilhub_registration" && !hasRealTxHash(input.txHash)) {
    throw new Error("Payments pending VeilHub registration require the final Arc transaction hash.");
  }

  if (
    input.status === "pending_settlement" &&
    !input.pendingReference &&
    !String(input.txHash || "").startsWith("pending_")
  ) {
    throw new Error("Pending settlement payments require an explicit pending reference.");
  }
}

async function readLedger(): Promise<Ledger> {
  try {
    const raw = await readFile(ledgerPath(), "utf8");
    return ledgerSchema.parse(JSON.parse(raw));
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "code" in err && (err as { code?: string }).code === "ENOENT") {
      return defaultLedger();
    }

    throw err;
  }
}

async function writeLedger(ledger: Ledger) {
  const parsed = ledgerSchema.parse(ledger);
  const file = ledgerPath();
  const dir = path.dirname(file);
  const tmp = path.join(dir, `.veil-ledger-${process.pid}-${Date.now()}.tmp`);

  await mkdir(dir, { recursive: true });
  await writeFile(tmp, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  await rename(tmp, file);
}

async function mutateLedger<T>(mutator: (ledger: Ledger) => T | Promise<T>): Promise<T> {
  const ledger = await readLedger();
  const result = await mutator(ledger);
  await writeLedger(ledger);
  return result;
}

function addAudit(ledger: Ledger, action: string, actor: string, target: string) {
  ledger.auditTrail.unshift({
    id: makeId("audit"),
    action,
    actor,
    target,
    timestamp: nowIso(),
  });
}

function createConfidentialRecordIfNeeded(ledger: Ledger, payment: LedgerPayment) {
  if (payment.mode !== "confidential" || !payment.commitmentId) return;

  ledger.confidentialRecords.unshift({
    id: makeId("rec"),
    paymentId: payment.id,
    commitmentId: payment.commitmentId,
    disclosureStatus: "private",
    authorizedViewers: [],
    createdAt: payment.createdAt,
  });
}

function paymentOperationLabel(operation?: string) {
  if (operation === "shield_deposit") return "VeilShield deposit";
  if (operation === "shield_transfer") return "VeilShield transfer";
  if (operation === "shield_withdraw") return "VeilShield withdraw";
  return "payment";
}

function paymentActivityTitle(payment: LedgerPayment) {
  const status = payment.status.replaceAll("_", " ");

  if (payment.operation === "shield_deposit") return `VeilShield deposit ${status}`;
  if (payment.operation === "shield_transfer") return `VeilShield transfer ${status}`;
  if (payment.operation === "shield_withdraw") return `VeilShield withdraw ${status}`;

  if (payment.type === "batch") {
    return `${payment.mode === "confidential" ? "Closed" : "Open"} batch ${status}`;
  }

  return `${payment.mode === "confidential" ? "Closed" : "Open"} payment ${status}`;
}

export async function getPayments() {
  const ledger = await readLedger();
  return ledger.payments.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export async function getConfidentialRecords() {
  const ledger = await readLedger();
  return ledger.confidentialRecords.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export async function getDisclosureAccess() {
  const ledger = await readLedger();
  return ledger.disclosureAccess.sort((a, b) => +new Date(b.grantedAt) - +new Date(a.grantedAt));
}

export async function getAuditTrail() {
  const ledger = await readLedger();
  return ledger.auditTrail.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
}

export async function createPayment(input: LedgerPaymentInput) {
  assertPaymentIsTruthful(input);

  return await mutateLedger((ledger) => {
    if (input.externalId) {
      const existing = ledger.payments.find((payment) => payment.externalId === input.externalId);
      if (existing) return existing;
    }

    const createdAt = nowIso();
    const id = makeId(input.type === "batch" ? "batch" : "pmt");
    const txHash = input.txHash || input.pendingReference || undefined;

    const payment: LedgerPayment = {
      id,
      type: input.type,
      mode: input.mode,
      source: input.source,
      operation: input.operation === "payment" ? undefined : input.operation,
      status: input.status,
      recipient: input.recipient,
      recipientLabel: input.recipientLabel || undefined,
      amount: input.amount,
      amountBase: input.amountBase,
      token: input.token || "USDC",
      txHash,
      pendingReference: input.pendingReference || undefined,
      veilHubTxHash: input.veilHubTxHash || undefined,
      paymentId: input.paymentId || undefined,
      commitmentId: input.commitmentId || undefined,
      externalId: input.externalId || undefined,
      batchId: input.batchId || undefined,
      batchCount: input.batchCount,
      memo: input.memo || undefined,
      createdAt,
      liquiditySource: input.liquiditySource || undefined,
      sourceChain: input.sourceChain || undefined,
      destinationChain: input.destinationChain || "Arc Testnet",
      bridgeUsed: input.bridgeUsed || undefined,
      bridgeTxHashes: input.bridgeTxHashes.length > 0 ? input.bridgeTxHashes : undefined,
      settlementNote: input.settlementNote || undefined,
      error: input.error || undefined,
    };

    ledger.payments.unshift(payment);
    createConfidentialRecordIfNeeded(ledger, payment);
    addAudit(
      ledger,
      payment.mode === "confidential"
        ? `${paymentOperationLabel(payment.operation)} recorded`
        : "Open payment recorded",
      payment.source,
      payment.txHash || payment.pendingReference || payment.id
    );

    return payment;
  });
}

export async function requestReveal(recordId: string) {
  await mutateLedger((ledger) => {
    const record = ledger.confidentialRecords.find((item) => item.id === recordId);
    if (!record) throw new Error("Closed payment record was not found.");

    record.disclosureStatus = "requested";
    addAudit(ledger, "Reveal requested", "current-user", recordId);
  });
}

export async function grantAccess(input: z.infer<typeof grantAccessSchema>) {
  return await mutateLedger((ledger) => {
    const record = ledger.confidentialRecords.find((item) => item.id === input.recordId);
    if (!record) throw new Error("Closed payment record was not found.");

    const grantedAt = nowIso();
    const expiresAt = input.durationDays
      ? new Date(Date.now() + input.durationDays * 86400e3).toISOString()
      : undefined;

    const access = {
      id: makeId("acc"),
      recordId: input.recordId,
      viewer: input.viewer,
      viewerLabel: input.viewer,
      grantedBy: "current-user",
      grantedAt,
      expiresAt,
      revoked: false,
    };

    ledger.disclosureAccess.unshift(access);
    record.disclosureStatus = "granted";
    record.authorizedViewers = Array.from(new Set([...record.authorizedViewers, input.viewer]));
    addAudit(ledger, "Access granted", "current-user", input.recordId);

    return access;
  });
}

export async function revokeAccess(accessId: string) {
  await mutateLedger((ledger) => {
    const access = ledger.disclosureAccess.find((item) => item.id === accessId);
    if (!access) throw new Error("Disclosure access grant was not found.");

    access.revoked = true;
    const activeForRecord = ledger.disclosureAccess.filter((item) => item.recordId === access.recordId && !item.revoked);
    const record = ledger.confidentialRecords.find((item) => item.id === access.recordId);
    if (record) {
      record.authorizedViewers = activeForRecord.map((item) => item.viewer);
      if (activeForRecord.length === 0) record.disclosureStatus = "revoked";
    }

    addAudit(ledger, "Access revoked", "current-user", accessId);
  });
}

export async function getActivity() {
  const ledger = await readLedger();
  const events = [
    ...ledger.payments.map((payment) => ({
      id: `evt_${payment.id}`,
      kind: payment.type === "batch" ? "batch" as const : "payment" as const,
      title: paymentActivityTitle(payment),
      description: payment.txHash || payment.pendingReference || payment.id,
      timestamp: payment.createdAt,
    })),
    ...ledger.confidentialRecords
      .filter((record) => record.disclosureStatus !== "private")
      .map((record) => ({
        id: `evt_rec_${record.id}`,
        kind: "disclosure" as const,
        title:
          record.disclosureStatus === "requested"
            ? "Closed record reveal requested"
            : record.disclosureStatus === "granted"
              ? "Closed record access granted"
              : "Closed record access updated",
        description: record.commitmentId,
        timestamp: record.createdAt,
      })),
    ...ledger.disclosureAccess.map((access) => ({
      id: `evt_acc_${access.id}`,
      kind: "access" as const,
      title: access.revoked ? "Access revoked" : "Access granted",
      description: access.viewerLabel || access.viewer,
      timestamp: access.grantedAt,
    })),
  ];

  return events.sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
}

export async function getDashboardStats() {
  const ledger = await readLedger();
  const today = new Date().toISOString().slice(0, 10);
  const within30d = (iso: string) => Date.now() - new Date(iso).getTime() <= 30 * 24 * 60 * 60 * 1000;

  const volume30d = ledger.payments
    .filter((payment) => within30d(payment.createdAt))
    .reduce((sum, payment) => sum + Number(payment.amount || "0"), 0);

  return {
    totalPayments: ledger.payments.length,
    openPayments: ledger.payments.filter((payment) => payment.mode === "open").length,
    confidentialPayments: ledger.payments.filter((payment) => payment.mode === "confidential").length,
    batchPayments: ledger.payments.filter((payment) => payment.type === "batch").length,
    pendingCount: ledger.payments.filter((payment) => payment.status === "pending_settlement" || payment.status === "pending_veilhub_registration").length,
    settledToday: ledger.payments.filter((payment) => payment.status === "settled" && payment.createdAt.slice(0, 10) === today).length,
    volume30d: volume30d.toFixed(4),
  };
}
