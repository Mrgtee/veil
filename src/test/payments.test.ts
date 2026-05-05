import { describe, expect, it } from "vitest";
import { cleanBatchRows, getBatchTotal, parseUsdcAmount } from "@/lib/payments/arcDirect";
import { getLedgerSource } from "@/lib/payments/recording";
import { getPaymentSourceLabel } from "@/lib/payments/types";

describe("payment helpers", () => {
  it("validates and trims form-based batch rows", () => {
    const rows = cleanBatchRows([
      {
        id: "row_1",
        recipient: " 0x0000000000000000000000000000000000000001 ",
        amount: " 12.50 ",
        recipientLabel: " Treasury ",
        memo: " Invoice 42 ",
      },
    ]);

    expect(rows).toEqual([
      {
        id: "row_1",
        recipient: "0x0000000000000000000000000000000000000001",
        amount: "12.50",
        recipientLabel: "Treasury",
        memo: "Invoice 42",
      },
    ]);
  });

  it("rejects empty or invalid batch rows", () => {
    expect(() => cleanBatchRows([])).toThrow("Add at least one recipient");
    expect(() =>
      cleanBatchRows([
        {
          id: "row_1",
          recipient: "not-an-address",
          amount: "1",
          recipientLabel: "",
          memo: "",
        },
      ])
    ).toThrow("invalid wallet address");
  });

  it("computes totals and USDC base units without payment side effects", () => {
    expect(getBatchTotal([
      { id: "a", recipient: "", amount: "1.25", recipientLabel: "", memo: "" },
      { id: "b", recipient: "", amount: "2.75", recipientLabel: "", memo: "" },
    ])).toBe("4");

    expect(parseUsdcAmount("1.5", 6)).toBe(1_500_000n);
  });

  it("maps UI sources to ledger source enums", () => {
    expect(getLedgerSource("arc-direct")).toBe("arc_direct");
    expect(getLedgerSource("unified-balance")).toBe("unified_balance");
  });

  it("labels live Arc Direct payments as VeilHub-routed", () => {
    expect(getPaymentSourceLabel("arc-direct")).toBe("Arc Direct via VeilHub");
    expect(getPaymentSourceLabel("arc_direct")).toBe("Arc Direct via VeilHub");
    expect(getPaymentSourceLabel("Arc Direct")).toBe("Arc Direct via VeilHub");
    expect(getPaymentSourceLabel("unified_balance")).toBe("Unified Balance USDC");
  });
});
