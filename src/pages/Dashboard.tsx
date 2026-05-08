import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  DollarSign,
  ExternalLink,
  Eye,
  History as HistoryIcon,
  Layers,
  Lock,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PaymentDetailsDrawer } from "@/components/veil/PaymentDetailsDrawer";
import { veilApi } from "@/services/veilApi";
import type { DashboardStats, Payment, PaymentStatus } from "@/types/veil";
import type { UnifiedBalanceData } from "@/lib/payments/unifiedBalance";
import { ACTIVE_ARC_DEPLOYMENT, getArcExplorerAddressUrl, shortAddress } from "@/lib/deployment";
import { formatAmount, formatRelative, truncateAddress } from "@/lib/format";
import { getPaymentSourceLabel, isUnifiedPaymentSource } from "@/lib/payments/types";
import { cn } from "@/lib/utils";

type ExtendedPayment = Payment & {
  liquiditySource?: string;
  sourceChain?: string;
  destinationChain?: string;
};

type StatusTone = "success" | "warning" | "danger" | "neutral";

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

function paymentTitle(payment: ExtendedPayment) {
  if (payment.operation === "shield_deposit") return "Experimental private deposit";
  if (payment.operation === "shield_transfer") return "Experimental private transfer";
  if (payment.operation === "shield_withdraw") return "Experimental private withdraw";
  if (payment.type === "batch") {
    return payment.recipientLabel || `Batch payment${payment.batchCount ? ` (${payment.batchCount})` : ""}`;
  }

  return payment.recipientLabel || truncateAddress(payment.recipient);
}

function paymentSubtitle(payment: ExtendedPayment) {
  if (payment.type === "batch") {
    return payment.batchCount ? `${payment.batchCount} recipients` : "Batch payment";
  }

  return payment.recipient;
}

function statusLabel(status: PaymentStatus) {
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

function statusTone(status: PaymentStatus): StatusTone {
  if (status === "settled") return "success";
  if (status === "failed") return "danger";
  if (status === "pending" || status === "pending_settlement" || status === "pending_veilhub_registration") {
    return "warning";
  }
  return "neutral";
}

function formatUnifiedBalance(balance: UnifiedBalanceData | null) {
  if (!balance?.totalConfirmedBalance) return "—";
  return formatAmount(balance.totalConfirmedBalance, "USDC");
}

function StatusPill({ children, tone = "neutral" }: { children: ReactNode; tone?: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center rounded-md border px-2 py-1 text-xs font-medium capitalize",
        tone === "success" && "border-success/20 bg-success/10 text-success",
        tone === "warning" && "border-warning/30 bg-warning/10 text-warning",
        tone === "danger" && "border-destructive/25 bg-destructive/10 text-destructive",
        tone === "neutral" && "border-sand bg-beige/60 text-walnut"
      )}
    >
      {children}
    </span>
  );
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  primary,
  action,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  primary?: boolean;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "surface-card p-5",
        primary
          ? "bg-gradient-card md:col-span-2 xl:col-span-1"
          : "bg-card"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className={cn("mt-2 font-display font-semibold tabular-nums", primary ? "text-4xl" : "text-3xl")}>
            {value}
          </div>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-beige text-walnut">
          {icon}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{hint}</span>
        {action}
      </div>
    </div>
  );
}

