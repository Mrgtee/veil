import { Link } from "react-router-dom";
import { ArrowRight, WalletCards } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionHeader } from "@/components/veil/SectionHeader";

export default function Bridge() {
  return (
    <div className="space-y-6">
      <SectionHeader
        eyebrow="Liquidity"
        title="Bridge flow retired"
        description="Use wallet-owned Unified USDC deposits, then pay from New Payment or Batch Payments."
      />

      <div className="surface-card p-5 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-secondary p-2">
            <WalletCards className="h-4 w-4" />
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-medium">Use Unified USDC Balance</h2>
            <p className="text-sm text-muted-foreground">
              Deposits are signed by the connected wallet on the selected source chain. Spending also uses the connected wallet, so user-facing flows do not rely on backend-managed wallets.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/app/unified-balance">
              Deposit USDC
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          <Button asChild variant="outline">
            <Link to="/app/payments/new">New Payment</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
