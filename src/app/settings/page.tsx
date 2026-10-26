import { SettingsForm } from "@/components/settings/settings-form";

export default function SettingsPage() {
  return (
    <div className="stack">
      <header>
        <p className="page-kicker">Clinic</p>
        <h1>What the desk can say.</h1>
        <p className="lede">These details are fictional. They are the only clinic facts the receptionist is allowed to use.</p>
      </header>
      <SettingsForm />
    </div>
  );
}
