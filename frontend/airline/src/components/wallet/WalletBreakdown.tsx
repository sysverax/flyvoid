import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { formatMoney, WalletFigures } from "@/src/lib/wallet-figures";
import { CreditUsageBar } from "./CreditUsageBar";

/** Balance + credit limit − reserved = available, as a small statement. */
export function WalletBreakdown({ figures }: { figures: WalletFigures }) {
  const rows = [
    { label: "Balance", value: formatMoney(figures.balance), negative: figures.balance < 0 },
    { label: "+ Credit limit", value: formatMoney(figures.creditLimit) },
    { label: "− Reserved", value: formatMoney(figures.reserved) },
  ];

  return (
    <div className="w-72 rounded-lg bg-white p-4 shadow-[0px_4px_8px_0px_rgba(0,0,0,0.12)] outline outline-1 outline-gray-200">
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between text-[14px]">
            <span className="text-[#6B7280]">{row.label}</span>
            <span
              className={cn(
                "font-medium tabular-nums",
                row.negative ? "text-[#C83833]" : "text-[#1F2937]",
              )}
            >
              {row.value}
            </span>
          </div>
        ))}
      </div>

      <div className="my-3 border-t border-gray-200" />

      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-[#1F2937]">
          Available to spend
        </span>
        <span
          className={cn(
            "text-[16px] font-bold tabular-nums",
            figures.available < 0 ? "text-[#C83833]" : "text-[#1F2937]",
          )}
        >
          {formatMoney(figures.available)}
        </span>
      </div>

      {figures.creditLimit > 0 && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[12px] text-[#6B7280]">
            <span>Credit used</span>
            <span className="tabular-nums">{Math.round(figures.creditUsedPercent)}%</span>
          </div>
          <CreditUsageBar percent={figures.creditUsedPercent} />
        </div>
      )}

      <Link
        href="/wallet"
        className="mt-4 flex items-center justify-end gap-1 text-[13px] font-medium text-[#0F2757] hover:underline"
      >
        View wallet <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
