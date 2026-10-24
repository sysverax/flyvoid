"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/src/lib/utils";
import { pageTitleFor } from "@/src/lib/page-titles";

interface PageHeaderProps {
  /** Page-level actions and controls, shown on the title row (e.g. "Add New"). */
  actions?: React.ReactNode;
  className?: string;
}

/** Page title and subtitle (from lib/page-titles.ts) with the page's actions on the same row. */
export function PageHeader({ actions, className }: PageHeaderProps) {
  const page = pageTitleFor(usePathname());
  if (!page) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%]">
          {page.title}
        </h1>
        <p className="text-[14px] text-[#6B7280] mt-1">{page.subtitle}</p>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-3">{actions}</div>
      )}
    </div>
  );
}
