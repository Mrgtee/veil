import "dotenv/config";
import express from "express";
import cors from "cors";
import crypto from "crypto";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import { v4 as uuidv4 } from "uuid";
import { bridgeEthSepoliaToArcTestnet, bridgeArcTestnetToEthSepolia } from "./circle/bridge.js";
import { getUnifiedBalance, spendUnifiedBalanceToArc } from "./unified/service.js";

const app = express();
app.use(cors({ origin: true }));
app.use(express.json({ limit: "2mb" }));

const PORT = Number(process.env.PORT || 8787);
const KEY = Buffer.from(process.env.ENCRYPTION_KEY_HEX || "", "hex");

if (KEY.length !== 32) {
  throw new Error("ENCRYPTION_KEY_HEX must be 32 bytes in hex");
}

function encryptJson(payload: unknown) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const plaintext = Buffer.from(JSON.stringify(payload), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    ciphertext: encrypted.toString("hex")
  };
}

function sha256Hex(input: string) {
  return "0x" + crypto.createHash("sha256").update(input).digest("hex");
}

function toJsonSafe<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, v) => (typeof v === "bigint" ? v.toString() : v))
  );
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "veil-api" });
});


app.get("/api/unified/health", (_req, res) => {
  res.json({
    ok: true,
    service: "veil-unified-balance",
    model: "browser wallet deposit -> user-owned unified balance -> browser wallet spend to Arc",
    status: "frontend-wallet-required"
  });
});

app.get("/api/config", (_req, res) => {
  res.json({
    ok: true,
    network: {
      name: "Arc Testnet",
      chainId: 5042002,
      rpcUrl: "https://rpc.testnet.arc.network",
      explorer: "https://testnet.arcscan.app"
    }
  });
});

const singleSchema = z.object({
  recipient: z.string().min(42),
  amount: z.string().min(1),
  memo: z.string().optional().default(""),
  recipientLabel: z.string().optional().default(""),
  mode: z.enum(["open", "confidential"])
});

app.post("/api/confidential/payment-intent", (req, res) => {
  const body = singleSchema.parse(req.body);
  const externalId = uuidv4();

  const encrypted = encryptJson({
    recipient: body.recipient,
    amount: body.amount,
    memo: body.memo,
    recipientLabel: body.recipientLabel,
    createdAt: new Date().toISOString(),
    externalId
  });

  const commitmentId = sha256Hex(
    [body.recipient, body.amount, body.memo, body.recipientLabel, encrypted.ciphertext, externalId].join("|")
  );

  res.json({
    ok: true,
    mode: body.mode,
    externalId,
    commitmentId,
    encrypted
  });
});

const batchSchema = z.object({
  csv: z.string().min(1),
  mode: z.enum(["open", "confidential"])
});

app.post("/api/batch/prepare", (req, res) => {
  const body = batchSchema.parse(req.body);

  const rows = parse(body.csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as Array<Record<string, string>>;

  const normalized = rows.map((row, i) => {
    const recipient = row.recipient || row.address || "";
    const amount = row.amount || "";
    if (!recipient || !amount) {
      throw new Error(`Invalid row at index ${i + 1}`);
    }
    return {
      recipient,
      amount,
      memo: row.memo || "",
      recipientLabel: row.recipientLabel || row.label || ""
    };
  });

  const total = normalized.reduce((sum, row) => sum + BigInt(row.amount), 0n);
  const batchId = sha256Hex(JSON.stringify(normalized) + Date.now().toString());

  let batchCommitment = "0x" + "0".repeat(64);
  let encrypted = null;

  if (body.mode === "confidential") {
    encrypted = encryptJson({
      rows: normalized,
      createdAt: new Date().toISOString(),
      batchId
    });
    batchCommitment = sha256Hex(encrypted.ciphertext + batchId);
  }

  res.json({
    ok: true,
    mode: body.mode,
    batchId,
    batchCommitment,
    count: normalized.length,
    total: total.toString(),
    rows: normalized,
    encrypted
  });
});

const bridgeSchema = z.object({
  route: z.enum(["eth-to-arc", "arc-to-eth"]),
  amount: z.string().min(1),
  mode: z.enum(["open", "confidential"]).default("open"),
  memo: z.string().optional().default(""),
  recipientLabel: z.string().optional().default("")
});

app.post("/api/bridge/execute", async (req, res) => {
  res.status(410).json({
    ok: false,
    error:
      "Managed bridge execution is retired for user-facing Veil flows. Use the browser wallet Unified Balance deposit flow instead."
  });
});


app.get("/api/unified/balance", async (_req, res) => {
  res.status(410).json({
    ok: false,
    error:
      "Backend-managed Unified Balance reads are disabled for user-facing flows. Read balances in the browser from the connected wallet."
  });
});

const unifiedSpendSchema = z.object({
  amount: z.string().min(1),
  recipientAddress: z.string().min(42),
  mode: z.enum(["open", "confidential"]).default("open"),
  memo: z.string().optional().default(""),
  recipientLabel: z.string().optional().default("")
});

app.post("/api/unified/spend", async (req, res) => {
  res.status(410).json({
    ok: false,
    error:
      "Backend-managed Unified Balance spend is disabled for user-facing flows. Spend in the browser with the connected wallet."
  });
});


app.listen(PORT, () => {
  console.log(`Veil API listening on :${PORT}`);
});
