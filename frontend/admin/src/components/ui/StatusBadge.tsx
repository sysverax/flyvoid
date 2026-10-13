import { cn } from "@/src/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusLabels: Record<string, string> = {
  draft: "Draft",
  in_progress: "In Progress",
  passengers_booking_confirmed: "Bookings Confirmed",
  hotel_allocation_in_progress: "Allocation In Progress",
  allocated: "Allocated",
  paid: "Paid",
  published: "Published",
  failed: "Failed",
};

const statusStyles: Record<string, { bg: string; text: string }> = {
  // Flight cancellation statuses
  draft: { bg: "bg-[#F3F4F6]", text: "text-[#374151]" },
  Draft: { bg: "bg-[#F3F4F6]", text: "text-[#374151]" },

  in_progress: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]" },
  "In Progress": { bg: "bg-[#FEF3C7]", text: "text-[#92400E]" },

  passengers_booking_confirmed: { bg: "bg-[#E0F2FE]", text: "text-[#0369A1]" },
  "Bookings Confirmed": { bg: "bg-[#E0F2FE]", text: "text-[#0369A1]" },

  hotel_allocation_in_progress: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]" },
  "Allocation In Progress": { bg: "bg-[#FEF3C7]", text: "text-[#92400E]" },

  allocated: { bg: "bg-[#E0E7FF]", text: "text-[#3730A3]" },
  Allocated: { bg: "bg-[#E0E7FF]", text: "text-[#3730A3]" },

  paid: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]" },
  Paid: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]" },

  published: { bg: "bg-[#ECFDF5]", text: "text-[#047857]" },
  Published: { bg: "bg-[#ECFDF5]", text: "text-[#047857]" },

  // General & user management statuses
  "Fees outstanding": { bg: "bg-[#FEF3C7]", text: "text-[#92400E]" },
  "credit exceeded": { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
  settled: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]" },
  Pending: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]" },
  Accepted: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]" },
  Active: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]" },
  Revoked: { bg: "bg-[#E5E7EB]", text: "text-[#374151]" },
  Expired: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
  Suspended: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
  Disabled: { bg: "bg-[#F3F4F6]", text: "text-[#1F2937]" },
  Inactive: { bg: "bg-[#E5E7EB]", text: "text-[#374151]" },
  Processing: { bg: "bg-[#FEF3C7]", text: "text-[#92400E]" },
  Completed: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]" },
  Success: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]" },
  success: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]" },
  SUCCESS: { bg: "bg-[#D1FAE5]", text: "text-[#065F46]" },
  Failed: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
  failed: { bg: "bg-[#FEE2E2]", text: "text-[#991B1B]" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const label =
    statusLabels[status] ||
    (status
      ? status
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase())
      : "N/A");

  const styles =
    statusStyles[status] ||
    statusStyles[label] || {
      bg: "bg-gray-100",
      text: "text-gray-800",
    };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center text-[12px] font-medium tracking-wide select-none",
        "h-[20px] rounded-[15px]",
        "pt-[2px] pb-[2px] pl-[10px] pr-[10px]",
        styles.bg,
        styles.text,
        className
      )}
    >
      {label}
    </span>
  );
}
