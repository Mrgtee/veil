import { useMemo, useState } from "react";
import { Buffer } from "buffer";
import { isAddress, parseUnits } from "viem";
import { useAccount, useSwitchChain, useWriteContract } from "wagmi";
import { arcTestnet } from "@/lib/arc";
import { BATCH_PAYOUT_ADDRESS } from "@/lib/env";
import { batchPayoutAbi } from "@/lib/abi";
import { veilApi } from "@/services/veilApi";

type BatchMode = "open" | "confidential";
type LiquiditySource = "unified" | "arcDirect";

type BatchRow = {
  id: string;
  recipient: string;
  amount: string;
  recipientLabel: string;
  memo: string;
};

type RowResult = {
  rowId: string;
  recipientLabel: string;
  recipient: string;
  amount: string;
  status: "pending" | "processing" | "settled" | "needs_check" | "failed";
  txHash?: string;
  error?: string;
};

declare global {
  interface Window {
    ethereum?: any;
  }
}

let cachedKit: any = null;

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function formatBatchError(err: unknown, fallback = "Batch failed") {
  const message = getErrorMessage(err, fallback);

  if (message.includes("Transfer spec has already been used")) {
    return "This Unified Balance approval was already submitted or expired. Refresh the page, reload Unified Balance, and submit again to create a fresh wallet approval.";
  }

  if (
    message.includes("Mint failure") ||
    message.includes("eth_getBlockByNumber") ||
    message.includes("request timed out") ||
    message.includes("took too long")
  ) {
    return "Unified Balance spend could not finish because the Arc RPC timed out during final settlement. Refresh Unified Balance and try again. Arc Direct is still available.";
  }

  return message;
}

function getErrorMessage(err: unknown, fallback: string) {
  if (err instanceof Error && err.message) return err.message;

  if (typeof err === "object" && err !== null) {
    const anyErr = err as any;

    return (
      anyErr?.shortMessage ||
      anyErr?.details ||
      anyErr?.message ||
      anyErr?.cause?.shortMessage ||
      anyErr?.cause?.message ||
      fallback
    );
  }

  return fallback;
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(message));
    }, ms);

    promise
      .then((value) => {
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        window.clearTimeout(timer);
        reject(err);
      });
  });
}

function isTimeoutError(err: unknown) {
  return err instanceof Error && err.message.includes("still finalizing");
}

async function getCircleTools() {
  if (!(globalThis as any).Buffer) {
    (globalThis as any).Buffer = Buffer;
  }

  const appKitModule: any = await import("@circle-fin/app-kit");
  const adapterModule: any = await import("@circle-fin/adapter-viem-v2");

  const AppKit = appKitModule.AppKit;
  const createViemAdapterFromProvider = adapterModule.createViemAdapterFromProvider;

  if (!AppKit) {
    throw new Error("Circle AppKit failed to load in the browser.");
  }

  if (!createViemAdapterFromProvider) {
    throw new Error("Circle viem adapter failed to load in the browser.");
  }

  const kit = new AppKit();

  if (!kit.unifiedBalance) {
    throw new Error("Unified Balance is not available in the installed frontend AppKit package.");
  }

  return {
    kit,
    createViemAdapterFromProvider,
  };
}

async function requestWalletAccount() {
  if (!window.ethereum) {
    throw new Error("No wallet detected. Open Veil inside MetaMask, OKX Wallet, Rabby, Rainbow, or another EVM wallet browser.");
  }

  const accounts = await window.ethereum.request({ method: "eth_accounts" });
  let account = accounts?.[0];

  if (!account) {
    const requested = await window.ethereum.request({ method: "eth_requestAccounts" });
    account = requested?.[0];
  }

  if (!account) {
    throw new Error("Wallet connection failed.");
  }

  localStorage.setItem("veil.wallet", account);
  localStorage.setItem("veil.operator", account);

  return account;
}

async function getWalletAdapter() {
  await requestWalletAccount();

  const { createViemAdapterFromProvider } = await getCircleTools();

  return createViemAdapterFromProvider({
    provider: window.ethereum,
  });
}


