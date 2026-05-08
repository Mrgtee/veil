import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { ArrowRight, ExternalLink, RefreshCw, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionHeader } from "@/components/veil/SectionHeader";
import {
  UNIFIED_BALANCE_SOURCE_CHAINS,
  depositUnifiedBalance,
  getActiveUnifiedSources,
  getBalanceNumber,
  getExplorerUrl,
  getFinalTxHash,
  normalizeSteps,
  readUnifiedBalance,
  readUnifiedBalanceCache,
  type SourceChainValue,
  type UnifiedBalanceData,
  type UnifiedBalanceResult,
  type UnifiedBalanceStep,
} from "@/lib/payments/unifiedBalance";
import { formatPaymentError } from "@/lib/payments/errors";
import { switchEvmChain } from "@/lib/payments/wallet";

export default function UnifiedBalance() {
  const { address } = useAccount();
  const [sourceChain, setSourceChain] = useState<SourceChainValue>("Base_Sepolia");
  const [balance, setBalance] = useState<UnifiedBalanceData | null>(null);
  const [depositAmount, setDepositAmount] = useState("");
  const [depositResult, setDepositResult] = useState<UnifiedBalanceResult | null>(null);
  const [status, setStatus] = useState("");
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [depositing, setDepositing] = useState(false);

  const selectedChain = UNIFIED_BALANCE_SOURCE_CHAINS.find((chain) => chain.value === sourceChain);
  const confirmed = getBalanceNumber(balance, "totalConfirmedBalance");
  const pending = getBalanceNumber(balance, "totalPendingBalance");
  const activeChains = useMemo(() => getActiveUnifiedSources(balance), [balance]);
  const depositSteps = normalizeSteps(depositResult);
  const depositTxHash = getFinalTxHash(depositResult);

  async function loadBalance(showCached = true) {
    if (!address) return;

    try {
      setLoadingBalance(true);

      if (showCached) {
        const cached = readUnifiedBalanceCache(address);
        if (cached) {
          setBalance(cached);
          setStatus("Refreshing balance...");
        } else {
          setStatus("Loading Unified USDC Balance...");
        }
      } else {
        setStatus("Refreshing Unified USDC Balance...");
      }

      const latest = await readUnifiedBalance(address);
      setBalance(latest);
      setStatus("Balance refreshed.");
    } catch (err) {
      setStatus(formatPaymentError(err, "Unable to load Unified USDC Balance."));
    } finally {
      setLoadingBalance(false);
    }
  }

  async function handleSourceChainChange(nextValue: SourceChainValue) {
    setSourceChain(nextValue);
    const nextChain = UNIFIED_BALANCE_SOURCE_CHAINS.find((chain) => chain.value === nextValue);
    if (!nextChain) return;

    try {
      setStatus(`Switching wallet to ${nextChain.label}...`);
      await switchEvmChain(nextChain);
      setStatus(`Wallet switched to ${nextChain.label}.`);
    } catch (err) {
      setStatus(formatPaymentError(err, "Unable to switch source chain."));
    }
  }

  async function submitDeposit() {
    try {
      setDepositing(true);
      setDepositResult(null);
      setStatus(`Preparing deposit from ${selectedChain?.label || "selected chain"}...`);

      if (!depositAmount || Number(depositAmount) <= 0) {
        throw new Error("Enter a valid USDC deposit amount.");
      }

      const result = await depositUnifiedBalance({
        sourceChain,
        amount: depositAmount,
        account: address,
      });

      setDepositResult(result);
      setStatus("Deposit submitted. It may appear as pending before it becomes confirmed and spendable.");
      await loadBalance(false);
    } catch (err) {
      setStatus(formatPaymentError(err, "Deposit failed."));
    } finally {
      setDepositing(false);
    }
  }

  useEffect(() => {
    if (address) {
      loadBalance();
    }
  }, [address]);

  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Liquidity"
        title="Unified USDC Balance"
        description="Deposit, refresh, and spend user-owned USDC."
        actions={
          <Button asChild>
            <Link to="/app/payments/new">
              New Payment
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        <div className="surface-card p-5 space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-medium">Your balance</h2>
              <p className="text-sm text-muted-foreground">
                This balance is read from the globally connected wallet.
              </p>
            </div>

            <Button variant="outline" size="sm" onClick={() => loadBalance(false)} disabled={loadingBalance}>
              <RefreshCw className="mr-2 h-4 w-4" />
              {loadingBalance ? "Refreshing..." : "Refresh Balance"}
            </Button>
          </div>

          <div className="rounded-lg border bg-secondary/30 p-3 text-xs">
            <div className="text-muted-foreground">Connected wallet</div>
            <div className="mt-1 break-all font-mono">{address || "No wallet connected"}</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">Confirmed</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{confirmed.toFixed(6)}</div>
              <div className="text-xs text-muted-foreground">USDC spendable now</div>
            </div>

            <div className="rounded-lg border p-4">
              <div className="text-xs text-muted-foreground">Pending</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums">{pending.toFixed(6)}</div>
              <div className="text-xs text-muted-foreground">Waiting to confirm</div>
            </div>
          </div>

          <div className="rounded-lg border border-info/30 bg-info/5 p-3 text-sm">
            Confirmed USDC is spendable. Pending USDC is still finalizing.
          </div>

          {activeChains.length > 0 ? (
            <div className="space-y-2">
              <div className="text-sm font-medium">Source breakdown</div>
              {activeChains.map((row, index) => (
                <div key={`${row.chain}-${index}`} className="rounded-lg border p-3 text-sm">
                  <div className="font-medium">{row.chain}</div>
                  <div className="text-muted-foreground">Confirmed {row.confirmed} USDC</div>
                  <div className="text-muted-foreground">Pending {row.pending} USDC</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              No source-chain balances are active for this wallet yet.
            </div>
          )}
        </div>

        <div className="surface-card p-5 space-y-5">
          <div>
            <h2 className="text-lg font-medium">Deposit USDC</h2>
            <p className="text-sm text-muted-foreground">
              Choose a source chain and deposit into your Unified USDC Balance.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Source chain</Label>
              <Select value={sourceChain} onValueChange={(value) => handleSourceChainChange(value as SourceChainValue)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNIFIED_BALANCE_SOURCE_CHAINS.map((chain) => (
                    <SelectItem key={chain.value} value={chain.value}>
                      {chain.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="deposit-amount">Amount</Label>
              <Input
                id="deposit-amount"
                value={depositAmount}
                onChange={(event) => setDepositAmount(event.target.value)}
                placeholder="0.00 USDC"
                inputMode="decimal"
              />
            </div>
          </div>

          <Button
            type="button"
            onClick={submitDeposit}
            disabled={depositing || !depositAmount || Number(depositAmount) <= 0}
          >
            <WalletCards className="mr-2 h-4 w-4" />
            {depositing ? "Depositing..." : "Deposit USDC"}
          </Button>

          {selectedChain && (
            <div className="rounded-lg border bg-secondary/30 p-3 text-sm text-muted-foreground">
              Deposits request a wallet switch to {selectedChain.label}. User-facing flows stay wallet-owned.
            </div>
          )}

          {depositResult && (
            <div className="rounded-lg border p-4 space-y-3 text-sm">
              <div className="font-medium">Deposit submitted</div>
              <div>Amount: {depositAmount} USDC</div>
              <div>Source: {selectedChain?.label}</div>

              {depositTxHash && (
                <a
                  className="inline-flex items-center gap-2 break-all font-mono text-xs underline"
                  href={getExplorerUrl(sourceChain, depositTxHash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  {depositTxHash}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              )}

              {depositSteps.map((step: UnifiedBalanceStep, index: number) => (
                <div key={index} className="rounded-lg border p-3">
                  <div className="font-medium">{step.name ?? `Step ${index + 1}`}</div>
                  <div className="text-muted-foreground">{step.state ?? "submitted"}</div>
                  {step.txHash && <div className="mt-1 break-all font-mono text-xs">{step.txHash}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {status && <div className="rounded-lg border bg-card p-3 text-sm">{status}</div>}
    </div>
  );
}
