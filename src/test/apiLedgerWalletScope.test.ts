import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createPayment,
  getDashboardStats,
  getPayments,
} from "../../apps/api/src/ledger";

const walletA = "0x1111111111111111111111111111111111111111";
const walletB = "0x2222222222222222222222222222222222222222";
const walletC = "0x3333333333333333333333333333333333333333";
const walletD = "0x4444444444444444444444444444444444444444";

let tempDir = "";

function txHash(seed: string) {
  return `0x${seed.repeat(64).slice(0, 64)}`;
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "veil-ledger-test-"));
  process.env.VEIL_LEDGER_PATH = join(tempDir, "ledger.json");
});

afterEach(async () => {
  delete process.env.VEIL_LEDGER_PATH;
  if (tempDir) {
    await rm(tempDir, { recursive: true, force: true });
  }
});

describe("API ledger wallet scoping", () => {
  it("returns dashboard stats for requested wallet-related records", async () => {
    await createPayment({
      type: "single",
      mode: "open",
      source: "arc_direct",
      status: "settled",
      recipient: walletB,
      sender: walletA,
      owner: walletA,
      walletAddress: walletA,
      createdBy: walletA,
      amount: "10",
      amountBase: "10000000",
      txHash: txHash("a"),
    });

    await createPayment({
      type: "single",
      mode: "open",
      source: "unified_balance",
      status: "settled",
      recipient: walletA,
      owner: walletB,
      walletAddress: walletB,
      createdBy: walletB,
      unifiedBalanceOwner: walletB,
      amount: "25",
      amountBase: "25000000",
      txHash: txHash("b"),
    });

    const aStats = await getDashboardStats(walletA.toUpperCase());
    const bStats = await getDashboardStats(walletB);
    const dStats = await getDashboardStats(walletD);

    expect(aStats.totalPayments).toBe(2);
    expect(aStats.volume30d).toBe("35.0000");
    expect(bStats.totalPayments).toBe(2);
    expect(bStats.volume30d).toBe("35.0000");
    expect(dStats.totalPayments).toBe(0);
  });

  it("excludes records without matching wallet ownership or recipient fields", async () => {
    await createPayment({
      type: "single",
      mode: "open",
      source: "arc_direct",
      status: "settled",
      recipient: walletC,
      sender: walletA,
      owner: walletA,
      walletAddress: walletA,
      createdBy: walletA,
      amount: "1",
      amountBase: "1000000",
      txHash: txHash("c"),
    });

    await createPayment({
      type: "single",
      mode: "open",
      source: "arc_direct",
      status: "settled",
      recipient: walletA,
      sender: walletB,
      owner: walletB,
      walletAddress: walletB,
      createdBy: walletB,
      amount: "2",
      amountBase: "2000000",
      txHash: txHash("d"),
    });

    const walletCRecords = await getPayments(walletC);
    const walletBRecords = await getPayments(walletB.toUpperCase());

    expect(walletCRecords).toHaveLength(1);
    expect(walletCRecords[0].sender).toBe(walletA);
    expect(walletBRecords).toHaveLength(1);
    expect(walletBRecords[0].sender).toBe(walletB);
  });

  it("matches batch sender and recipient lists case-insensitively", async () => {
    await createPayment({
      type: "batch",
      mode: "open",
      source: "arc_direct",
      status: "settled",
      recipient: "2 recipients",
      recipients: [walletB, walletC.toUpperCase()],
      sender: walletA,
      owner: walletA,
      walletAddress: walletA,
      createdBy: walletA,
      batchSender: walletA,
      amount: "3",
      amountBase: "3000000",
      txHash: txHash("e"),
      batchId: `0x${"e".repeat(64)}`,
      batchCount: 2,
    });

    expect(await getPayments(walletA.toUpperCase())).toHaveLength(1);
    expect(await getPayments(walletC.toLowerCase())).toHaveLength(1);
    expect(await getPayments(walletD)).toHaveLength(0);
  });
});
