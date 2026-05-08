import "dotenv/config";
import express from "express";
import cors from "cors";
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
} from "./ledger.js";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.PORT || 8787);

function sendOk<T>(res: express.Response, data: T) {
  res.json({ ok: true, data });
}

function getErrorMessage(err: unknown) {
  if (err instanceof ZodError) {
    return err.issues.map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`).join("; ");
  }

  if (err instanceof Error && err.message) return err.message;
  return "Veil API request failed.";
}

function asyncRoute(handler: (req: express.Request, res: express.Response) => Promise<void>) {
  return (req: express.Request, res: express.Response) => {
    handler(req, res).catch((err) => {
      res.status(400).json({ ok: false, error: getErrorMessage(err) });
    });
  };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "veil-api" });
});

app.get("/api/unified/health", (_req, res) => {
  res.json({
    ok: true,
    service: "veil-unified-balance",
    model: "browser wallet deposit -> user-owned unified balance -> browser wallet spend to Arc",
    status: "frontend-wallet-required",
  });
});

app.get("/api/config", (_req, res) => {
  res.json({
    ok: true,
    network: {
      name: "Arc Testnet",
      chainId: Number(process.env.VITE_ARC_CHAIN_ID || 5042002),
      rpcUrl: process.env.VITE_ARC_RPC_URL || "https://rpc.testnet.arc.network",
      explorer: "https://testnet.arcscan.app",
    },
    ledger: {
      model: "temporary-testnet-json-ledger",
      productionDirection: "database/indexer with VeilHub indexing and Arc Private Kit integration",
    },
  });
});

app.get("/api/payments", asyncRoute(async (_req, res) => {
  sendOk(res, await getPayments());
}));

app.post("/api/payments", asyncRoute(async (req, res) => {
  const body = createPaymentSchema.parse(req.body);
  sendOk(res, await createPayment(body));
}));

app.get("/api/dashboard", asyncRoute(async (_req, res) => {
  sendOk(res, await getDashboardStats());
}));

app.get("/api/activity", asyncRoute(async (_req, res) => {
  sendOk(res, await getActivity());
}));

app.get("/api/confidential-records", asyncRoute(async (_req, res) => {
  sendOk(res, await getConfidentialRecords());
}));

app.post("/api/confidential-records/:id/reveal-request", asyncRoute(async (req, res) => {
  const id = String(req.params.id);
  await requestReveal(id);
  sendOk(res, { id });
}));

app.get("/api/disclosure-access", asyncRoute(async (_req, res) => {
  sendOk(res, await getDisclosureAccess());
}));

app.post("/api/disclosure-access", asyncRoute(async (req, res) => {
  const body = grantAccessSchema.parse(req.body);
  sendOk(res, await grantAccess(body));
}));

app.post("/api/disclosure-access/:id/revoke", asyncRoute(async (req, res) => {
  const id = String(req.params.id);
  await revokeAccess(id);
  sendOk(res, { id });
}));

app.get("/api/audit-trail", asyncRoute(async (_req, res) => {
  sendOk(res, await getAuditTrail());
}));

app.post("/api/confidential/payment-intent", (_req, res) => {
  res.status(410).json({
    ok: false,
    error:
      "Private Payment settlement is coming soon with Arc Private Kit. Visible Arc transfers are not accepted as private payments.",
  });
});

app.post("/api/batch/prepare", (_req, res) => {
  res.status(410).json({
    ok: false,
    error:
      "Server-side CSV batch preparation is retired. Use the form-based Batch Payments flow with connected-wallet settlement.",
  });
});

app.post("/api/bridge/execute", (_req, res) => {
  res.status(410).json({
    ok: false,
    error:
      "Managed bridge execution is retired for user-facing Veil flows. Use the browser wallet Unified Balance deposit flow instead.",
  });
});

app.get("/api/unified/balance", (_req, res) => {
  res.status(410).json({
    ok: false,
    error:
      "Backend-managed Unified Balance reads are disabled for user-facing flows. Read balances in the browser from the connected wallet.",
  });
});

app.post("/api/unified/spend", (_req, res) => {
  res.status(410).json({
    ok: false,
    error:
      "Backend-managed Unified Balance spend is disabled for user-facing flows. Spend in the browser with the connected wallet.",
  });
});

app.use((_req, res) => {
  res.status(404).json({ ok: false, error: "Veil API route not found." });
});

app.listen(PORT, () => {
  console.log(`Veil API listening on :${PORT}`);
});
