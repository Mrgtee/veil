export function getErrorMessage(err: unknown, fallback = "Something went wrong") {
  if (err instanceof Error && err.message) return err.message;

  if (typeof err === "object" && err !== null) {
    const errorLike = err as Record<string, unknown>;
    const cause = errorLike.cause && typeof errorLike.cause === "object"
      ? (errorLike.cause as Record<string, unknown>)
      : {};

    return (
      String(
        errorLike.shortMessage ||
          errorLike.details ||
          errorLike.message ||
          cause.shortMessage ||
          cause.message ||
          fallback
      ) ||
      fallback
    );
  }

  return fallback;
}

export function isSettlementDelay(err: unknown) {
  const message = getErrorMessage(err, "").toLowerCase();

  return (
    message.includes("still waiting") ||
    message.includes("still finalizing") ||
    message.includes("mint failure") ||
    message.includes("eth_getblockbynumber") ||
    message.includes("request timed out") ||
    message.includes("took too long")
  );
}

export function formatPaymentError(err: unknown, fallback = "Payment failed") {
  const message = getErrorMessage(err, fallback);
  const lower = message.toLowerCase();

  if (lower.includes("transfer spec has already been used")) {
    return "This Unified Balance approval was already submitted or expired. Refresh the balance and submit again to create a fresh wallet approval.";
  }

  if (isSettlementDelay(message)) {
    return "Arc settlement confirmation did not return in time. Check History for any pending record, refresh Unified Balance, and avoid resubmitting until the balance state is clear.";
  }

  if (lower.includes("user rejected") || lower.includes("rejected the request")) {
    return "The wallet request was rejected. No payment was submitted.";
  }

  if (lower.includes("insufficient allowance")) {
    return "USDC allowance is not high enough for VeilHub. Approve the requested USDC allowance and submit again.";
  }

  if (lower.includes("insufficient funds") || lower.includes("below this payment amount") || lower.includes("below the batch total")) {
    return "The connected wallet does not have enough spendable USDC for this payment.";
  }

  if (lower.includes("execution reverted") || lower.includes("contract function execution reverted")) {
    return `VeilHub rejected the transaction: ${message}`;
  }

  if (lower.includes("veil api is unavailable")) {
    return message;
  }

  return message || fallback;
}
