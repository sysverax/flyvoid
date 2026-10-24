import { cn } from "@/src/lib/utils";

/** How much of the credit limit is being drawn on. */
export function CreditUsageBar({
  percent,
  className,
}: {
  percent: number;
  className?: string;
}) {
  return (
    <div
      className={cn("h-2 w-full overflow-hidden rounded-full bg-[#E5E7EB]", className)}
      role="progressbar"
      aria-valuenow={Math.round(percent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Credit used"
    >
      <div
        className={cn(
          "h-full rounded-full transition-all",
          percent >= 90 ? "bg-[#C83833]" : percent >= 70 ? "bg-[#D97706]" : "bg-[#0F2757]",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
