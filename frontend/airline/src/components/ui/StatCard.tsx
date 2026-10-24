import { cn } from "@/src/lib/utils";

interface StatCardProps {
  title: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  /** Optional small line (or element) under the value. */
  hint?: React.ReactNode;
  valueClassName?: string;
  className?: string;
}

/** KPI card: title, value and an icon on the right (same design as the Bookings stats). */
export function StatCard({
  title,
  value,
  icon,
  hint,
  valueClassName,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "w-full px-4 py-4 leading-[100%] tracking-[0%] bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-4 hover:shadow-md transition-shadow",
        className,
      )}
    >
      <div className="self-stretch inline-flex justify-between items-start gap-5 relative -left-0.5">
        <div className="flex-1 min-w-0 inline-flex flex-col justify-start items-start gap-1.5">
          <div className="self-stretch justify-start text-gray-500 text-base font-normal font-figtree leading-[100%] tracking-[0%]">
            {title}
          </div>
          <div
            className={cn(
              "justify-start text-gray-800 text-2xl font-semibold font-figtree tabular-nums",
              valueClassName,
            )}
          >
            {value}
          </div>
          {hint && (
            <div className="self-stretch text-[13px] text-gray-500 font-figtree leading-[130%]">
              {hint}
            </div>
          )}
        </div>
        <div className="size-11 p-2.5 bg-gray-100 rounded-lg flex justify-center items-center shrink-0">
          {icon}
        </div>
      </div>
    </div>
  );
}
