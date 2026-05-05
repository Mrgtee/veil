import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { SectionHeader } from "@/components/veil/SectionHeader";
import { StatCard } from "@/components/veil/StatCard";
import { Button } from "@/components/ui/button";
import { veilApi } from "@/services/veilApi";
import type { ActivityEvent, DashboardStats, Payment } from "@/types/veil";
import {
  ArrowRight,
  Send,
  Layers,
  History as HistoryIcon,
  Lock,
  Activity,
  TrendingUp,
  Wallet,
  ShieldCheck,
  KeyRound,
  WalletCards,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { formatAmount, formatRelative } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAccount } from "wagmi";
import type { UnifiedBalanceData } from "@/lib/payments/unifiedBalance";
import { ACTIVE_ARC_DEPLOYMENT, getArcExplorerAddressUrl, shortAddress } from "@/lib/deployment";
import { getPaymentSourceLabel } from "@/lib/payments/types";

type ExtendedPayment = Payment & {
  liquiditySource?: string;
  sourceChain?: string;
  destinationChain?: string;
};

function modeLabel(mode: string) {
  return mode === "confidential" ? "Closed" : "Open";
}

function getLiquiditySource(payment: ExtendedPayment) {
  return getPaymentSourceLabel(payment.source || payment.liquiditySource || payment.sourceChain);
}

function isUnifiedPayment(payment: ExtendedPayment) {
  return getLiquiditySource(payment).toLowerCase().includes("unified");
}

function ModeBadge({ mode }: { mode: string }) {
  const isPrivate = mode === "confidential";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        isPrivate
          ? "border-purple-200 bg-purple-50 text-purple-700"
          : "border-amber-200 bg-amber-50 text-amber-800"
      )}
    >
      {isPrivate && <Lock className="h-3 w-3" />}
      {modeLabel(mode)}
    </span>
  );
}

function SourceBadge({ payment }: { payment: ExtendedPayment }) {
  const unified = isUnifiedPayment(payment);
  const source = getLiquiditySource(payment);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium",
        unified
          ? "border-blue-200 bg-blue-50 text-blue-700"
          : "border-stone-200 bg-stone-50 text-stone-700"
      )}
    >
      {unified && <WalletCards className="h-3 w-3" />}
      {source}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const ok = status === "settled";
  const label = status.replaceAll("_", " ");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium capitalize",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-orange-200 bg-orange-50 text-orange-700"
      )}
    >
      {label}
    </span>
  );
}

function Row({ label, value, badge }: { label: string; value: string; badge?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>

      {badge ? (
        <span className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-md bg-success/10 text-success border border-success/20">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          {value}
        </span>
      ) : (
        <span className="font-medium tabular-nums text-right">{value}</span>
      )}
    </div>
  );
}

function getUnifiedBalanceCacheKey(account?: string) {
  return `veil.unified.balance.${(account || "").toLowerCase()}`;
}

