import { SettingsForm } from "@/components/settings/settings-form";

export default function SettingsPage() {
  return (
    <div className="stack">
      <header>
        <p className="page-kicker">Configuration</p>
        <h1>Clinic settings</h1>
        <p className="lede">Edit the fictional clinic the receptionist is allowed to describe.</p>
      </header>
      <SettingsForm />
    </div>
  );
}
