import { APP_API_BASE } from "@/lib/env";
import type {
  ActivityEvent,
  AuditEvent,
  ConfidentialRecord,
  DashboardStats,
  DisclosureAccess,
  Payment,
  PaymentMode,
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
  status: "settled" | "pending_settlement" | "pending_veilhub_registration" | "failed";
  recipient: string;
  recipientLabel?: string;
  amount: string;
  amountBase: string;
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
      lastError = new Error(`Veil API is unavailable at ${APP_API_BASE}.${detail}`);

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

    lastError = new Error(payload?.error || `Veil API request failed with HTTP ${response.status}.`);

    if (response.status >= 500 && attempt < retries) {
      await wait(300 * (attempt + 1));
      continue;
    }

    throw lastError;
  }

  throw lastError || new Error("Veil API request failed.");
}

export const veilApi = {
  listPayments(): Promise<Payment[]> {
    return request<Payment[]>("/api/payments");
  },

  listConfidentialRecords(): Promise<ConfidentialRecord[]> {
    return request<ConfidentialRecord[]>("/api/confidential-records");
  },

  listDisclosureAccess(): Promise<DisclosureAccess[]> {
    return request<DisclosureAccess[]>("/api/disclosure-access");
  },

  listAuditTrail(): Promise<AuditEvent[]> {
    return request<AuditEvent[]>("/api/audit-trail");
  },

  listActivity(): Promise<ActivityEvent[]> {
    return request<ActivityEvent[]>("/api/activity");
  },

  getDashboardStats(): Promise<DashboardStats> {
    return request<DashboardStats>("/api/dashboard");
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
