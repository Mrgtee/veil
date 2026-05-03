import { useState } from "react";
import { veilApi } from "@/services/veilApi";

type RouteOption = "eth-to-arc" | "arc-to-eth";
type ModeOption = "open" | "confidential";

export default function Bridge() {
  const [route, setRoute] = useState<RouteOption>("eth-to-arc");
  const [mode, setMode] = useState<ModeOption>("open");
  const [amount, setAmount] = useState("1");
  const [memo, setMemo] = useState("");
  const [recipientLabel, setRecipientLabel] = useState("");
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<any>(null);

  async function submitBridge() {
    try {
      setStatus("Preparing managed bridge...");
      setResult(null);

      const res = await fetch("http://38.49.216.82/api/bridge/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          route,
          amount,
          mode,
          memo,
          recipientLabel
        })
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Bridge failed");
      }

      const steps = Array.isArray(json?.result?.steps) ? json.result.steps : [];
      const txHashes = steps
        .map((step: any) => step?.txHash)
        .filter(Boolean);

      const sourceChain = json?.result?.source?.chain?.name || (route === "eth-to-arc" ? "Ethereum Sepolia" : "Arc Testnet");
      const destinationChain = json?.result?.destination?.chain?.name || (route === "eth-to-arc" ? "Arc Testnet" : "Ethereum Sepolia");

      await veilApi.recordBridge({
        mode,
        amount: json?.result?.amount || amount,
        sourceChain,
        destinationChain,
        recipientLabel: recipientLabel || `${sourceChain} → ${destinationChain}`,
        memo,
        txHashes,
        commitmentId: json?.confidential ? `bridge_${Date.now()}` : null,
      });

      setResult(json);
      setStatus("Bridge submitted successfully");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Bridge failed");
    }
  }

  const steps = Array.isArray(result?.result?.steps) ? result.result.steps : [];

  return (
    <div className="p-6 max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Bridge USDC</h1>
        <p className="text-sm text-muted-foreground">
          Managed bridge execution for moving USDC between Ethereum Sepolia and Arc Testnet.
        </p>
      </div>

      <div className="rounded-xl border p-4 space-y-4">
        <div className="rounded-lg border p-3 text-sm bg-secondary/40">
          <div className="font-medium">Managed bridge mode</div>
          <div className="text-muted-foreground mt-1">
            Veil executes the bridge through managed settlement wallets, then uses the resulting Arc liquidity in payment flows.
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            className={`px-4 py-2 rounded-lg border ${route === "eth-to-arc" ? "bg-primary text-primary-foreground" : ""}`}
            onClick={() => setRoute("eth-to-arc")}
          >
            Ethereum Sepolia → Arc Testnet
          </button>
          <button
            className={`px-4 py-2 rounded-lg border ${route === "arc-to-eth" ? "bg-primary text-primary-foreground" : ""}`}
            onClick={() => setRoute("arc-to-eth")}
          >
            Arc Testnet → Ethereum Sepolia
          </button>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            className={`px-4 py-2 rounded-lg border ${mode === "open" ? "bg-primary text-primary-foreground" : ""}`}
            onClick={() => setMode("open")}
          >
            Open Bridge
          </button>
          <button
            className={`px-4 py-2 rounded-lg border ${mode === "confidential" ? "bg-primary text-primary-foreground" : ""}`}
            onClick={() => setMode("confidential")}
          >
            Confidential Bridge
          </button>
        </div>

        <input
          className="border rounded-lg px-3 py-2 w-full"
          placeholder="Amount in USDC (example: 1.00)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <input
          className="border rounded-lg px-3 py-2 w-full"
          placeholder="Recipient label"
          value={recipientLabel}
          onChange={(e) => setRecipientLabel(e.target.value)}
        />

        <input
          className="border rounded-lg px-3 py-2 w-full"
          placeholder="Memo"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />

        <button className="px-4 py-2 rounded-lg border" onClick={submitBridge}>
          Bridge USDC
        </button>

        {status && <div className="text-sm">{status}</div>}

        {result && (
          <div className="space-y-4">
            <div className="rounded-lg border p-3 text-sm">
              <div><strong>State:</strong> {result.result?.state}</div>
              <div><strong>Amount:</strong> {result.result?.amount} {result.result?.token}</div>
              <div><strong>Source:</strong> {result.result?.source?.chain?.name}</div>
              <div><strong>Destination:</strong> {result.result?.destination?.chain?.name}</div>
              <div><strong>Mode:</strong> {result.mode}</div>
            </div>

            {steps.length > 0 && (
              <div className="rounded-lg border p-3 space-y-3">
                <div className="font-medium">Bridge steps</div>
                {steps.map((step: any, idx: number) => (
                  <div key={idx} className="border rounded-lg p-3 text-sm space-y-1">
                    <div><strong>{step.name}</strong> — {step.state}</div>
                    {step.txHash && (
                      <div className="break-all text-xs">{step.txHash}</div>
                    )}
                    {step.explorerUrl && (
                      <a
                        className="underline block"
                        href={step.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        View in explorer
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            <details className="rounded-lg border p-3">
              <summary className="cursor-pointer font-medium">Raw response</summary>
              <pre className="mt-3 text-xs overflow-auto whitespace-pre-wrap">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