function SystemRow({
  icon,
  label,
  value,
  description,
  tone = "neutral",
  href,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  description: string;
  tone?: StatusTone;
  href?: string;
}) {
  return (
    <div className="flex gap-3 rounded-lg border bg-background/70 p-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-beige text-walnut">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <div className="font-medium">{label}</div>
          <StatusPill tone={tone}>{value}</StatusPill>
        </div>
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 font-mono text-xs text-walnut underline-offset-4 hover:underline"
          >
            {shortAddress(href.split("/").pop() || "")}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
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
        const message = err instanceof Error ? err.message : "Veil API ledger is unavailable.";
        setLedgerStatus(message);
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

  const recentPayments = useMemo(() => payments.slice(0, 6), [payments]);
  const successfulPayments = useMemo(
    () => payments.filter((payment) => payment.status === "settled").length,
    [payments]
  );
  const pendingPayments = stats?.pendingCount ?? payments.filter((payment) => statusTone(payment.status) === "warning").length;
  const ledgerHealth = ledgerStatus ? "Unavailable" : stats ? "Online" : "Checking";
  const ledgerTone: StatusTone = ledgerStatus ? "danger" : stats ? "success" : "neutral";
  const unifiedValue = formatUnifiedBalance(unifiedBalance);

  return (
    <div className="space-y-5 xl:-mx-2 2xl:-mx-6">
      <section className="overflow-hidden rounded-lg border border-cocoa/20 bg-gradient-brand text-primary-foreground shadow-md">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1fr_360px] lg:p-7">
          <div className="flex min-w-0 flex-col justify-between gap-8">
            <div className="space-y-4">
              <div className="inline-flex w-fit items-center gap-2 rounded-md border border-white/15 bg-white/10 px-3 py-1 text-sm text-white/85">
                <span className="h-2 w-2 rounded-full bg-success" />
                Open payments live on Arc Testnet
              </div>

              <div className="max-w-3xl space-y-3">
                <h1 className="font-display text-3xl font-semibold leading-tight sm:text-5xl">
                  Real USDC payments, tracked through VeilHub.
                </h1>
                <p className="max-w-2xl text-base leading-7 text-white/75">
                  Arc Direct routes through VeilHub. Unified USDC Balance is available. Private Payment is coming soon with Arc Private Kit.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button asChild className="bg-white text-espresso hover:bg-white/90">
                <Link to="/app/payments/new">
                  <Send className="mr-2 h-4 w-4" />
                  New Payment
                </Link>
              </Button>
              <Button asChild variant="outline" className="border-white/25 bg-white/10 text-white hover:bg-white/15 hover:text-white">
                <Link to="/app/batch">
                  <Layers className="mr-2 h-4 w-4" />
                  Submit Batch
                </Link>
              </Button>
              <Button asChild variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
                <Link to="/app/history">
                  View History
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>

          <div className="rounded-lg border border-white/15 bg-white/10 p-4 backdrop-blur">
            <div className="mb-4 text-sm font-medium text-white/80">Payment rails</div>
            <div className="space-y-3">
              <HeroRail icon={<ShieldCheck className="h-4 w-4" />} label="Arc Direct" value="VeilHub" />
              <HeroRail icon={<WalletCards className="h-4 w-4" />} label="Unified USDC" value="Available" />
              <HeroRail icon={<Lock className="h-4 w-4" />} label="Private Payment" value="Arc Private Kit soon" />
            </div>
          </div>
        </div>
      </section>

      {ledgerStatus && (
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-3 text-sm">
          <div className="font-medium">API ledger unavailable</div>
          <p className="mt-1 text-muted-foreground">{ledgerStatus}</p>
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_1fr]">
        {stats ? (
          <>
            <MetricCard
              primary
              label="Total volume"
              value={formatAmount(stats.volume30d, "USDC")}
              hint="30d API ledger"
              icon={<DollarSign className="h-5 w-5" />}
            />
            <MetricCard
              label="Successful payments"
              value={String(successfulPayments)}
              hint="Settled ledger records"
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <MetricCard
              label="Pending payments"
              value={String(pendingPayments)}
              hint="Needs finalization"
              icon={<Clock3 className="h-5 w-5" />}
            />
            <MetricCard
              label="Unified USDC Balance"
              value={unifiedValue}
              hint={balanceStatus || "Connected wallet"}
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
            <Skeleton key={index} className="h-36 rounded-lg" />
          ))
        )}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="surface-card overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-xl font-semibold">Recent payments</h2>
              <p className="text-sm text-muted-foreground">Clean settlement view. Details hold tx hashes and IDs.</p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/app/history">
                <HistoryIcon className="mr-2 h-4 w-4" />
                View History
              </Link>
            </Button>
          </div>

          <div className="divide-y divide-border">
            {!stats && !ledgerStatus &&
              Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="p-5">
                  <Skeleton className="h-12 w-full" />
                </div>
              ))}

            {stats && recentPayments.length === 0 && (
              <div className="px-5 py-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-lg bg-beige text-walnut">
                  <Send className="h-5 w-5" />
                </div>
                <div className="mt-3 font-medium">No payments yet</div>
                <p className="mt-1 text-sm text-muted-foreground">Send an Open Payment to start the ledger.</p>
              </div>
            )}

            {recentPayments.map((payment) => (
              <div
                key={payment.id}
                className="grid gap-3 px-5 py-4 transition-colors hover:bg-secondary/35 lg:grid-cols-[minmax(0,1.45fr)_minmax(180px,0.8fr)_150px_130px_110px]"
              >
                <div className="min-w-0">
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
                      <div className="truncate font-medium">{paymentTitle(payment)}</div>
                      <div className="truncate text-sm text-muted-foreground">{paymentSubtitle(payment)}</div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center text-sm text-muted-foreground">
                  {getLiquiditySource(payment)}
                </div>

                <div className="flex items-center font-medium tabular-nums">
                  {payment.amountHidden ? "Hidden amount" : formatAmount(payment.amount, payment.token)}
                </div>

                <div className="flex items-center">
                  <StatusPill tone={statusTone(payment.status)}>{statusLabel(payment.status)}</StatusPill>
                </div>

                <div className="flex items-center justify-between gap-3 lg:justify-end">
                  <span className="text-sm text-muted-foreground">{formatRelative(payment.createdAt)}</span>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setActivePayment(payment)}>
                    <Eye className="mr-1.5 h-3.5 w-3.5" />
                    Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <aside className="surface-card h-fit p-5 xl:sticky xl:top-24">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold">System Status</h2>
              <p className="text-sm text-muted-foreground">Live rails and setup health.</p>
            </div>
            <Server className="h-5 w-5 text-walnut" />
          </div>

          <div className="space-y-3">
            <SystemRow
              icon={<Server className="h-4 w-4" />}
              label="API ledger"
              value={ledgerHealth}
              tone={ledgerTone}
              description="Dashboard and History read real API records."
            />
            <SystemRow
              icon={<ShieldCheck className="h-4 w-4" />}
              label="Arc Direct"
              value="Live"
              tone="success"
              description="Open payments route through VeilHub."
              href={getArcExplorerAddressUrl(ACTIVE_ARC_DEPLOYMENT.veilHub)}
            />
            <SystemRow
              icon={<WalletCards className="h-4 w-4" />}
              label="Unified USDC Balance"
              value="Available"
              tone="success"
              description="Wallet-owned deposits, balance reads, and spends."
            />
            <SystemRow
              icon={<Lock className="h-4 w-4" />}
              label="Private Payment"
              value="Coming soon"
              tone="neutral"
              description="Preparing native Arc Private Kit integration."
            />
            <SystemRow
              icon={<ExternalLink className="h-4 w-4" />}
              label="Network"
              value="Arc Testnet"
              tone="success"
              description={`Chain ID ${ACTIVE_ARC_DEPLOYMENT.chainId}; USDC ${shortAddress(ACTIVE_ARC_DEPLOYMENT.usdc)}.`}
              href={getArcExplorerAddressUrl(ACTIVE_ARC_DEPLOYMENT.usdc)}
            />
          </div>
        </aside>
      </section>

      <PaymentDetailsDrawer payment={activePayment} onClose={() => setActivePayment(null)} />
    </div>
  );
}

function HeroRail({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/10 px-3 py-2">
      <div className="flex min-w-0 items-center gap-2 text-white/85">
        {icon}
        <span className="truncate text-sm">{label}</span>
      </div>
      <span className="shrink-0 text-sm font-medium text-white">{value}</span>
    </div>
  );
}
