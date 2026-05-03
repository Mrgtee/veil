import { useEffect, useMemo, useState } from "react";
import { Buffer } from "buffer";

type PaymentMode = "open" | "confidential";
type LiquiditySource = "arc-direct" | "unified-balance";

const API_BASE = "http://38.49.216.82";

const ARC_TESTNET = {
  chainIdHex: "0x4CEF52",
  chainIdDecimal: 5042002,
  chainName: "Arc Testnet",
  rpcUrl: "https://rpc.drpc.testnet.arc.network",
  explorer: "https://testnet.arcscan.app/tx/",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
};

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function parseUnits18(value: string) {
  const clean = value.trim();

  if (!clean || Number(clean) <= 0) {
    throw new Error("Enter a valid amount");
  }

  const [whole, fraction = ""] = clean.split(".");
  const paddedFraction = fraction.padEnd(18, "0").slice(0, 18);
  return BigInt(whole || "0") * 10n ** 18n + BigInt(paddedFraction || "0");
}

function shortAddress(address: string) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function getExplorerUrl(txHash: string) {
  return `${ARC_TESTNET.explorer}${txHash}`;
}

function formatPaymentError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err || "Payment failed");

  if (message.includes("Transfer spec has already been used")) {
    return "This Unified Balance approval was already submitted or expired. Refresh the page, reload Unified Balance, and submit again to create a fresh wallet approval.";
  }

  if (
    message.includes("Mint failure") ||
    message.includes("eth_getBlockByNumber") ||
    message.includes("request timed out") ||
    message.includes("took too long")
  ) {
    return "Unified Balance spend could not finish because the Arc RPC timed out during final settlement. Your balance was not deducted. Refresh Unified Balance and try again.";
  }

  return message || "Payment failed";
}

function getTxHashesFromUnifiedResult(result: any): string[] {
  const steps = Array.isArray(result?.steps)
    ? result.steps
    : Array.isArray(result?.result?.steps)
      ? result.result.steps
      : [];

  return steps.map((step: any) => step?.txHash).filter(Boolean);
}

function getFinalTxHashFromUnifiedResult(result: any): string {
  const hashes = getTxHashesFromUnifiedResult(result);
  return hashes[hashes.length - 1] || "";
}

let cachedKit: any = null;

function getUnifiedBalanceCacheKey(account?: string) {
  return `veil.unified.balance.${(account || "").toLowerCase()}`;
}

function saveUnifiedBalanceCache(account: string | undefined, balance: any) {
  if (!account || !balance) return;

  localStorage.setItem(getUnifiedBalanceCacheKey(account), JSON.stringify(balance));
  localStorage.setItem("veil.unified.balance.lastWallet", account);
}

function readUnifiedBalanceCache(account: string | undefined) {
  if (!account) return null;

  try {
    const raw = localStorage.getItem(getUnifiedBalanceCacheKey(account));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
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
  const eth = (window as any).ethereum;

  if (!eth) {
    throw new Error("No wallet found. Open this page in a wallet-enabled browser.");
  }

  const accounts = await eth.request({ method: "eth_accounts" });
  let account = accounts?.[0];

  if (!account) {
    const requested = await eth.request({ method: "eth_requestAccounts" });
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
    provider: (window as any).ethereum,
  });
}


async function ensureArcTestnet() {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No wallet found. Open this page in a wallet-enabled browser.");

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_TESTNET.chainIdHex }],
    });
  } catch (err: any) {
    if (err?.code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: ARC_TESTNET.chainIdHex,
            chainName: ARC_TESTNET.chainName,
            rpcUrls: [ARC_TESTNET.rpcUrl, "https://rpc.quicknode.testnet.arc.network", "https://rpc.blockdaemon.testnet.arc.network", "https://rpc.testnet.arc.network"],
            nativeCurrency: ARC_TESTNET.nativeCurrency,
            blockExplorerUrls: ["https://testnet.arcscan.app"],
          },
        ],
      });
      return;
    }

    throw err;
  }
}

