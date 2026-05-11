import { useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Send, WalletCards, Lock } from "lucide-react";
import { useAccount } from "wagmi";
import { VeilWordmark } from "@/components/brand/VeilLogo";
import { VeilConnectButton } from "@/components/wallet/VeilConnectButton";

export default function SignIn() {
  const navigate = useNavigate();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (isConnected) {
      navigate("/app");
    }
  }, [isConnected, navigate]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-5 py-10 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="space-y-7">
            <div className="[&_span]:text-3xl">
              <VeilWordmark size="lg" />
            </div>

            <div className="max-w-2xl space-y-4">
              <h1 className="font-display text-4xl font-semibold leading-tight sm:text-5xl">
                Open and private USDC payments on Arc.
              </h1>
              <p className="max-w-xl text-base leading-7 text-muted-foreground">
                Send single or batch payments.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <FeatureCard icon={<Send className="h-4 w-4" />} title="Arc Direct" text="Live through VeilHub." />
              <FeatureCard icon={<WalletCards className="h-4 w-4" />} title="Unified USDC" text="Supports Circle unified USDC." />
              <FeatureCard icon={<Lock className="h-4 w-4" />} title="Private payments" text="Coming soon." />
            </div>
          </div>

          <div className="surface-card mx-auto w-full max-w-md p-5 sm:p-6">
            <div className="space-y-2">
              <h2 className="font-display text-2xl font-semibold">Enter Veilarc</h2>
              <p className="text-sm text-muted-foreground">
                Connect your wallet to open the payment workspace.
              </p>
            </div>

            <VeilConnectButton fullWidth className="mt-6 h-12" />
          </div>
        </div>
      </section>
    </main>
  );
}

function FeatureCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-walnut">
        {icon}
      </div>
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{text}</div>
    </div>
  );
}
