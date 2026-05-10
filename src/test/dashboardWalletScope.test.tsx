import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Dashboard from "@/pages/Dashboard";
import type { DashboardStats, Payment } from "@/types/veil";

const walletA = "0x1111111111111111111111111111111111111111";
const walletB = "0x2222222222222222222222222222222222222222";

const mocks = vi.hoisted(() => ({
  address: "0x1111111111111111111111111111111111111111",
  getDashboardStats: vi.fn(),
  listPayments: vi.fn(),
  readUnifiedBalance: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: mocks.address }),
}));

vi.mock("@/services/veilApi", () => ({
  veilApi: {
    getDashboardStats: mocks.getDashboardStats,
    listPayments: mocks.listPayments,
  },
}));

vi.mock("@/lib/payments/unifiedBalance", () => ({
  readUnifiedBalance: mocks.readUnifiedBalance,
}));

function stats(totalPayments: number): DashboardStats {
  return {
    totalPayments,
    openPayments: totalPayments,
    confidentialPayments: 0,
    batchPayments: 0,
    pendingCount: 0,
    settledToday: totalPayments,
    volume30d: totalPayments ? "1.0000" : "0.0000",
  };
}

function paymentFor(wallet: string): Payment {
  return {
    id: `pmt_${wallet.slice(2, 6)}`,
    type: "single",
    mode: "open",
    source: "arc_direct",
    status: "settled",
    recipient: "0x3333333333333333333333333333333333333333",
    sender: wallet,
    owner: wallet,
    walletAddress: wallet,
    createdBy: wallet,
    recipientLabel: "Wallet A payment",
    amount: "1",
    amountBase: "1000000",
    token: "USDC",
    txHash: `0x${"a".repeat(64)}`,
    createdAt: new Date().toISOString(),
    liquiditySource: "Arc Direct via VeilHub",
  };
}

function renderDashboard() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

describe("Dashboard wallet scoping", () => {
  beforeEach(() => {
    mocks.address = walletA;
    mocks.getDashboardStats.mockReset();
    mocks.listPayments.mockReset();
    mocks.readUnifiedBalance.mockReset();
    mocks.readUnifiedBalance.mockResolvedValue({
      totalConfirmedBalance: "0",
      totalPendingBalance: "0",
      breakdown: [],
    });
    localStorage.clear();
  });

  it("reloads wallet-scoped dashboard data when the connected wallet changes", async () => {
    mocks.getDashboardStats.mockImplementation((wallet?: string) =>
      Promise.resolve(stats(wallet === walletA ? 1 : 0))
    );
    mocks.listPayments.mockImplementation((wallet?: string) =>
      Promise.resolve(wallet === walletA ? [paymentFor(walletA)] : [])
    );

    const view = renderDashboard();

    await waitFor(() => expect(mocks.getDashboardStats).toHaveBeenCalledWith(walletA));
    expect(await screen.findByText("Wallet A payment")).toBeInTheDocument();

    mocks.address = walletB;
    view.rerender(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );

    await waitFor(() => expect(mocks.getDashboardStats).toHaveBeenLastCalledWith(walletB));
    expect(await screen.findByText("No payments yet for this wallet.")).toBeInTheDocument();
    expect(screen.queryByText("Wallet A payment")).not.toBeInTheDocument();
  });
});