function getFinalTxHash(result: any) {
  if (result?.txHash) return result.txHash;

  const steps = normalizeSteps(result);
  const hashes = steps.map((s: any) => s?.txHash).filter(Boolean);

  return hashes[hashes.length - 1] || "";
}

function getTxUrl(txHash: string) {
  return `https://testnet.arcscan.app/tx/${txHash}`;
}

function makeCommitmentId() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return `0x${Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;
}

function makeBytes32Id() {
  return makeCommitmentId();
}

function getUnifiedBalanceCacheKey(account?: string) {
  return `veil.unified.balance.${(account || "").toLowerCase()}`;
}

function saveUnifiedBalanceCache(account: string | undefined, balance: any) {
  if (!account || !balance) return;

  localStorage.setItem(getUnifiedBalanceCacheKey(account), JSON.stringify(balance));
  localStorage.setItem("veil.unified.balance.lastWallet", account);
}

async function refreshUnifiedBalanceCache(account?: string) {
  if (!account) return null;

  const { kit } = await getCircleTools();
  const adapter = await getWalletAdapter();

  const result = await kit.unifiedBalance.getBalances({
    sources: [{ adapter }],
    networkType: "testnet",
    includePending: true,
  });

  saveUnifiedBalanceCache(account, result);

  return result;
}

async function spendUnifiedBalanceToArc(input: {
  amount: string;
  recipientAddress: `0x${string}`;
}) {
  const { kit } = await getCircleTools();
  const adapter = await getWalletAdapter();

  return await kit.unifiedBalance.spend({
    amount: input.amount,
    token: "USDC",
    from: { adapter },
    to: {
      adapter,
      chain: "Arc_Testnet",
      recipientAddress: input.recipientAddress,
    },
  });
}

function validateRows(rows: BatchRow[]) {
  const cleanRows = rows
    .map((row) => ({
      ...row,
      recipient: row.recipient.trim(),
      amount: row.amount.trim(),
      recipientLabel: row.recipientLabel.trim(),
      memo: row.memo.trim(),
    }))
    .filter((row) => row.recipient || row.amount || row.recipientLabel || row.memo);

  if (cleanRows.length === 0) {
    throw new Error("Add at least one recipient before submitting.");
  }

  for (const [index, row] of cleanRows.entries()) {
    if (!isAddress(row.recipient)) {
      throw new Error(`Recipient ${index + 1} has an invalid wallet address.`);
    }

    if (!row.amount || Number(row.amount) <= 0) {
      throw new Error(`Recipient ${index + 1} has an invalid amount.`);
    }

    if (!row.recipientLabel) {
      throw new Error(`Recipient ${index + 1} needs a label or name.`);
    }
  }

  return cleanRows;
}

function formatTotal(rows: BatchRow[]) {
  const total = rows.reduce((sum, row) => {
    const n = Number(row.amount || "0");
    return Number.isFinite(n) ? sum + n : sum;
  }, 0);

  return total.toFixed(6).replace(/\.?0+$/, "") || "0";
}

function emptyRow(): BatchRow {
  return {
    id: makeId("row"),
    recipient: "",
    amount: "",
    recipientLabel: "",
    memo: "",
  };
}

export default function BatchPayments() {
  const { address, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [rows, setRows] = useState<BatchRow[]>([emptyRow()]);
  const [mode, setMode] = useState<BatchMode | null>(null);
  const [liquiditySource, setLiquiditySource] = useState<LiquiditySource | null>(null);
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [batchId, setBatchId] = useState("");
  const [results, setResults] = useState<RowResult[]>([]);

  const totalAmount = useMemo(() => formatTotal(rows), [rows]);
  const filledRows = useMemo(
    () => rows.filter((row) => row.recipient || row.amount || row.recipientLabel || row.memo).length,
    [rows]
  );

  function updateRow(id: string, field: keyof BatchRow, value: string) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  }

  function addRow() {
    setRows((current) => [...current, emptyRow()]);
  }

  function removeRow(id: string) {
    setRows((current) => {
      if (current.length === 1) return current;
      return current.filter((row) => row.id !== id);
    });
  }

  function getActiveUnifiedSources() {
    const cachedRaw = localStorage.getItem(`veil.unified.balance.${(address || "").toLowerCase()}`);

    if (!cachedRaw) return [];

    try {
      const cached = JSON.parse(cachedRaw);
      const rows: Array<{ chain: string; confirmed: string; pending: string }> = [];

      for (const depositor of cached?.breakdown ?? []) {
        for (const item of depositor?.breakdown ?? []) {
          const confirmed = item.confirmedBalance ?? "0.000000";
          const pending = item.pendingBalance ?? "0.000000";

          if (confirmed !== "0.000000" || pending !== "0.000000") {
            rows.push({
              chain: item.chain,
              confirmed,
              pending,
            });
          }
        }
      }

      return rows;
    } catch {
      return [];
    }
  }

  function setRowResult(rowId: string, patch: Partial<RowResult>) {
    setResults((current) =>
      current.map((item) => (item.rowId === rowId ? { ...item, ...patch } : item))
    );
  }

  async function submitArcDirectBatch(cleanRows: BatchRow[], nextBatchId: string, batchCommitment?: string) {
    if (chainId !== arcTestnet.id) {
      setStatus("Switching wallet to Arc Testnet...");
      await switchChainAsync({ chainId: arcTestnet.id });
    }

    const recipients = cleanRows.map((row) => row.recipient as `0x${string}`);
    const amounts = cleanRows.map((row) => parseUnits(row.amount, 18));
    const total = amounts.reduce((sum, value) => sum + value, 0n);

    setResults(
      cleanRows.map((row) => ({
        rowId: row.id,
        recipientLabel: row.recipientLabel,
        recipient: row.recipient,
        amount: row.amount,
        status: "processing",
      }))
    );

    setStatus("Submitting Arc Direct batch transaction. Confirm in wallet, then wait for Arc settlement...");

    const hash =
      mode === "open"
        ? await writeContractAsync({
            address: BATCH_PAYOUT_ADDRESS,
            abi: batchPayoutAbi,
            functionName: "payBatchOpen",
            args: [recipients, amounts, nextBatchId],
            value: total,
            chainId: arcTestnet.id,
          })
        : await writeContractAsync({
            address: BATCH_PAYOUT_ADDRESS,
            abi: batchPayoutAbi,
            functionName: "payBatchConfidential",
            args: [recipients, amounts, batchCommitment, nextBatchId],
            value: total,
            chainId: arcTestnet.id,
          });

    setResults(
      cleanRows.map((row) => ({
        rowId: row.id,
        recipientLabel: row.recipientLabel,
        recipient: row.recipient,
        amount: row.amount,
        status: "settled",
        txHash: hash,
      }))
    );

    await veilApi.recordBatchPayment({
      mode: mode as BatchMode,
      rows: cleanRows.map((row) => ({
        recipient: row.recipient,
        amount: parseUnits(row.amount, 18).toString(),
        memo: row.memo,
        recipientLabel: row.recipientLabel,
      })),
      txHash: hash,
      batchId: nextBatchId,
      batchCommitment,
    });

    setStatus(`${mode === "confidential" ? "Private" : "Open"} Arc Direct batch submitted.`);
  }

  async function submitBatch() {
    try {
      setLoading(true);
      setStatus("");
      setResults([]);
      setBatchId("");

      if (!isConnected || !address) {
        throw new Error("Wallet is not connected in the app. Please sign in again.");
      }

      if (!mode) {
        throw new Error("Choose Open Batch or Private Batch before submitting.");
      }

      if (!liquiditySource) {
        throw new Error("Choose Unified Balance USDC or Arc Direct before submitting.");
      }

      const cleanRows = validateRows(rows);
      const nextBatchId = makeBytes32Id();
      const batchCommitment = mode === "confidential" ? makeCommitmentId() : undefined;

      setBatchId(nextBatchId);

      if (liquiditySource === "arcDirect") {
        await submitArcDirectBatch(cleanRows, nextBatchId, batchCommitment);
        return;
      }

      const initialResults: RowResult[] = cleanRows.map((row) => ({
        rowId: row.id,
        recipientLabel: row.recipientLabel,
        recipient: row.recipient,
        amount: row.amount,
        status: "pending",
      }));

      setResults(initialResults);

      const settledResults: RowResult[] = [];

      for (let i = 0; i < cleanRows.length; i += 1) {
        const row = cleanRows[i];

        setStatus(
          `Processing recipient ${i + 1}/${cleanRows.length}. Approve in wallet, then keep this page open while Unified Balance finalizes settlement.`
        );

        setRowResult(row.id, { status: "processing" });

        try {
          const result = await spendUnifiedBalanceToArc({
            amount: row.amount,
            recipientAddress: row.recipient as `0x${string}`,
          });

          const txHash = getFinalTxHash(result);

          const settled: RowResult = {
            rowId: row.id,
            recipientLabel: row.recipientLabel,
            recipient: row.recipient,
            amount: row.amount,
            status: "settled",
            txHash,
          };

          settledResults.push(settled);
          setRowResult(row.id, settled);
        } catch (err) {
          const message = getErrorMessage(err, `Recipient ${i + 1} failed`);

          if (isTimeoutError(err)) {
            setRowResult(row.id, {
              status: "needs_check",
              error: message,
            });

            setStatus(message);

            try {
              await refreshUnifiedBalanceCache(address);
            } catch {
              // best effort
            }

            return;
          }

          setRowResult(row.id, {
            status: "failed",
            error: message,
          });

          throw new Error(message);
        }
      }

      await veilApi.recordBatchPayment({
        mode,
        rows: cleanRows.map((row) => ({
          recipient: row.recipient,
          amount: parseUnits(row.amount, 18).toString(),
          memo: row.memo,
          recipientLabel: row.recipientLabel,
        })),
        txHash: settledResults.map((item) => item.txHash).filter(Boolean).join(","),
        batchId: nextBatchId,
        batchCommitment,
      });

      await refreshUnifiedBalanceCache(address);

      setStatus(
        `${mode === "confidential" ? "Private" : "Open"} Unified Balance batch completed. ${cleanRows.length} recipients paid.`
      );
    } catch (err) {
      setStatus(formatBatchError(err, "Batch failed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Batch Payments</h1>
        <p className="text-sm text-muted-foreground">
          Send open or private batch payments from Unified Balance USDC or directly from your Arc wallet.
        </p>
      </div>

      <div className="rounded-xl border p-5 space-y-4 bg-secondary/30">
        <div className="font-medium">Unified Balance batch flow</div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Add recipients, choose payment mode, choose liquidity source, then Veil completes the batch.
          Private batches also create protected payment records.
        </p>

        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border p-3 bg-background">
            <div className="font-medium">1. Add recipients</div>
            <p className="text-muted-foreground mt-1">
              Enter wallet address, amount, label, and memo.
            </p>
          </div>

          <div className="rounded-lg border p-3 bg-background">
            <div className="font-medium">2. Choose mode</div>
            <p className="text-muted-foreground mt-1">
              Select Open Batch or Private Batch.
            </p>
          </div>

          <div className="rounded-lg border p-3 bg-background">
            <div className="font-medium">3. Submit</div>
            <p className="text-muted-foreground mt-1">
              Veil records the batch after settlement.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Recipients</h2>
            <p className="text-sm text-muted-foreground">
              Add one or more Arc recipients for this batch.
            </p>
          </div>

          <div className="rounded-lg border px-3 py-2 text-sm bg-background">
            <div><strong>Recipients:</strong> {filledRows}</div>
            <div><strong>Total:</strong> {totalAmount} USDC</div>
          </div>
        </div>

        <div className="space-y-4">
          {rows.map((row, index) => (
            <div key={row.id} className="rounded-xl border p-4 space-y-3 bg-background">
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium">Recipient {index + 1}</div>

                {rows.length > 1 && (
                  <button
                    className="px-3 py-1.5 rounded-lg border text-sm"
                    onClick={() => removeRow(row.id)}
                    disabled={loading}
                  >
                    Remove
                  </button>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <input
                  className="border rounded-lg px-3 py-2 w-full"
                  placeholder="Recipient wallet address"
                  value={row.recipient}
                  onChange={(e) => updateRow(row.id, "recipient", e.target.value)}
                  disabled={loading}
                />

                <input
                  className="border rounded-lg px-3 py-2 w-full"
                  placeholder="Amount in USDC"
                  value={row.amount}
                  onChange={(e) => updateRow(row.id, "amount", e.target.value)}
                  disabled={loading}
                />

                <input
                  className="border rounded-lg px-3 py-2 w-full"
                  placeholder="Recipient label, e.g. Alice"
                  value={row.recipientLabel}
                  onChange={(e) => updateRow(row.id, "recipientLabel", e.target.value)}
                  disabled={loading}
                />

                <input
                  className="border rounded-lg px-3 py-2 w-full"
                  placeholder="Memo / reference"
                  value={row.memo}
                  onChange={(e) => updateRow(row.id, "memo", e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
          ))}
        </div>

        <button
          className="px-4 py-2 rounded-lg border"
          onClick={addRow}
          disabled={loading}
        >
          Add recipient
        </button>

        <div className="flex gap-2 flex-wrap">
          <button
            className={`px-4 py-2 rounded-lg border ${mode === "open" ? "bg-primary text-primary-foreground" : ""}`}
            onClick={() => setMode("open")}
            disabled={loading}
          >
            Open Batch
          </button>

          <button
            className={`px-4 py-2 rounded-lg border ${mode === "confidential" ? "bg-primary text-primary-foreground" : ""}`}
            onClick={() => setMode("confidential")}
            disabled={loading}
          >
            Private Batch
          </button>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Liquidity source</div>

          <div className="grid sm:grid-cols-2 gap-3">
            <button
              className={`rounded-xl border p-4 text-left ${
                liquiditySource === "unified" ? "bg-primary text-primary-foreground" : "bg-background"
              }`}
              onClick={() => setLiquiditySource("unified")}
              disabled={loading}
            >
              <div className="font-medium">Unified Balance USDC</div>
              <div
                className={`text-sm mt-1 ${
                  liquiditySource === "unified" ? "text-primary-foreground/80" : "text-muted-foreground"
                }`}
              >
                Spend from confirmed Unified Balance.
              </div>
            </button>

            <button
              className={`rounded-xl border p-4 text-left ${
                liquiditySource === "arcDirect" ? "bg-primary text-primary-foreground" : "bg-background"
              }`}
              onClick={() => setLiquiditySource("arcDirect")}
              disabled={loading}
            >
              <div className="font-medium">Arc Direct</div>
              <div
                className={`text-sm mt-1 ${
                  liquiditySource === "arcDirect" ? "text-primary-foreground/80" : "text-muted-foreground"
                }`}
              >
                Send directly from connected Arc wallet.
              </div>
            </button>
          </div>
        </div>

        <button
          className="px-4 py-2 rounded-lg border"
          onClick={submitBatch}
          disabled={loading}
        >
          {loading ? "Processing batch..." : "Submit Batch"}
        </button>

        {status && (
          <div className="rounded-lg border p-3 text-sm">
            {status}
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="rounded-xl border p-5 space-y-4">
          <div>
            <h2 className="text-lg font-medium">Batch progress</h2>
            <p className="text-sm text-muted-foreground">
              {batchId ? `Batch ID: ${batchId}` : "Recipient settlement status."}
            </p>
          </div>

          <div className="space-y-3">
            {results.map((item, index) => (
              <div key={item.rowId} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {index + 1}. {item.recipientLabel}
                    </div>
                    <div className="text-muted-foreground break-all">
                      {item.amount} USDC · {item.recipient}
                    </div>
                  </div>

                  <div className="text-xs rounded-md border px-2 py-1 w-fit capitalize">
                    {item.status === "needs_check" ? "Check status" : item.status}
                  </div>
                </div>

                {item.txHash && (
                  <a
                    className="underline block mt-2 break-all"
                    href={getTxUrl(item.txHash)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View transaction
                  </a>
                )}

                {item.error && (
                  <div className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 p-2 text-destructive">
                    {item.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