function readUnifiedBalanceCache(account?: string) {
  if (!account) return null;

  try {
    const raw = localStorage.getItem(getUnifiedBalanceCacheKey(account));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function QuickAction({
  to,
  icon,
  title,
  desc,
  confidential,
}: {
  to: string;
  icon: ReactNode;
  title: string;
  desc: string;
  confidential?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`group surface-card p-5 hover:shadow-md transition-all ${confidential ? "ring-confidential" : ""}`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-9 w-9 rounded-lg flex items-center justify-center ${
            confidential
              ? "bg-confidential text-confidential-foreground"
              : "bg-gradient-brand text-primary-foreground"
          }`}
        >
          {icon}
        </div>

        <div className="flex-1">
          <div className="font-medium text-sm">{title}</div>
          <div className="text-xs text-muted-foreground">{desc}</div>
        </div>

        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { address } = useAccount();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [payments, setPayments] = useState<ExtendedPayment[]>([]);
  const [unifiedBalance, setUnifiedBalance] = useState<UnifiedBalanceData | null>(null);
  const [balanceStatus, setBalanceStatus] = useState("");
  const [ledgerStatus, setLedgerStatus] = useState("");

  async function loadDashboard() {
    try {
      setLedgerStatus("");
      const [nextStats, nextActivity, nextPayments] = await Promise.all([
        veilApi.getDashboardStats(),
        veilApi.listActivity(),
        veilApi.listPayments(),
      ]);
      setStats(nextStats);
      setActivity(nextActivity);
      setPayments(nextPayments.slice(0, 5) as ExtendedPayment[]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Veil API ledger is unavailable.";
      setLedgerStatus(message);
      setStats(null);
      setActivity([]);
      setPayments([]);
    }
  }

  async function loadUnifiedBalance() {
    const cached = readUnifiedBalanceCache(address);

    if (cached) {
      setUnifiedBalance(cached);
      setBalanceStatus("User-owned balance cache");
      return;
    }

    setUnifiedBalance(null);
    setBalanceStatus("Open Unified Balance to load");
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    loadUnifiedBalance();
  }, [address]);

  const unifiedPayments = useMemo(
    () => payments.filter((p) => isUnifiedPayment(p)).length,
    [payments]
  );

  const confirmedUnified = unifiedBalance?.totalConfirmedBalance ?? "—";
  const pendingUnified = unifiedBalance?.totalPendingBalance ?? "—";

  return (
    <div className="space-y-6 sm:space-y-8">
      <SectionHeader
        eyebrow="Operations"
        title="Payment workspace"
        description="Open Arc payments today, with VeilShield architecture for future hidden-amount closed payments."
        actions={
          <>
            <Button asChild variant="outline" className="h-10">
              <Link to="/app/history">
                <HistoryIcon className="h-4 w-4 mr-2" />
                History
              </Link>
            </Button>

            <Button asChild className="h-10 bg-gradient-brand text-primary-foreground hover:opacity-95">
              <Link to="/app/payments/new">
                <Send className="h-4 w-4 mr-2" />
                New Payment
              </Link>
            </Button>
          </>
        }
      />

      <div className="surface-card p-5 bg-secondary/30">
        <div className="grid gap-5 xl:grid-cols-[1.5fr_1fr] items-start">
          <div>
            <div className="inline-flex items-center gap-2 rounded-md border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground">
              <WalletCards className="h-3.5 w-3.5" />
              Unified Balance USDC enabled
            </div>

            <h2 className="font-display text-xl sm:text-2xl font-semibold mt-4">
              Complete open Arc payments from direct wallet or unified USDC liquidity.
            </h2>

            <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
              Veil lets users deposit USDC into a unified balance, spend into Arc settlement,
              and prepare for audited hidden-amount closed payments through VeilShield.
            </p>
          </div>

          <div className="rounded-xl border bg-background p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-medium">Unified Balance</div>
                <p className="text-xs text-muted-foreground">
                  Latest user-owned balance loaded from this wallet.
                </p>
              </div>

              <Button variant="ghost" size="sm" onClick={loadUnifiedBalance}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                Refresh
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Confirmed</div>
                <div className="text-xl font-semibold">{confirmedUnified}</div>
                <div className="text-xs text-muted-foreground">USDC</div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Pending</div>
                <div className="text-xl font-semibold">{pendingUnified}</div>
                <div className="text-xs text-muted-foreground">USDC</div>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Source: {balanceStatus || "—"}
            </div>
          </div>
        </div>
      </div>

      {ledgerStatus && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
          <div className="font-medium">API ledger unavailable</div>
          <p className="mt-1 text-muted-foreground">{ledgerStatus}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats ? (
          <>
            <StatCard
              label="Total payments"
              value={stats.totalPayments.toLocaleString()}
              hint="live ledger"
              icon={<TrendingUp className="h-5 w-5" />}
            />

            <StatCard
              label="Open payments"
              value={stats.openPayments.toLocaleString()}
              accent="open"
              icon={<ShieldCheck className="h-5 w-5" />}
              hint="visible settlement"
            />

            <StatCard
              label="Closed payments"
              value={stats.confidentialPayments.toLocaleString()}
              accent="confidential"
              icon={<Lock className="h-5 w-5" />}
              hint="hidden amount layer"
            />

            <StatCard
              label="Unified payments"
              value={String(unifiedPayments)}
              icon={<WalletCards className="h-5 w-5" />}
              hint="recent source"
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6 min-w-0">
          <div className="surface-card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="font-display text-lg">Recent payments</h3>
                <p className="text-xs text-muted-foreground">
                  Latest open and closed Arc payment records
                </p>
              </div>

              <Button variant="ghost" size="sm" asChild>
                <Link to="/app/history">
                  View all <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Link>
              </Button>
            </div>

            <div className="divide-y divide-border">
              {payments.length === 0 &&
                Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-5">
                    <Skeleton className="h-10 w-full" />
                  </div>
                ))}

              {payments.map((p) => (
                <Link
                  key={p.id}
                  to="/app/history"
                  className="flex items-center gap-4 px-5 py-4 hover:bg-secondary/40 transition-colors"
                >
                  <div className="h-9 w-9 rounded-full bg-beige flex items-center justify-center text-walnut shrink-0">
                    {p.mode === "confidential" ? (
                      <Lock className="h-4 w-4" />
                    ) : isUnifiedPayment(p) ? (
                      <WalletCards className="h-4 w-4" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <span className="truncate">{p.recipientLabel ?? p.recipient}</span>
                      <ModeBadge mode={p.mode} />
                      <SourceBadge payment={p} />
                    </div>

                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      {p.id} · {formatRelative(p.createdAt)}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-sm font-medium tabular-nums">
                      {formatAmount(p.amount, p.token)}
                    </div>
                    <div className="mt-1">
                      <StatusBadge status={p.status} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <QuickAction
              to="/app/payments/new"
              icon={<Send className="h-4 w-4" />}
              title="New payment"
              desc="Choose mode and source"
            />

            <QuickAction
              to="/app/unified-balance"
              icon={<WalletCards className="h-4 w-4" />}
              title="Unified Balance"
              desc="Deposit and spend USDC"
            />

            <QuickAction
              to="/app/history"
              icon={<HistoryIcon className="h-4 w-4" />}
              title="View history"
              desc="Inspect settlement records"
            />

            <QuickAction
              to="/app/confidential"
              icon={<Lock className="h-4 w-4" />}
              title="Closed records"
              desc="VeilShield references"
              confidential
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="surface-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-4 w-4 text-walnut" />
              <h3 className="font-display text-base">Pending</h3>
              <span className="ml-auto text-xs text-muted-foreground">
                {stats?.pendingCount ?? "—"} awaiting
              </span>
            </div>

            <ul className="space-y-3">
              {payments.filter((p) => p.status === "pending" || p.status === "pending_settlement" || p.status === "pending_veilhub_registration").slice(0, 3).map((p) => (
                <li key={p.id} className="flex items-center gap-3 text-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse-subtle" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate">{p.recipientLabel ?? p.recipient}</div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {formatAmount(p.amount, p.token)}
                    </div>
                  </div>
                  <ModeBadge mode={p.mode} />
                </li>
              ))}

              {payments.filter((p) => p.status === "pending" || p.status === "pending_settlement" || p.status === "pending_veilhub_registration").length === 0 && (
                <li className="text-sm text-muted-foreground">No pending payments.</li>
              )}
            </ul>
          </div>

          <div className="surface-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="h-4 w-4 text-walnut" />
              <h3 className="font-display text-base">Settlement</h3>
            </div>

            <div className="space-y-3 text-sm">
              <Row label="Settled today" value={String(stats?.settledToday ?? "—")} />
              <Row label="Volume (30d)" value={`${stats?.volume30d ?? "—"} USDC`} />
              <Row label="Network" value="Arc Testnet" badge />
            </div>
          </div>

          <div className="surface-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck className="h-4 w-4 text-walnut" />
              <h3 className="font-display text-base">Live deployment</h3>
            </div>

            <div className="space-y-3 text-sm">
              <Row label="Network" value={`${ACTIVE_ARC_DEPLOYMENT.network} (${ACTIVE_ARC_DEPLOYMENT.chainId})`} />

              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">VeilHub</span>
                <a
                  href={getArcExplorerAddressUrl(ACTIVE_ARC_DEPLOYMENT.veilHub)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 items-center gap-1.5 break-all text-right font-mono text-xs underline"
                >
                  {shortAddress(ACTIVE_ARC_DEPLOYMENT.veilHub)}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-muted-foreground">USDC</span>
                <a
                  href={getArcExplorerAddressUrl(ACTIVE_ARC_DEPLOYMENT.usdc)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-w-0 items-center gap-1.5 break-all text-right font-mono text-xs underline"
                >
                  {shortAddress(ACTIVE_ARC_DEPLOYMENT.usdc)}
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </div>
            </div>
          </div>

          <div className="surface-card p-5">
            <div className="flex items-center gap-2 mb-4">
              <KeyRound className="h-4 w-4 text-confidential" />
              <h3 className="font-display text-base">Closed records</h3>
            </div>

            <ul className="space-y-3">
              {activity
                .filter((a) => a.kind === "disclosure" || a.kind === "access")
                .slice(0, 3)
                .map((a) => (
                  <li key={a.id} className="text-sm">
                    <div className="font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.description} · {formatRelative(a.timestamp)}
                    </div>
                  </li>
                ))}

              {activity.filter((a) => a.kind === "disclosure" || a.kind === "access").length === 0 && (
                <li className="text-sm text-muted-foreground">No disclosure activity yet.</li>
              )}
            </ul>

            <Button asChild variant="outline" size="sm" className="w-full mt-4">
              <Link to="/app/access">Manage access</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
