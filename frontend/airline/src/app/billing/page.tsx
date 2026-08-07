import { Header } from "@/src/components/layout/Header";

export default function BillingPage() {
  return (
    <div className="flex flex-col gap-6">
      <Header
        title="Billing & Payments"
        subtitle="Platform fees, payment methods and payment history"
      />
    </div>
  );
}
