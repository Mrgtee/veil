import { ZodError } from "zod";
import {
  createPayment,
  createPaymentSchema,
  getActivity,
  getAuditTrail,
  getConfidentialRecords,
  getDashboardStats,
  getDisclosureAccess,
  getPayments,
  grantAccess,
  grantAccessSchema,
  requestReveal,
  revokeAccess,
} from "../apps/api/src/ledger.js";

type QueryValue = string | string[] | undefined;

type ServerlessRequest = {
  method?: string;
  url?: string;
  query?: Record<string, QueryValue>;
  body?: unknown;
};

type ServerlessResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): ServerlessResponse;
  json(payload: unknown): void;
  end(): void;
};

function sendOk(res: ServerlessResponse, data: unknown) {
  res.status(200).json({ ok: true, data });
}

function getErrorMessage(err: unknown) {
  if (err instanceof ZodError) {
    return err.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ");
  }

  if (err instanceof Error && err.message) return err.message;
  return "Veil API request failed.";
}

function getQueryValue(value: QueryValue) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function getRequestPath(req: ServerlessRequest, parsedUrl: URL) {
  const path = req.query?.path;
  if (Array.isArray(path) && path.length > 0) return `/api/${path.join("/")}`;
  if (typeof path === "string" && path.trim()) return `/api/${path.trim()}`;
  return parsedUrl.pathname;
}

function getWalletFilter(req: ServerlessRequest, parsedUrl: URL) {
  const wallet = parsedUrl.searchParams.get("wallet") || getQueryValue(req.query?.wallet);
  return typeof wallet === "string" && wallet.trim() ? wallet.trim() : undefined;
}

async function getBody(req: ServerlessRequest) {
  if (typeof req.body === "string") {
    return req.body.trim() ? JSON.parse(req.body) : {};
  }

  return req.body || {};
}

function sendRetired(res: ServerlessResponse, error: string) {
  res.status(410).json({ ok: false, error });
}

export default async function handler(req: ServerlessRequest, res: ServerlessResponse) {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET,POST,OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const parsedUrl = new URL(req.url || "/", "https://veil.local");
  const path = getRequestPath(req, parsedUrl).replace(/\/$/, "");
  const method = String(req.method || "GET").toUpperCase();

  try {
    if (method === "GET" && (path === "/api/health" || path === "/health")) {
      sendOk(res, { service: "veil-api" });
      return;
    }

    if (method === "GET" && path === "/api/unified/health") {
      sendOk(res, {
        service: "veil-unified-balance",
        model: "browser wallet deposit -> user-owned unified balance -> browser wallet spend to Arc",
        status: "frontend-wallet-required",
      });
      return;
    }

    if (method === "GET" && path === "/api/config") {
      sendOk(res, {
        network: {
          name: "Arc Testnet",
          chainId: Number(process.env.VITE_ARC_CHAIN_ID || 5042002),
          rpcUrl: process.env.VITE_ARC_RPC_URL || "https://rpc.testnet.arc.network",
          explorer: "https://testnet.arcscan.app",
        },
        ledger: {
          model: process.env.VERCEL ? "temporary-vercel-preview-json-ledger" : "temporary-testnet-json-ledger",
          productionDirection: "database/indexer with VeilHub indexing and Arc Private Kit integration",
        },
      });
      return;
    }

    if (method === "GET" && path === "/api/payments") {
      sendOk(res, await getPayments(getWalletFilter(req, parsedUrl)));
      return;
    }

    if (method === "POST" && path === "/api/payments") {
      const body = createPaymentSchema.parse(await getBody(req));
      sendOk(res, await createPayment(body));
      return;
    }

    if (method === "GET" && path === "/api/dashboard") {
      sendOk(res, await getDashboardStats(getWalletFilter(req, parsedUrl)));
      return;
    }

    if (method === "GET" && path === "/api/activity") {
      sendOk(res, await getActivity(getWalletFilter(req, parsedUrl)));
      return;
    }

    if (method === "GET" && path === "/api/confidential-records") {
      sendOk(res, await getConfidentialRecords(getWalletFilter(req, parsedUrl)));
      return;
    }

    const revealMatch = path.match(/^\/api\/confidential-records\/([^/]+)\/reveal-request$/);
    if (method === "POST" && revealMatch) {
      await requestReveal(decodeURIComponent(revealMatch[1]));
      sendOk(res, { id: decodeURIComponent(revealMatch[1]) });
      return;
    }

    if (method === "GET" && path === "/api/disclosure-access") {
      sendOk(res, await getDisclosureAccess(getWalletFilter(req, parsedUrl)));
      return;
    }

    if (method === "POST" && path === "/api/disclosure-access") {
      const body = grantAccessSchema.parse(await getBody(req));
      sendOk(res, await grantAccess(body));
      return;
    }

    const revokeMatch = path.match(/^\/api\/disclosure-access\/([^/]+)\/revoke$/);
    if (method === "POST" && revokeMatch) {
      await revokeAccess(decodeURIComponent(revokeMatch[1]));
      sendOk(res, { id: decodeURIComponent(revokeMatch[1]) });
      return;
    }

    if (method === "GET" && (path === "/api/audit-trail" || path === "/api/audit")) {
      sendOk(res, await getAuditTrail(getWalletFilter(req, parsedUrl)));
      return;
    }

    if (method === "POST" && path === "/api/confidential/payment-intent") {
      sendRetired(
        res,
        "Private Payment settlement is coming soon with Arc Private Kit. Visible Arc transfers are not accepted as private payments.",
      );
      return;
    }

    if (method === "POST" && path === "/api/batch/prepare") {
      sendRetired(res, "Server-side CSV batch preparation is retired. Use the form-based Batch Payments flow with connected-wallet settlement.");
      return;
    }

    if (method === "POST" && path === "/api/bridge/execute") {
      sendRetired(
        res,
        "Managed bridge execution is retired for user-facing Veil flows. Use the browser wallet Unified Balance deposit flow instead.",
      );
      return;
    }

    if (method === "GET" && path === "/api/unified/balance") {
      sendRetired(
        res,
        "Backend-managed Unified Balance reads are disabled for user-facing flows. Read balances in the browser from the connected wallet.",
      );
      return;
    }

    if (method === "POST" && path === "/api/unified/spend") {
      sendRetired(
        res,
        "Backend-managed Unified Balance spend is disabled for user-facing flows. Spend in the browser with the connected wallet.",
      );
      return;
    }

    res.status(404).json({ ok: false, error: "Veil API route not found." });
  } catch (err) {
    res.status(400).json({ ok: false, error: getErrorMessage(err) });
  }
}
