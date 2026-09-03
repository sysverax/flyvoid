import { cn } from "@/src/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusStyles: Record<string, { bg: string; text: string }> = {
  Published: {
    bg: "bg-[#D1FAE5]",
    text: "text-[#065F46]",
  },
  published: {
    bg: "bg-[#D1FAE5]",
    text: "text-[#065F46]",
  },
  "In Progress": {
    bg: "bg-[#FEF3C7]",
    text: "text-[#92400E]",
  },
  Inprogress: {
    bg: "bg-[#FEF3C7]",
    text: "text-[#92400E]",
  },
  inprogress: {
    bg: "bg-[#FEF3C7]",
    text: "text-[#92400E]",
  },
  Verified: {
    bg: "bg-[#DBEAFE]",
    text: "text-[#1E40AF]",
  },
  verified: {
    bg: "bg-[#DBEAFE]",
    text: "text-[#1E40AF]",
  },
  Paid: {
    bg: "bg-[#CCFBF1]",
    text: "text-[#0F766E]",
  },
  paid: {
    bg: "bg-[#CCFBF1]",
    text: "text-[#0F766E]",
  },
  Allocated: {
    bg: "bg-[#F3E8FF]",
    text: "text-[#6B21A8]",
  },
  allocated: {
    bg: "bg-[#F3E8FF]",
    text: "text-[#6B21A8]",
  },
  Pending: {
    bg: "bg-[#FEF3C7]",
    text: "text-[#92400E]",
  },
  "Pending Approval": {
    bg: "bg-[#FEF3C7]",
    text: "text-[#92400E]",
  },
  Approved: {
    bg: "bg-[#D1FAE5]",
    text: "text-[#065F46]",
  },
  Rejected: {
    bg: "bg-[#FEE2E2]",
    text: "text-[#991B1B]",
  },
  Processing: {
    bg: "bg-[#FEF3C7]",
    text: "text-[#92400E]",
  },
  Completed: {
    bg: "bg-[#D1FAE5]",
    text: "text-[#065F46]",
  },
  Success: {
    bg: "bg-[#D1FAE5]",
    text: "text-[#065F46]",
  },
  success: {
    bg: "bg-[#D1FAE5]",
    text: "text-[#065F46]",
  },
  Failed: {
    bg: "bg-[#FEE2E2]",
    text: "text-[#991B1B]",
  },
  Active: {
    bg: "bg-[#D1FAE5]",
    text: "text-[#065F46]",
  },
  Inactive: {
    bg: "bg-[#E5E7EB]",
    text: "text-[#374151]",
  },
  Draft: {
    bg: "bg-[#E5E7EB]",
    text: "text-[#374151]",
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
