import { cn } from "@/src/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusStyles: Record<string, { bg: string; text: string }> = {
  Pending: {
    bg: "bg-[#FEF3C7]",
    text: "text-[#92400E]",
  },
  Accepted: {
    bg: "bg-[#D1FAE5]",
    text: "text-[#065F46]",
  },
  Active: {
    bg: "bg-[#D1FAE5]",
    text: "text-[#065F46]",
  },
  Revoked: {
    bg: "bg-[#E5E7EB]",
    text: "text-[#374151]",
  },
  Expired: {
    bg: "bg-[#FEE2E2]",
    text: "text-[#991B1B]",
  },
  Suspended: {
    bg: "bg-[#FEE2E2]",
    text: "text-[#991B1B]",
  },
  Disabled: {
    bg: "bg-[#F3F4F6]",
    text: "text-[#1F2937]",
  },
  Inactive: {
    bg: "bg-[#E5E7EB]",
    text: "text-[#374151]",
  },
  Processing: {
    bg: "bg-[#FEF3C7]",
    text: "text-[#92400E]",
  },
  Completed: {
    bg: "bg-[#D1FAE5]",
    text: "text-[#065F46]",
  },
  Failed: {
    bg: "bg-[#FEE2E2]",
    text: "text-[#991B1B]",
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles = statusStyles[status] || {
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
      {status}
    </span>
  );
}
