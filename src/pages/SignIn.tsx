import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, ShieldCheck, WalletCards, Lock } from "lucide-react";
import { VeilWordmark } from "@/components/brand/VeilLogo";
import { requestWalletAccount } from "@/lib/payments/wallet";

export default function SignIn() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function connectWallet() {
    try {
      setLoading(true);
      setStatus("Connecting wallet...");

      await requestWalletAccount({ request: true });

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
        <section className="hidden lg:flex bg-gradient-to-br from-slate-950 via-teal-950 to-indigo-950 text-white">
          <div className="flex min-h-screen flex-col justify-between p-10 xl:p-12">
            <div className="[&_span]:text-white">
              <VeilWordmark size="lg" />
            </div>

            <div className="max-w-xl">
              <div className="mb-5 text-xs uppercase tracking-[0.35em] text-white/60">
                Unified settlement
              </div>

              <h1 className="font-display text-5xl leading-tight font-semibold">
                Open payments on Arc, with private payments coming soon through Arc Private Kit.
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
                  Native Arc privacy integration is being prepared for hidden/private support.
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
                  Connect your wallet to access Arc Direct and Unified Balance USDC payments.
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
                  Veil helps you complete open Arc payments today and is preparing private payments with Arc Private Kit.
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
