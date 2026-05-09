import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Eye,
  History as HistoryIcon,
  Layers,
  Lock,
  RefreshCw,
  Send,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentDetailsDrawer } from "@/components/veil/PaymentDetailsDrawer";
import { veilApi } from "@/services/veilApi";
import type { DashboardStats, Payment, PaymentStatus } from "@/types/veil";
import type { UnifiedBalanceData } from "@/lib/payments/unifiedBalance";
import { formatAmount, formatRelative, truncateAddress } from "@/lib/format";
import { getPaymentSourceLabel, isUnifiedPaymentSource } from "@/lib/payments/types";
import { cn } from "@/lib/utils";

type ExtendedPayment = Payment & {
  liquiditySource?: string;
  sourceChain?: string;
};

type Tone = "success" | "warning" | "danger" | "neutral";

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

function getLiquiditySource(payment: ExtendedPayment) {
  const raw = payment.liquiditySource || payment.source || payment.sourceChain;
  return getPaymentSourceLabel(raw, {
    sequential: payment.type === "batch" && isUnifiedPaymentSource(raw || payment.source),
  });
}

function getPaymentName(payment: ExtendedPayment) {
  if (payment.operation === "shield_deposit") return "Experimental private deposit";
  if (payment.operation === "shield_transfer") return "Experimental private transfer";
  if (payment.operation === "shield_withdraw") return "Experimental private withdraw";
  if (payment.type === "batch") return payment.recipientLabel || "Batch payment";
  return payment.recipientLabel || truncateAddress(payment.recipient);
}

function getPaymentDetail(payment: ExtendedPayment) {
  if (payment.type === "batch") {
    return payment.batchCount ? `${payment.batchCount} recipients` : "Multiple recipients";
  }

  return truncateAddress(payment.recipient);
}

function getStatusTone(status: PaymentStatus): Tone {
  if (status === "settled") return "success";
  if (status === "failed") return "danger";
  if (status === "pending" || status === "pending_settlement" || status === "pending_veilhub_registration") {
    return "warning";
  }
  return "neutral";
}

function getStatusLabel(status: PaymentStatus) {
  switch (status) {
    case "settled":
      return "Settled";
    case "pending_settlement":
      return "Pending settlement";
    case "pending_veilhub_registration":
      return "Pending registration";
    case "failed":
      return "Failed";
    case "pending":
      return "Pending";
    default:
      return status.replaceAll("_", " ");
  }
}

function formatUnifiedBalance(balance: UnifiedBalanceData | null) {
  if (!balance?.totalConfirmedBalance) return "—";
  return formatAmount(balance.totalConfirmedBalance, "USDC");
}

function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-md border px-2 py-1 text-xs font-medium",
        tone === "success" && "border-success/20 bg-success/10 text-success",
        tone === "warning" && "border-warning/30 bg-warning/10 text-warning",
        tone === "danger" && "border-destructive/25 bg-destructive/10 text-destructive",
        tone === "neutral" && "border-sand bg-beige/70 text-walnut"
      )}
    >
      {children}
    </span>
  );
}

function Metric({
  label,
  value,
  caption,
  icon,
  action,
}: {
  label: string;
  value: string;
  caption: string;
  icon: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="surface-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 truncate font-display text-3xl font-semibold tabular-nums">{value}</div>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-beige text-walnut">
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{caption}</span>
        {action}
      </div>
    </div>
  );
}

function RailStatus({ icon, label, value, tone }: { icon: ReactNode; label: string; value: string; tone: Tone }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-beige text-walnut">
          {icon}
        </div>
        <span className="truncate text-sm font-medium">{label}</span>
      </div>
      <Pill tone={tone}>{value}</Pill>
    </div>
  );
}

