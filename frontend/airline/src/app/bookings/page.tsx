import { Header } from "@/src/components/layout/Header";

export default function BookingsPage() {
  return (
    <div className="flex flex-col gap-6">
      <Header
        title="Bookings"
        subtitle="Confirmed hotel bookings from cancelled flights"
      />
    </div>
  );
}
