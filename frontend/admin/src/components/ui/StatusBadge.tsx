import { cn } from "@/src/lib/utils";
import { Invitation } from "@/src/types/onboarding";

interface StatusBadgeProps {
  status: Invitation["status"];
  className?: string;
}

const statusStyles: Record<
  Invitation["status"],
  { bg: string; text: string }
> = {
  Pending: {
    bg: "bg-[#FEF3C7]",
    text: "text-[#92400E]",
  },
  Accepted: {
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
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles = statusStyles[status];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center text-[12px] font-medium tracking-wide select-none",
        "w-[67px] h-[20px] rounded-[15px]",
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
