import { APP_API_BASE } from "@/lib/env";
import type {
  ActivityEvent,
  AuditEvent,
  ConfidentialRecord,
  DashboardStats,
  DisclosureAccess,
  Payment,
  PaymentMode,
  PaymentOperation,
  PaymentSourceKind,
} from "@/types/veil";

type ApiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

type PaymentWrite = {
  type: "single" | "batch";
  mode: PaymentMode;
  source: PaymentSourceKind;
  operation?: PaymentOperation;
  status: "settled" | "pending_settlement" | "pending_veilhub_registration" | "failed";
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
  amountBase: string;
  amountHidden?: boolean;
  token?: string;
  txHash?: string;
  pendingReference?: string;
  veilHubTxHash?: string;
  paymentId?: string;
  commitmentId?: string;
  externalId?: string;
  batchId?: string;
  batchCount?: number;
  memo?: string;
  liquiditySource?: string;
  sourceChain?: string;
  destinationChain?: string;
  bridgeUsed?: boolean;
  bridgeTxHashes?: string[];
  settlementNote?: string;
  error?: string;
};

type RequestOptions = {
  retries?: number;
};

function withWallet(path: string, wallet?: string) {
  if (!wallet) return path;
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}wallet=${encodeURIComponent(wallet)}`;
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T>(path: string, init?: RequestInit, options: RequestOptions = {}): Promise<T> {
  const retries = options.retries ?? 0;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    let response: Response;

    try {
      response = await fetch(`${APP_API_BASE}${path}`, {
        ...init,
        headers: {
          "content-type": "application/json",
          ...(init?.headers || {}),
        },
      });
    } catch (err) {
      const detail = err instanceof Error && err.message ? ` ${err.message}` : "";
      lastError = new Error(`Veilarc API is unavailable at ${APP_API_BASE}.${detail}`);

      if (attempt < retries) {
        await wait(300 * (attempt + 1));
        continue;
      }

      throw lastError;
    }

    const payload = (await response.json().catch(() => null)) as ApiEnvelope<T> | null;

    if (response.ok && payload?.ok) {
      return payload.data as T;
    }

    lastError = new Error(payload?.error || `Veilarc API request failed with HTTP ${response.status}.`);

    if (response.status >= 500 && attempt < retries) {
      await wait(300 * (attempt + 1));
      continue;
    }

    throw lastError;
  }

  throw lastError || new Error("Veilarc API request failed.");
}

export const veilApi = {
  listPayments(wallet?: string): Promise<Payment[]> {
    return request<Payment[]>(withWallet("/api/payments", wallet));
  },

  listConfidentialRecords(wallet?: string): Promise<ConfidentialRecord[]> {
    return request<ConfidentialRecord[]>(withWallet("/api/confidential-records", wallet));
  },

  listDisclosureAccess(wallet?: string): Promise<DisclosureAccess[]> {
    return request<DisclosureAccess[]>(withWallet("/api/disclosure-access", wallet));
  },

  listAuditTrail(wallet?: string): Promise<AuditEvent[]> {
    return request<AuditEvent[]>(withWallet("/api/audit-trail", wallet));
  },

  listActivity(wallet?: string): Promise<ActivityEvent[]> {
    return request<ActivityEvent[]>(withWallet("/api/activity", wallet));
  },

  getDashboardStats(wallet?: string): Promise<DashboardStats> {
    return request<DashboardStats>(withWallet("/api/dashboard", wallet));
  },

  recordPayment(input: PaymentWrite): Promise<Payment> {
    return request<Payment>("/api/payments", {
      method: "POST",
      body: JSON.stringify(input),
    }, { retries: 2 });
  },

  async requestReveal(recordId: string): Promise<void> {
    await request(`/api/confidential-records/${recordId}/reveal-request`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },

  grantAccess(input: { recordId: string; viewer: string; durationDays?: number }): Promise<DisclosureAccess> {
    return request<DisclosureAccess>("/api/disclosure-access", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  async revokeAccess(accessId: string): Promise<void> {
    await request(`/api/disclosure-access/${accessId}/revoke`, {
      method: "POST",
      body: JSON.stringify({}),
    });
  },
};
