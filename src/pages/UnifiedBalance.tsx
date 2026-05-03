import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { Buffer } from "buffer";

type Mode = "open" | "confidential";
type SourceChainValue = "Base_Sepolia" | "Ethereum_Sepolia" | "Arc_Testnet";

type SourceChain = {
  label: string;
  value: SourceChainValue;
  chainIdHex: string;
  rpcUrl: string;
  explorerUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
};

declare global {
  interface Window {
    ethereum?: any;
  }
}

const CHAINS: SourceChain[] = [
  {
    label: "Base Sepolia",
    value: "Base_Sepolia",
    chainIdHex: "0x14A34",
    rpcUrl: "https://sepolia.base.org",
    explorerUrl: "https://sepolia.basescan.org",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  },
  {
    label: "Ethereum Sepolia",
    value: "Ethereum_Sepolia",
    chainIdHex: "0xaa36a7",
    rpcUrl: "https://sepolia.drpc.org",
    explorerUrl: "https://sepolia.etherscan.io",
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
  },
  {
    label: "Arc Testnet",
    value: "Arc_Testnet",
    chainIdHex: "0x4CEF52",
    rpcUrl: "https://rpc.testnet.arc.network",
    explorerUrl: "https://testnet.arcscan.app",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  },
];

function getChain(value: SourceChainValue) {
  const chain = CHAINS.find((c) => c.value === value);
  if (!chain) throw new Error(`Unsupported chain: ${value}`);
  return chain;
}

function getTxUrl(chainValue: SourceChainValue, txHash: string) {
  const chain = getChain(chainValue);
  return `${chain.explorerUrl}/tx/${txHash}`;
}

function normalizeSteps(result: any) {
  if (Array.isArray(result?.steps)) return result.steps;
  if (Array.isArray(result?.result?.steps)) return result.result.steps;
  return [];
}

function getFinalTxHash(result: any) {
  if (result?.txHash) return result.txHash;
  const steps = normalizeSteps(result);
  const hashes = steps.map((s: any) => s?.txHash).filter(Boolean);
  return hashes[hashes.length - 1] || "";
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

function makeId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function makeCommitmentId() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
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

async function switchNetwork(chain: SourceChain) {
  if (!window.ethereum) throw new Error("No wallet detected.");

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chain.chainIdHex }],
    });
  } catch (err: any) {
    if (err?.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: chain.chainIdHex,
            chainName: chain.label,
            rpcUrls: [chain.rpcUrl],
            nativeCurrency: chain.nativeCurrency,
            blockExplorerUrls: [chain.explorerUrl],
          },
        ],
      });
      return;
    }

    throw err;
  }
}

let cachedKit: any = null;

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

  if (!cachedKit) {
    cachedKit = new AppKit();
  }

  if (!cachedKit.unifiedBalance) {
    throw new Error("Unified Balance is not available in the installed frontend AppKit package. Reinstall @circle-fin/app-kit at version 1.4.1 or newer.");
  }

  return {
    kit: cachedKit,
    createViemAdapterFromProvider,
  };
}