export default function Dashboard() {
  const { address } = useAccount();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [payments, setPayments] = useState<ExtendedPayment[]>([]);
  const [activePayment, setActivePayment] = useState<Payment | null>(null);
  const [unifiedBalance, setUnifiedBalance] = useState<UnifiedBalanceData | null>(null);
  const [balanceStatus, setBalanceStatus] = useState("");
  const [ledgerStatus, setLedgerStatus] = useState("");

  const loadUnifiedBalance = useCallback(() => {
    const cached = readUnifiedBalanceCache(address);

    if (cached) {
      setUnifiedBalance(cached);
      setBalanceStatus("Wallet cache");
      return;
    }

    setUnifiedBalance(null);
    setBalanceStatus("Open Unified USDC to load");
  }, [address]);

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        setLedgerStatus("");
        const [nextStats, nextPayments] = await Promise.all([
          veilApi.getDashboardStats(),
          veilApi.listPayments(),
        ]);

        if (cancelled) return;
        setStats(nextStats);
        setPayments(nextPayments as ExtendedPayment[]);
      } catch (err) {
        if (cancelled) return;
        setLedgerStatus(err instanceof Error ? err.message : "Veil API ledger is unavailable.");
        setStats(null);
        setPayments([]);
      }
    }

    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    loadUnifiedBalance();
  }, [loadUnifiedBalance]);

  const recentPayments = useMemo(() => payments.slice(0, 7), [payments]);
  const settledPayments = useMemo(
    () => payments.filter((payment) => payment.status === "settled").length,
    [payments]
  );
  const pendingPayments = stats?.pendingCount ?? payments.filter((payment) => getStatusTone(payment.status) === "warning").length;
  const unifiedValue = formatUnifiedBalance(unifiedBalance);

  return (
    <div className="space-y-6 xl:-mx-2 2xl:-mx-8">
      <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="overflow-hidden rounded-lg border border-cocoa/15 bg-gradient-card p-6 shadow-sm sm:p-8">
          <div className="flex min-h-[280px] flex-col justify-between gap-8">
            <div className="space-y-5">
              <Pill tone="success">Open payments live</Pill>
              <div className="max-w-3xl space-y-3">
                <h1 className="font-display text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
                  Open and Private Payment
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground">
                  Send USDC on Arc with VeilHub, Arc Direct, and Circle Unified USDC Balance. Private Payment is coming soon with Arc Private Kit.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild className="bg-gradient-brand text-primary-foreground hover:opacity-95">
                <Link to="/app/payments/new">
                  <Send className="mr-2 h-4 w-4" />
                  Send Payment
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/app/batch">
                  <Layers className="mr-2 h-4 w-4" />
                  Submit Batch
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link to="/app/unified-balance">
                  Unified USDC
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="surface-card p-5">
          <div className="mb-4">
            <h2 className="font-display text-xl font-semibold">Payment rails</h2>
            <p className="mt-1 text-sm text-muted-foreground">Current product state.</p>
          </div>
          <div className="space-y-3">
            <RailStatus icon={<ShieldCheck className="h-4 w-4" />} label="Arc Direct via VeilHub" value="Live" tone="success" />
            <RailStatus icon={<WalletCards className="h-4 w-4" />} label="Circle Unified USDC Balance" value="Available" tone="success" />
            <RailStatus icon={<Lock className="h-4 w-4" />} label="Private Payment" value="Coming soon" tone="neutral" />
          </div>
        </div>
      </section>

      {ledgerStatus && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
          <div className="font-medium">API ledger unavailable</div>
          <p className="mt-1 text-muted-foreground">{ledgerStatus}</p>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats ? (
          <>
            <Metric
              label="Total volume"
              value={formatAmount(stats.volume30d, "USDC")}
              caption="30d ledger volume"
              icon={<Send className="h-5 w-5" />}
            />
            <Metric
              label="Successful payments"
              value={String(settledPayments)}
              caption={`${stats.openPayments} open payments`}
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <Metric
              label="Pending payments"
              value={String(pendingPayments)}
              caption="Settlement or registration"
              icon={<Clock3 className="h-5 w-5" />}
            />
            <Metric
              label="Unified USDC Balance"
              value={unifiedValue}
              caption={balanceStatus || "Connected wallet"}
              icon={<WalletCards className="h-5 w-5" />}
              action={
                <button
                  type="button"
                  onClick={loadUnifiedBalance}
                  className="inline-flex items-center gap-1 text-xs font-medium text-walnut hover:text-espresso"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </button>
              }
            />
          </>
        ) : (
          Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-lg" />
          ))
        )}
      </section>

      <section className="surface-card overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">Recent payments</h2>
            <p className="text-sm text-muted-foreground">Latest API ledger activity.</p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/history">
              <HistoryIcon className="mr-2 h-4 w-4" />
              View History
            </Link>
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="border-b bg-secondary/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3 text-left font-medium">Payment</th>
                <th className="px-5 py-3 text-left font-medium">Source</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-5 py-3 text-left font-medium">Status</th>
                <th className="px-5 py-3 text-left font-medium">Time</th>
                <th className="px-5 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {!stats && !ledgerStatus &&
                Array.from({ length: 5 }).map((_, index) => (
                  <tr key={index}>
                    <td colSpan={6} className="px-5 py-4">
                      <Skeleton className="h-10 w-full" />
                    </td>
                  </tr>
                ))}

              {stats && recentPayments.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <div className="font-medium">No payments yet</div>
                    <div className="mt-1 text-sm text-muted-foreground">Send an Open Payment to start the ledger.</div>
                  </td>
                </tr>
              )}

              {recentPayments.map((payment) => (
                <tr key={payment.id} className="transition-colors hover:bg-secondary/35">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-beige text-walnut">
                        {payment.type === "batch" ? (
                          <Layers className="h-4 w-4" />
                        ) : isUnifiedPaymentSource(payment.source) ? (
                          <WalletCards className="h-4 w-4" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{getPaymentName(payment)}</div>
                        <div className="truncate text-xs text-muted-foreground">{getPaymentDetail(payment)}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">{getLiquiditySource(payment)}</td>
                  <td className="px-5 py-4 text-right font-medium tabular-nums">
                    {payment.amountHidden ? "Hidden amount" : formatAmount(payment.amount, payment.token)}
                  </td>
                  <td className="px-5 py-4">
                    <Pill tone={getStatusTone(payment.status)}>{getStatusLabel(payment.status)}</Pill>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">{formatRelative(payment.createdAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setActivePayment(payment)}>
                      <Eye className="mr-1.5 h-3.5 w-3.5" />
                      Details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <PaymentDetailsDrawer payment={activePayment} onClose={() => setActivePayment(null)} />
    </div>
  );
}