export default function NewPayment() {
  const [account, setAccount] = useState("");
  const [mode, setMode] = useState<PaymentMode | "">("");
  const [liquiditySource, setLiquiditySource] = useState<LiquiditySource | "">("");

  const [recipient, setRecipient] = useState("");
  const [recipientLabel, setRecipientLabel] = useState("");
  const [amount, setAmount] = useState("0.05");
  const [memo, setMemo] = useState("");

  const [status, setStatus] = useState("");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const [unifiedBalance, setUnifiedBalance] = useState<any>(null);
  const [balanceStatus, setBalanceStatus] = useState("");

  async function loadUnifiedBalance() {
    try {
      const owner = account || (await requestWalletAccount());

      setAccount(owner);

      const cached = readUnifiedBalanceCache(owner);
      if (cached) {
        setUnifiedBalance(cached);
        setBalanceStatus("Cached Unified Balance loaded. Refreshing latest balance...");
      } else {
        setBalanceStatus("Loading Unified Balance...");
      }

      const { kit } = await getCircleTools();
      const adapter = await getWalletAdapter();

      const balance = await kit.unifiedBalance.getBalances({
        sources: [{ adapter }],
        networkType: "testnet",
        includePending: true,
      });

      setUnifiedBalance(balance);
      saveUnifiedBalanceCache(owner, balance);
      setBalanceStatus("Unified Balance loaded");
    } catch (err) {
      setBalanceStatus(err instanceof Error ? err.message : "Unable to load Unified Balance");
    }
  }

  function getConfirmedUnifiedBalance(): number {
    return Number(unifiedBalance?.totalConfirmedBalance || "0");
  }

  function getPendingUnifiedBalance(): number {
    return Number(unifiedBalance?.totalPendingBalance || "0");
  }

  function getActiveUnifiedSources() {
    const rows: Array<{ chain: string; confirmed: string; pending: string }> = [];

    for (const depositor of unifiedBalance?.breakdown ?? []) {
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
  }

  async function connectWallet() {
    const eth = (window as any).ethereum;
    if (!eth) throw new Error("No wallet found. Open this page in a wallet-enabled browser.");

    const accounts = await eth.request({ method: "eth_requestAccounts" });
    setAccount(accounts?.[0] || "");
  }

  useEffect(() => {
    const eth = (window as any).ethereum;
    if (!eth) return;

    eth.request({ method: "eth_accounts" }).then((accounts: string[]) => {
      if (accounts?.[0]) setAccount(accounts[0]);
    });
  }, []);

  useEffect(() => {
    if (account) {
      loadUnifiedBalance();
    }
  }, [account]);

  const canSubmit = useMemo(() => {
    const amountNumber = Number(amount);

    if (!mode || !liquiditySource) return false;
    if (!recipient.startsWith("0x") || recipient.length < 42) return false;
    if (!amountNumber || amountNumber <= 0) return false;

    if (liquiditySource === "unified-balance") {
      return getConfirmedUnifiedBalance() >= amountNumber;
    }

    return true;
  }, [mode, liquiditySource, recipient, amount, unifiedBalance]);

  async function createConfidentialIntent() {
    const amountBase = parseUnits18(amount).toString();

    const res = await fetch(`${API_BASE}/api/confidential/payment-intent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient,
        amount: amountBase,
        memo,
        recipientLabel,
        mode: "confidential",
      }),
    });

    const json = await res.json();

    if (!res.ok || !json.ok) {
      throw new Error(json.error || "Failed to create confidential intent");
    }

    return json;
  }

  async function submitUnifiedBalancePayment(commitmentId?: string) {
    const owner = account || (await requestWalletAccount());

    setAccount(owner);

    const beforeBalance = getConfirmedUnifiedBalance();
    const spendAmount = Number(amount || "0");

    const { kit } = await getCircleTools();
    const adapter = await getWalletAdapter();

    async function refreshAndMaybeRecordPending(reason: string) {
      const latestBalance = await fetchLatestUnifiedBalanceForOwner(owner);
      const afterBalance = getBalanceNumber(latestBalance);

      if (balanceReducedEnough(beforeBalance, afterBalance, spendAmount)) {
        const pendingRef = makeId("pending_unified");

        recordPayment({
          mode: mode as PaymentMode,
          liquiditySource: liquiditySource as LiquiditySource,
          recipient,
          recipientLabel,
          amount,
          memo,
          txHash: pendingRef,
          commitmentId,
          status: "pending",
        });

        return {
          ok: true,
          pending: true,
          mode: mode as PaymentMode,
          amount,
          recipient,
          txHash: pendingRef,
          source: "Unified Balance USDC",
          message:
            "Unified Balance was deducted, but Arc settlement confirmation was not returned yet. Payment was saved as pending.",
        };
      }

      throw new Error(reason);
    }

    try {
      const spendPromise = kit.unifiedBalance.spend({
        amount,
        token: "USDC",
        from: { adapter },
        to: {
          adapter,
          chain: "Arc_Testnet",
          recipientAddress: recipient,
        },
      });

      const timeoutPromise = new Promise((_, reject) => {
        window.setTimeout(() => {
          reject(
            new Error(
              "Unified Balance spend is still waiting for settlement confirmation. Checking balance now..."
            )
          );
        }, 90000);
      });

      const result: any = await Promise.race([spendPromise, timeoutPromise]);

      const txHash = getFinalTxHashFromUnifiedResult(result);

      recordPayment({
        mode: mode as PaymentMode,
        liquiditySource: liquiditySource as LiquiditySource,
        recipient,
        recipientLabel,
        amount,
        memo,
        txHash,
        commitmentId,
        status: "settled",
      });

      return {
        ok: true,
        mode: mode as PaymentMode,
        amount,
        recipient,
        result,
        txHash,
        explorerUrl: txHash ? getExplorerUrl(txHash) : undefined,
        source: "Unified Balance USDC",
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unified Balance payment failed";

      if (
        message.includes("still waiting for settlement confirmation") ||
        message.includes("Transfer spec has already been used") ||
        message.includes("Mint failure") ||
        message.includes("eth_getBlockByNumber") ||
        message.includes("request timed out") ||
        message.includes("took too long")
      ) {
        return await refreshAndMaybeRecordPending(
          "Unified Balance spend could not be confirmed yet. Balance was not deducted, so no payment was recorded."
        );
      }

      throw err;
    }
  }

  async function submitArcDirectPayment(commitmentId?: string) {
    if (!account) {
      await connectWallet();
    }

    await ensureArcTestnet();

    const eth = (window as any).ethereum;
    const accounts = await eth.request({ method: "eth_requestAccounts" });
    const from = accounts?.[0];

    if (!from) {
      throw new Error("Wallet connection failed");
    }

    const value = `0x${parseUnits18(amount).toString(16)}`;

    const txHash = await eth.request({
      method: "eth_sendTransaction",
      params: [
        {
          from,
          to: recipient,
          value,
        },
      ],
    });

    recordPayment({
      mode: mode as PaymentMode,
      liquiditySource: liquiditySource as LiquiditySource,
      recipient,
      recipientLabel,
      amount,
      memo,
      txHash,
      commitmentId,
    });

    return {
      ok: true,
      mode: mode as PaymentMode,
      amount,
      recipient,
      txHash,
      explorerUrl: getExplorerUrl(txHash),
      source: "Arc Direct",
    };
  }

  async function submitPayment() {
    try {
      setLoading(true);
      setStatus("Preparing payment...");
      setResult(null);

      if (!mode) {
        throw new Error("Choose Open Payment or Private Payment");
      }

      if (!liquiditySource) {
        throw new Error("Choose Arc Direct or Unified Balance USDC");
      }

      if (!canSubmit) {
        throw new Error("Enter a valid recipient and amount");
      }

      let confidentialIntent: any = null;

      if (mode === "confidential") {
        setStatus("Creating confidential payment metadata...");
        confidentialIntent = await createConfidentialIntent();
      }

      if (liquiditySource === "unified-balance") {
        setStatus("Spending from Unified Balance USDC into Arc...");
        const json = await submitUnifiedBalancePayment(confidentialIntent?.commitmentId);
        setResult(json);
        await loadUnifiedBalance();
        setStatus("Payment completed through Unified Balance USDC");
      } else {
        setStatus("Sending Arc Direct payment...");
        const json = await submitArcDirectPayment(confidentialIntent?.commitmentId);
        setResult(json);
        setStatus("Arc Direct payment completed");
      }
    } catch (err) {
      setStatus(formatPaymentError(err));
    } finally {
      setLoading(false);
    }
  }

  const unifiedSteps = Array.isArray(result?.result?.steps) ? result.result.steps : [];
  const confirmedUnifiedBalance = getConfirmedUnifiedBalance();
  const pendingUnifiedBalance = getPendingUnifiedBalance();
  const activeUnifiedSources = getActiveUnifiedSources();
  const amountNumber = Number(amount || "0");
  const unifiedBalanceTooLow =
    liquiditySource === "unified-balance" &&
    amountNumber > 0 &&
    confirmedUnifiedBalance < amountNumber;

  const finalTxHash =
    liquiditySource === "unified-balance"
      ? getFinalTxHashFromUnifiedResult(result)
      : result?.txHash;

  return (
    <div className="p-6 max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">New Payment</h1>
        <p className="text-sm text-muted-foreground">
          Complete open or private payments on Arc using Arc Direct or Unified Balance USDC.
        </p>
      </div>

      <div className="rounded-xl border p-5 space-y-5">
        <div className="rounded-lg border p-3 bg-secondary/30 text-sm">
          <div className="font-medium">Veil payment flow</div>
          <p className="text-muted-foreground mt-1">
            Choose a payment mode and liquidity source to start. Veil will complete the payment on Arc.
          </p>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Payment mode</div>
          <div className="flex gap-2 flex-wrap">
            <button
              className={`px-4 py-2 rounded-lg border ${mode === "open" ? "bg-primary text-primary-foreground" : ""}`}
              onClick={() => setMode("open")}
              type="button"
            >
              Open Payment
            </button>

            <button
              className={`px-4 py-2 rounded-lg border ${mode === "confidential" ? "bg-primary text-primary-foreground" : ""}`}
              onClick={() => setMode("confidential")}
              type="button"
            >
              Private Payment
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-medium">Liquidity source</div>
          <div className="grid md:grid-cols-2 gap-3">
            <button
              className={`text-left rounded-lg border p-4 ${liquiditySource === "unified-balance" ? "bg-primary text-primary-foreground" : ""}`}
              onClick={() => setLiquiditySource("unified-balance")}
              type="button"
            >
              <div className="font-medium">Unified Balance USDC</div>
              <div className={`text-sm mt-1 ${liquiditySource === "unified-balance" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                Spend from your unified USDC balance into Arc settlement.
              </div>
            </button>

            <button
              className={`text-left rounded-lg border p-4 ${liquiditySource === "arc-direct" ? "bg-primary text-primary-foreground" : ""}`}
              onClick={() => setLiquiditySource("arc-direct")}
              type="button"
            >
              <div className="font-medium">Arc Direct</div>
              <div className={`text-sm mt-1 ${liquiditySource === "arc-direct" ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                Send directly from your connected Arc wallet.
              </div>
            </button>
          </div>
        </div>

        {liquiditySource === "unified-balance" && (
          <div className="rounded-lg border p-4 space-y-3 bg-secondary/20">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">Available Unified Balance</div>
                <p className="text-sm text-muted-foreground">
                  Confirmed USDC from your connected wallet is spendable. Pending USDC must confirm before payment.
                </p>
              </div>

              <button
                className="px-3 py-1.5 rounded-lg border text-sm"
                type="button"
                onClick={loadUnifiedBalance}
              >
                Refresh
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3 bg-background">
                <div className="text-xs text-muted-foreground">Confirmed</div>
                <div className="text-xl font-semibold">{confirmedUnifiedBalance.toFixed(6)} USDC</div>
              </div>

              <div className="rounded-lg border p-3 bg-background">
                <div className="text-xs text-muted-foreground">Pending</div>
                <div className="text-xl font-semibold">{pendingUnifiedBalance.toFixed(6)} USDC</div>
              </div>
            </div>

            {activeUnifiedSources.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-medium">Source breakdown</div>
                {activeUnifiedSources.map((row, idx) => (
                  <div key={idx} className="rounded-lg border p-3 text-sm bg-background">
                    <div><strong>Chain:</strong> {row.chain}</div>
                    <div><strong>Confirmed:</strong> {row.confirmed} USDC</div>
                    <div><strong>Pending:</strong> {row.pending} USDC</div>
                  </div>
                ))}
              </div>
            )}

            {unifiedBalanceTooLow && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                Insufficient confirmed Unified Balance. Reduce amount or deposit more USDC.
              </div>
            )}

            {balanceStatus && (
              <div className="text-xs text-muted-foreground">{balanceStatus}</div>
            )}
          </div>
        )}

        {liquiditySource === "arc-direct" && (
          <div className="rounded-lg border p-3 text-sm">
            {account ? (
              <div>Connected wallet: {shortAddress(account)}</div>
            ) : (
              <button className="px-4 py-2 rounded-lg border" type="button" onClick={connectWallet}>
                Connect wallet
              </button>
            )}
          </div>
        )}

        <div className="grid gap-3">
          <input
            className="border rounded-lg px-3 py-2 w-full"
            placeholder="Recipient Arc address"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
          />

          <input
            className="border rounded-lg px-3 py-2 w-full"
            placeholder="Recipient label"
            value={recipientLabel}
            onChange={(e) => setRecipientLabel(e.target.value)}
          />

          <input
            className="border rounded-lg px-3 py-2 w-full"
            placeholder="Amount in USDC"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <input
            className="border rounded-lg px-3 py-2 w-full"
            placeholder="Memo / reference"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
          />
        </div>

        <button
          className="px-4 py-2 rounded-lg border disabled:opacity-50"
          onClick={submitPayment}
          disabled={loading || !canSubmit}
          type="button"
        >
          {loading
            ? "Processing..."
            : !mode
            ? "Choose payment mode"
            : !liquiditySource
            ? "Choose liquidity source"
            : unifiedBalanceTooLow
            ? "Insufficient Unified Balance"
            : "Submit Payment"}
        </button>

        {status && <div className="text-sm">{status}</div>}
      </div>

      {result && (
        <div className="rounded-xl border p-5 space-y-4">
          <div>
            <h2 className="text-lg font-medium">Payment result</h2>
            <p className="text-sm text-muted-foreground">
              Settlement completed on Arc.
            </p>
          </div>

          <div className="rounded-lg border p-3 text-sm space-y-1">
            <div><strong>Mode:</strong> {mode}</div>
            <div><strong>Liquidity source:</strong> {liquiditySource === "unified-balance" ? "Unified Balance USDC" : "Arc Direct"}</div>
            <div><strong>Amount:</strong> {amount} USDC</div>
            <div><strong>Recipient:</strong> {recipient}</div>
            {finalTxHash && (
              <div className="break-all">
                <strong>Final tx:</strong>{" "}
                <a className="underline" href={getExplorerUrl(finalTxHash)} target="_blank" rel="noreferrer">
                  {finalTxHash}
                </a>
              </div>
            )}
            {mode === "confidential" && (
              <div><strong>Private context:</strong> encrypted and saved</div>
            )}
          </div>

          {unifiedSteps.length > 0 && (
            <div className="space-y-3">
              <div className="font-medium">Unified Balance steps</div>
              {unifiedSteps.map((step: any, idx: number) => (
                <div key={idx} className="rounded-lg border p-3 text-sm">
                  <div><strong>{step.name ?? `Step ${idx + 1}`}</strong> — {step.state ?? "submitted"}</div>
                  {step.txHash && <div className="break-all text-xs mt-1">{step.txHash}</div>}
                  {step.explorerUrl && (
                    <a
                      className="underline block mt-1"
                      href={step.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View in explorer
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer font-medium">Raw response</summary>
            <pre className="mt-3 text-xs overflow-auto whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
