import { cn } from "@/src/lib/utils";

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  /** Optional small line under the value. */
  hint?: React.ReactNode;
  className?: string;
}

/** KPI card: title, value, optional hint, and an icon on the right. */
export function StatCard({ title, value, icon, hint, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-4 hover:shadow-sm transition-shadow",
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-base text-[#6B7280]">{title}</p>
        <h3 className="text-2xl font-semibold text-[#1F2937] tabular-nums">{value}</h3>
        {hint && <p className="text-[13px] text-[#6B7280]">{hint}</p>}
      </div>
      <div className="rounded-[8px] bg-[#F3F4F6] p-2.5 text-[#0F2757] flex items-center justify-center h-11 w-11 shrink-0">
        {icon}
      </div>
    </div>
  );
}
