import { cn } from "@/lib/utils";
import type { PaymentStatus, BatchStatus, PaymentMode, DisclosureStatus } from "@/types/veil";
import { Lock, ShieldCheck, CheckCircle2, Clock, AlertTriangle, Loader2, FileSignature, KeyRound } from "lucide-react";

const base = "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border";

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const map: Record<PaymentStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    idle:               { label: "Idle",              cls: "bg-muted text-muted-foreground border-border",                icon: <Clock className="h-3 w-3" /> },
    validating:         { label: "Validating",        cls: "bg-info/10 text-info border-info/20",                          icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    encrypting:         { label: "Encrypting",        cls: "bg-confidential-soft text-confidential border-confidential/20", icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    awaiting_signature: { label: "Awaiting signature", cls: "bg-warning/10 text-warning border-warning/20",                 icon: <FileSignature className="h-3 w-3" /> },
    submitting:         { label: "Submitting",        cls: "bg-info/10 text-info border-info/20",                          icon: <Loader2 className="h-3 w-3 animate-spin" /> },
    pending:            { label: "Pending",           cls: "bg-warning/10 text-warning border-warning/20",                 icon: <Clock className="h-3 w-3" /> },
    settled:            { label: "Settled",           cls: "bg-success/10 text-success border-success/20",                 icon: <CheckCircle2 className="h-3 w-3" /> },
    failed:             { label: "Failed",            cls: "bg-destructive/10 text-destructive border-destructive/20",      icon: <AlertTriangle className="h-3 w-3" /> },
  };
  const it = map[status];
  return <span className={cn(base, it.cls)}>{it.icon}{it.label}</span>;
}

export function BatchStatusBadge({ status }: { status: BatchStatus }) {
  const map: Record<BatchStatus, { label: string; cls: string }> = {
    uploaded:           { label: "Uploaded",          cls: "bg-muted text-muted-foreground border-border" },
    validating:         { label: "Validating",        cls: "bg-info/10 text-info border-info/20" },
    invalid_rows:       { label: "Invalid rows",      cls: "bg-destructive/10 text-destructive border-destructive/20" },
    ready:              { label: "Ready",             cls: "bg-accent text-accent-foreground border-border" },
    encrypting:         { label: "Encrypting",        cls: "bg-confidential-soft text-confidential border-confidential/20" },
    awaiting_signature: { label: "Awaiting signature", cls: "bg-warning/10 text-warning border-warning/20" },
    submitted:          { label: "Submitted",         cls: "bg-info/10 text-info border-info/20" },
    completed:          { label: "Completed",         cls: "bg-success/10 text-success border-success/20" },
    partially_failed:   { label: "Partial failure",   cls: "bg-warning/10 text-warning border-warning/20" },
  };
  const it = map[status];
  return <span className={cn(base, it.cls)}>{it.label}</span>;
}

export function ModeBadge({ mode, subtle = false }: { mode: PaymentMode; subtle?: boolean }) {
  if (mode === "confidential") {
    return (
      <span className={cn(base, subtle ? "bg-confidential-soft text-confidential border-confidential/15" : "bg-confidential text-confidential-foreground border-confidential")}>
        <Lock className="h-3 w-3" /> Closed
      </span>
    );
  }
  return (
    <span className={cn(base, "bg-beige text-walnut border-sand")}>
      <ShieldCheck className="h-3 w-3" /> Open
    </span>
  );
}

export function ConfidentialLockBadge() {
  return (
    <span className={cn(base, "bg-confidential-soft text-confidential border-confidential/20")}>
      <Lock className="h-3 w-3" /> Protected
    </span>
  );
}

export function DisclosureBadge({ status }: { status: DisclosureStatus }) {
  const map: Record<DisclosureStatus, { label: string; cls: string; icon: React.ReactNode }> = {
    private:   { label: "Closed",             cls: "bg-confidential-soft text-confidential border-confidential/20", icon: <Lock className="h-3 w-3" /> },
    requested: { label: "Awaiting approval",  cls: "bg-warning/10 text-warning border-warning/20",                  icon: <KeyRound className="h-3 w-3" /> },
    granted:   { label: "Access granted",     cls: "bg-success/10 text-success border-success/20",                  icon: <ShieldCheck className="h-3 w-3" /> },
    revoked:   { label: "Revoked",            cls: "bg-muted text-muted-foreground border-border",                  icon: <AlertTriangle className="h-3 w-3" /> },
  };
  const it = map[status];
  return <span className={cn(base, it.cls)}>{it.icon}{it.label}</span>;
}
