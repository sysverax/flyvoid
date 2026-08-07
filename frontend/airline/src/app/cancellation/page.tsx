import { Header } from "@/src/components/layout/Header";

export default function CancellationPage() {
  return (
    <div className="flex flex-col gap-6">
      <Header
        title="Cancelled Flights"
        subtitle="Manage flight cancellations and hotel allocations"
      />
    </div>
  );
}