async function getWalletAdapter() {
  await requestWalletAccount();

  const { createViemAdapterFromProvider } = await getCircleTools();

  return createViemAdapterFromProvider({
    provider: window.ethereum,
  });
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

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

function recordPayment(input: {
  mode: Mode;
  amount: string;
  recipientAddress: string;
  recipientLabel?: string;
  memo?: string;
  txHash?: string;
  commitmentId?: string;
}) {
  const createdAt = new Date().toISOString();

  const payment = {
    id: makeId("pmt"),
    type: "single",
    mode: input.mode,
    status: "settled",
    recipient: input.recipientAddress,
    recipientLabel: input.recipientLabel || input.recipientAddress,
    amount: input.amount,
    token: "USDC",
    txHash: input.txHash,
    commitmentId: input.commitmentId,
    memo: input.memo,
    createdAt,
    liquiditySource: "Unified Balance USDC",
    sourceChain: "User-owned Unified Balance",
    destinationChain: "Arc Testnet",
  };

  const payments = readJson<any[]>("veil.live.payments", []);
  writeJson("veil.live.payments", [payment, ...payments]);

  if (input.mode === "confidential" && input.commitmentId) {
    const records = readJson<any[]>("veil.live.records", []);
    writeJson("veil.live.records", [
      {
        id: makeId("rec"),
        paymentId: payment.id,
        commitmentId: input.commitmentId,
        disclosureStatus: "private",
        authorizedViewers: [],
        createdAt,
      },
      ...records,
    ]);
  }
}

export default function UnifiedBalance() {
  const { address, isConnected } = useAccount();
  const [wallet, setWallet] = useState(address ?? "");
  const [sourceChain, setSourceChain] = useState<SourceChainValue>("Base_Sepolia");

  const [balance, setBalance] = useState<any>(null);
  const [depositAmount, setDepositAmount] = useState("0.10");
  const [depositResult, setDepositResult] = useState<any>(null);

  const [mode, setMode] = useState<Mode>("open");
  const [spendAmount, setSpendAmount] = useState("0.01");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [recipientLabel, setRecipientLabel] = useState("");
  const [memo, setMemo] = useState("");
  const [spendResult, setSpendResult] = useState<any>(null);

  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) return;

    setWallet(address);
    localStorage.setItem("veil.wallet", address);
    localStorage.setItem("veil.operator", address);

    const cached = readUnifiedBalanceCache(address);
    if (cached) {
      setBalance(cached);
      setStatus("Cached Unified Balance loaded. Refreshing latest balance...");
    }

    loadBalance();
  }, [address]);

  async function refreshConnectedWalletBalance() {
    try {
      setLoading(true);

      if (!isConnected && !address) {
        setStatus("Wallet is not connected in the app. Please reconnect from the top bar or sign in again.");
        return;
      }

      setStatus("Refreshing your Unified Balance...");
      setWallet(address ?? wallet);

      await loadBalance();

      setStatus("Your Unified Balance loaded");
    } catch (err) {
      setStatus(getErrorMessage(err, "Unable to refresh Unified Balance"));
    } finally {
      setLoading(false);
    }
  }

  async function handleSourceChainChange(nextChain: SourceChainValue) {
    setSourceChain(nextChain);

    try {
      const chain = getChain(nextChain);
      setStatus(`Switching wallet to ${chain.label}...`);
      await switchNetwork(chain);
      setStatus(`Wallet switched to ${chain.label}`);
    } catch (err) {
      setStatus(getErrorMessage(err, "Unable to switch source chain"));
    }
  }

  async function loadBalance() {
    try {
      setLoading(true);
      setStatus("Loading your Unified Balance...");

      const { kit } = await getCircleTools();
      const adapter = await getWalletAdapter();

      const result = await kit.unifiedBalance.getBalances({
        sources: [{ adapter }],
        networkType: "testnet",
        includePending: true,
      });

      setBalance(result);
      saveUnifiedBalanceCache(address ?? wallet, result);
      setStatus("Your Unified Balance loaded");
    } catch (err) {
      setStatus(getErrorMessage(err, "Unable to load Unified Balance"));
    } finally {
      setLoading(false);
    }
  }

  async function depositToUnifiedBalance() {
    try {
      setLoading(true);
      setDepositResult(null);

      const chain = getChain(sourceChain);
      setStatus(`Switching to ${chain.label}...`);
      await switchNetwork(chain);

      setStatus("Preparing wallet deposit...");
      const { kit } = await getCircleTools();
      const adapter = await getWalletAdapter();

      setStatus(`Depositing ${depositAmount} USDC from ${chain.label}...`);

      const result = await kit.unifiedBalance.deposit({
        from: {
          adapter,
          chain: sourceChain,
        },
        amount: depositAmount,
        token: "USDC",
      });

      setDepositResult(result);
      setStatus("Deposit submitted. Refresh balance until it becomes confirmed.");
      await loadBalance();
    } catch (err) {
      setStatus(getErrorMessage(err, "Deposit failed"));
    } finally {
      setLoading(false);
    }
  }

  async function spendToArc() {
    try {
      setLoading(true);
      setSpendResult(null);

      if (!recipientAddress.startsWith("0x") || recipientAddress.length < 42) {
        throw new Error("Enter a valid Arc recipient address.");
      }

      const arc = getChain("Arc_Testnet");
      setStatus("Switching to Arc Testnet...");
      await switchNetwork(arc);

      setStatus("Preparing Unified Balance spend...");
      const { kit } = await getCircleTools();
      const adapter = await getWalletAdapter();

      const result = await kit.unifiedBalance.spend({
        amount: spendAmount,
        token: "USDC",
        from: { adapter },
        to: {
          adapter,
          chain: "Arc_Testnet",
          recipientAddress,
        },
      });

      const txHash = getFinalTxHash(result);
      const commitmentId = mode === "confidential" ? makeCommitmentId() : undefined;

      recordPayment({
        mode,
        amount: spendAmount,
        recipientAddress,
        recipientLabel,
        memo,
        txHash,
        commitmentId,
      });

      setSpendResult(result);
      setStatus("Unified Balance spend completed on Arc");
      await loadBalance();
    } catch (err) {
      setStatus(getErrorMessage(err, "Unified Balance spend failed"));
    } finally {
      setLoading(false);
    }
  }

  const confirmed = balance?.totalConfirmedBalance ?? "—";
  const pending = balance?.totalPendingBalance ?? "—";

  const activeChains = useMemo(() => {
    const rows: any[] = [];

    for (const depositor of balance?.breakdown ?? []) {
      for (const item of depositor?.breakdown ?? []) {
        const confirmedValue = item.confirmedBalance ?? "0.000000";
        const pendingValue = item.pendingBalance ?? "0.000000";

        if (confirmedValue !== "0.000000" || pendingValue !== "0.000000") {
          rows.push({
            depositor: depositor.depositor,
            chain: item.chain,
            confirmed: confirmedValue,
            pending: pendingValue,
          });
        }
      }
    }

    return rows;
  }, [balance]);

  const depositSteps = normalizeSteps(depositResult);
  const spendSteps = normalizeSteps(spendResult);
  const depositTxHash = getFinalTxHash(depositResult);
  const spendTxHash = getFinalTxHash(spendResult);

  return (
    <div className="p-4 sm:p-6 max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Unified Balance USDC</h1>
        <p className="text-sm text-muted-foreground">
          Deposit USDC from your connected wallet into your own Unified Balance, then spend it into Arc payments.
        </p>
      </div>

      <div className="rounded-xl border p-5 space-y-4 bg-secondary/30">
        <div className="font-medium">Real user-owned payment flow</div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Veil uses your connected wallet directly. Deposits come from your wallet, the Unified Balance belongs to your wallet, and spends are signed by your wallet.
        </p>

        <div className="grid md:grid-cols-3 gap-3 text-sm">
          <div className="rounded-lg border p-3 bg-background">
            <div className="font-medium">1. Deposit</div>
            <p className="text-muted-foreground mt-1">Add USDC from a supported source chain.</p>
          </div>

          <div className="rounded-lg border p-3 bg-background">
            <div className="font-medium">2. Confirm</div>
            <p className="text-muted-foreground mt-1">Pending balance must become confirmed before spending.</p>
          </div>

          <div className="rounded-lg border p-3 bg-background">
            <div className="font-medium">3. Spend to Arc</div>
            <p className="text-muted-foreground mt-1">Spend confirmed Unified Balance into Arc payments.</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Connected wallet</h2>
            <p className="text-sm text-muted-foreground">This wallet owns the Unified Balance shown below.</p>
          </div>

          <button className="px-4 py-2 rounded-lg border w-fit" onClick={refreshConnectedWalletBalance} disabled={loading}>
            {loading ? "Loading..." : "Refresh balance"}
          </button>
        </div>

        <div className="rounded-lg border p-3 text-sm font-mono break-all">
          {wallet || address || "No wallet connected in app"}
        </div>
      </div>

      <div className="grid xl:grid-cols-2 gap-4">
        <div className="rounded-xl border p-5 space-y-4">
          <div>
            <h2 className="text-lg font-medium">Your Unified Balance</h2>
            <p className="text-sm text-muted-foreground">Confirmed balance is spendable. Pending balance must confirm first.</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Confirmed</div>
              <div className="text-2xl font-semibold">{confirmed}</div>
              <div className="text-xs text-muted-foreground">USDC</div>
            </div>

            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Pending</div>
              <div className="text-2xl font-semibold">{pending}</div>
              <div className="text-xs text-muted-foreground">USDC</div>
            </div>
          </div>

          <button className="px-4 py-2 rounded-lg border" onClick={loadBalance} disabled={loading}>
            Refresh balance
          </button>

          {activeChains.length > 0 && (
            <div className="space-y-2">
              <div className="font-medium text-sm">Source breakdown</div>
              {activeChains.map((row, idx) => (
                <div key={idx} className="rounded-lg border p-3 text-sm">
                  <div><strong>Depositor:</strong> <span className="font-mono break-all">{row.depositor}</span></div>
                  <div><strong>Chain:</strong> {row.chain}</div>
                  <div><strong>Confirmed:</strong> {row.confirmed} USDC</div>
                  <div><strong>Pending:</strong> {row.pending} USDC</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border p-5 space-y-4">
          <div>
            <h2 className="text-lg font-medium">Deposit into your Unified Balance</h2>
            <p className="text-sm text-muted-foreground">Deposit USDC from the selected source chain using your connected wallet.</p>
          </div>

          <select
            className="border rounded-lg px-3 py-2 w-full bg-background"
            value={sourceChain}
            onChange={(e) => handleSourceChainChange(e.target.value as SourceChainValue)}
          >
            {CHAINS.map((chain) => (
              <option key={chain.value} value={chain.value}>{chain.label}</option>
            ))}
          </select>

          <input
            className="border rounded-lg px-3 py-2 w-full"
            placeholder="Amount in USDC"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
          />

          <button
            className="px-4 py-2 rounded-lg border"
            onClick={depositToUnifiedBalance}
            disabled={loading || !depositAmount || Number(depositAmount) <= 0}
          >
            {loading ? "Processing..." : "Deposit USDC"}
          </button>

          {depositResult && (
            <div className="rounded-lg border p-3 text-sm space-y-2">
              <div className="font-medium">Deposit submitted</div>
              <div><strong>Amount:</strong> {depositAmount} USDC</div>
              <div><strong>Source:</strong> {getChain(sourceChain).label}</div>

              {depositTxHash && (
                <a className="underline break-all block" href={getTxUrl(sourceChain, depositTxHash)} target="_blank" rel="noreferrer">
                  View deposit tx
                </a>
              )}

              {depositSteps.map((step: any, idx: number) => (
                <div key={idx} className="rounded-lg border p-2">
                  <div><strong>{step.name ?? `Step ${idx + 1}`}</strong> — {step.state ?? "submitted"}</div>
                  {step.txHash && <div className="text-xs break-all">{step.txHash}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border p-5 space-y-4">
        <div>
          <h2 className="text-lg font-medium">Spend to Arc</h2>
          <p className="text-sm text-muted-foreground">Spend confirmed Unified Balance into an Arc Testnet recipient.</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button className={`px-4 py-2 rounded-lg border ${mode === "open" ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setMode("open")}>
            Open Spend
          </button>

          <button className={`px-4 py-2 rounded-lg border ${mode === "confidential" ? "bg-primary text-primary-foreground" : ""}`} onClick={() => setMode("confidential")}>
            Private Spend
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          <input className="border rounded-lg px-3 py-2 w-full" placeholder="Amount in USDC" value={spendAmount} onChange={(e) => setSpendAmount(e.target.value)} />
          <input className="border rounded-lg px-3 py-2 w-full" placeholder="Arc recipient address" value={recipientAddress} onChange={(e) => setRecipientAddress(e.target.value)} />
          <input className="border rounded-lg px-3 py-2 w-full" placeholder="Recipient label" value={recipientLabel} onChange={(e) => setRecipientLabel(e.target.value)} />
          <input className="border rounded-lg px-3 py-2 w-full" placeholder="Memo / reference" value={memo} onChange={(e) => setMemo(e.target.value)} />
        </div>

        <button
          className="px-4 py-2 rounded-lg border"
          onClick={spendToArc}
          disabled={loading || !recipientAddress.startsWith("0x") || recipientAddress.length < 42 || !spendAmount || Number(spendAmount) <= 0}
        >
          {loading ? "Processing..." : "Spend Unified Balance"}
        </button>

        {status && <div className="rounded-lg border p-3 text-sm">{status}</div>}
      </div>

      {spendResult && (
        <div className="rounded-xl border p-5 space-y-4">
          <div>
            <h2 className="text-lg font-medium">Spend result</h2>
            <p className="text-sm text-muted-foreground">Unified Balance spend result and transaction steps.</p>
          </div>

          <div className="rounded-lg border p-3 text-sm">
            <div><strong>Mode:</strong> {mode}</div>
            <div><strong>Amount:</strong> {spendAmount} USDC</div>
            <div><strong>Recipient:</strong> <span className="font-mono break-all">{recipientAddress}</span></div>

            {spendTxHash && (
              <a className="underline break-all block mt-2" href={getTxUrl("Arc_Testnet", spendTxHash)} target="_blank" rel="noreferrer">
                View final Arc tx
              </a>
            )}
          </div>

          {spendSteps.map((step: any, idx: number) => (
            <div key={idx} className="rounded-lg border p-3 text-sm">
              <div><strong>{step.name ?? `Step ${idx + 1}`}</strong> — {step.state ?? "submitted"}</div>
              {step.txHash && <div className="break-all text-xs mt-1">{step.txHash}</div>}
            </div>
          ))}

          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer font-medium">Raw response</summary>
            <pre className="mt-3 text-xs overflow-auto whitespace-pre-wrap">
              {JSON.stringify(spendResult, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}
