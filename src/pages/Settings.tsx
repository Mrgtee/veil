import { SectionHeader } from "@/components/veil/SectionHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useVeilSession } from "@/hooks/useVeilSession";
import { Lock, Bell, User, Wallet, ShieldCheck } from "lucide-react";

export default function Settings() {
  const { session } = useVeilSession();
  const groups = [
    { id: "profile", label: "Profile", icon: User },
    { id: "wallet", label: "Wallet & Network", icon: Wallet },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "security", label: "Security", icon: ShieldCheck },
    { id: "disclosure", label: "Disclosure defaults", icon: Lock },
  ];

  return (
    <div className="space-y-8">
      <SectionHeader eyebrow="Workspace" title="Settings" description="Manage your account, network, security and disclosure preferences." />

      <div className="grid lg:grid-cols-[220px_1fr] gap-8">
        <nav className="space-y-1">
          {groups.map((g) => (
            <a key={g.id} href={`#${g.id}`} className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-secondary/60 rounded-md transition-colors">
              <g.icon className="h-4 w-4" />{g.label}
            </a>
          ))}
        </nav>

        <div className="space-y-8">
          <Card id="profile" title="Profile / Organization">
            <div className="grid sm:grid-cols-2 gap-4">
              <FieldRow label="Display name" defaultValue={session?.label ?? ""} />
              <FieldRow label="Organization" defaultValue="Veil Operator" />
              <FieldRow label="Operations email" defaultValue="ops@veil.app" type="email" />
              <FieldRow label="Timezone" defaultValue="UTC" />
            </div>
          </Card>

          <Card id="wallet" title="Wallet & Network">
            <FieldRow label="Connected address" defaultValue={session?.address ?? ""} mono readOnly />
            <FieldRow label="Settlement network" defaultValue="Arc Testnet" readOnly />
            <FieldRow label="Default token" defaultValue="USDC" />
          </Card>

          <Card id="notifications" title="Notifications">
            <Toggle label="Payment confirmations" desc="Notify on settlement of single and batch payments" defaultChecked />
            <Toggle label="Failed transactions" desc="Alert when a transaction fails or partially fails" defaultChecked />
            <Toggle label="Disclosure requests" desc="Notify when access is requested or granted" defaultChecked />
          </Card>

          <Card id="security" title="Security">
            <Toggle label="Require signature for batches > 10 recipients" defaultChecked />
            <Toggle label="2-of-2 approval for confidential disclosures" />
            <Toggle label="Auto-lock after 15 minutes of inactivity" defaultChecked />
          </Card>

          <Card id="disclosure" title="Disclosure defaults">
            <FieldRow label="Default access duration (days)" defaultValue="30" type="number" />
            <FieldRow label="Default authorizer" defaultValue="compliance@veil.app" />
            <Toggle label="Require justification for reveal requests" defaultChecked />
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="outline">Cancel</Button>
            <Button className="bg-gradient-brand text-primary-foreground">Save changes</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="surface-card p-6 space-y-5 scroll-mt-20">
      <h3 className="font-display text-lg">{title}</h3>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function FieldRow({ label, defaultValue, type = "text", mono, readOnly }: { label: string; defaultValue?: string; type?: string; mono?: boolean; readOnly?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input type={type} defaultValue={defaultValue} readOnly={readOnly} className={mono ? "font-mono text-sm" : ""} />
    </div>
  );
}

function Toggle({ label, desc, defaultChecked }: { label: string; desc?: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {desc && <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>}
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
