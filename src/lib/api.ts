import { APP_API_BASE } from "./env";

export async function createConfidentialIntent(payload: {
  recipient: string;
  amount: string;
  memo?: string;
  recipientLabel?: string;
  mode: "open" | "confidential";
}) {
  const res = await fetch(`${APP_API_BASE}/api/confidential/payment-intent`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Failed to create confidential intent");
  }

  return res.json();
}

export async function prepareBatch(payload: {
  csv: string;
  mode: "open" | "confidential";
}) {
  const res = await fetch(`${APP_API_BASE}/api/batch/prepare`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error("Failed to prepare batch");
  }

  return res.json();
}
