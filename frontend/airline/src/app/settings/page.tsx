import { Header } from "@/src/components/layout/Header";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Header
        title="Settings"
        subtitle="Manage your account and preferences"
      />
    </div>
  );
}
