import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, ShieldCheck, WalletCards, Lock } from "lucide-react";
import { VeilWordmark } from "@/components/brand/VeilLogo";

const ARC_TESTNET = {
  chainIdHex: "0x4CEF52",
  chainName: "Arc Testnet",
  rpcUrl: "https://rpc.testnet.arc.network",
  explorer: "https://testnet.arcscan.app",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
};

async function ensureArcTestnet() {
  const eth = (window as any).ethereum;

  if (!eth) {
    throw new Error("No wallet found. Please open Veil in a wallet-enabled browser.");
  }

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC_TESTNET.chainIdHex }],
    });
  } catch (err: any) {
    if (err?.code === 4902) {
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: ARC_TESTNET.chainIdHex,
            chainName: ARC_TESTNET.chainName,
            rpcUrls: [ARC_TESTNET.rpcUrl],
            nativeCurrency: ARC_TESTNET.nativeCurrency,
            blockExplorerUrls: [ARC_TESTNET.explorer],
          },
        ],
      });
      return;
    }

    throw err;
  }
}

export default function SignIn() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function connectWallet() {
    try {
      setLoading(true);
      setStatus("Connecting wallet...");

      const eth = (window as any).ethereum;

      if (!eth) {
        throw new Error("No wallet detected. Open Veil inside MetaMask, Rabby, Rainbow, OKX Wallet, or another EVM wallet browser.");
      }

      const accounts = await eth.request({ method: "eth_requestAccounts" });
      const account = accounts?.[0];

      if (!account) {
        throw new Error("Wallet connection failed.");
      }

      localStorage.setItem("veil.wallet", account);
      localStorage.setItem("veil.operator", account);

      setStatus("Wallet connected. Opening Veil...");
      navigate("/app");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unable to connect wallet. Please open Veil inside a wallet browser.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-2">
        <section className="hidden lg:flex relative overflow-hidden bg-gradient-to-br from-[#2b1f18] via-[#5a3724] to-[#8a5a36] text-white">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,white,transparent_25%),radial-gradient(circle_at_80%_70%,white,transparent_20%)]" />

          <div className="relative z-10 flex min-h-screen flex-col justify-between p-10 xl:p-12">
            <div className="[&_span]:text-white">
              <VeilWordmark size="lg" />
            </div>

            <div className="max-w-xl">
              <div className="mb-5 text-xs uppercase tracking-[0.35em] text-white/60">
                Unified settlement
              </div>

              <h1 className="font-display text-5xl leading-tight font-semibold">
                Open and private payments on Arc, powered by Unified Balance USDC.
              </h1>

              <p className="mt-6 max-w-lg text-base leading-7 text-white/75">
                Veil lets users spend unified USDC into Arc payments while protecting sensitive payment context when privacy is needed.
              </p>

              <div className="mt-8 grid gap-4 text-sm text-white/80">
                <div className="flex items-center gap-3">
                  <WalletCards className="h-4 w-4" />
                  Unified Balance USDC for payment-ready liquidity.
                </div>

                <div className="flex items-center gap-3">
                  <ShieldCheck className="h-4 w-4" />
                  Open payments for transparent settlement.
                </div>

                <div className="flex items-center gap-3">
                  <Lock className="h-4 w-4" />
                  Private payments for protected memo, label, and reference context.
                </div>
              </div>
            </div>

            <div className="text-sm text-white/55">
              Built on Arc · Veil © 2026
            </div>
          </div>
        </section>

        <section className="flex min-h-screen items-start justify-center px-5 py-10 sm:items-center sm:px-6 sm:py-12">
          <div className="w-full max-w-md space-y-6 sm:space-y-8">
            <div className="text-center space-y-3 sm:space-y-4">
              <div className="mx-auto flex items-center justify-center [&_span]:text-3xl">
                <VeilWordmark size="lg" />
              </div>

              <div className="space-y-2">
                <h2 className="font-display text-3xl sm:text-4xl font-semibold">
                  Sign in to Veil
                </h2>

                <p className="text-muted-foreground">
                  Connect your wallet to access open and private Arc payments powered by Unified Balance USDC.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-5 shadow-sm space-y-5">
              <button
                onClick={connectWallet}
                disabled={loading}
                className="flex h-14 w-full items-center justify-center gap-3 rounded-xl bg-gradient-brand px-4 font-medium text-primary-foreground transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Wallet className="h-5 w-5" />
                {loading ? "Connecting..." : "Connect wallet"}
              </button>

              <div className="rounded-xl border bg-secondary/40 p-4 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">What Veil does</div>
                <p className="mt-1">
                  Veil helps you complete open or private payments on Arc using Unified Balance USDC.
                </p>
              </div>

              {status && (
                <div className="rounded-xl border bg-background p-3 text-sm">
                  {status}
                </div>
              )}
            </div>

            <p className="text-center text-xs leading-5 text-muted-foreground">
              By connecting, you acknowledge that Veil uses your wallet address to create your payment workspace.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
