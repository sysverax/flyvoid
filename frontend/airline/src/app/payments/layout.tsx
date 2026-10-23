import { notFound } from "next/navigation";
import { PAYMENTS_ENABLED } from "@/src/lib/constants";

export default function PaymentsLayout({ children }: { children: React.ReactNode }) {
  if (!PAYMENTS_ENABLED) notFound();
  return children;
}
