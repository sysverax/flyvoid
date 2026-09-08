import { X } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface FiltersCardProps {
  searchQuery?: string;
  setSearchQuery?: (query: string) => void;
  searchPlaceholder?: string;
  onClearFilters: () => void;
  filterDescriptionText?: string;
  children?: React.ReactNode;
  showSearch?: boolean;
  className?: string;
}

export function FiltersCard({
  onClearFilters,
  filterDescriptionText,
  children,
  className,
}: FiltersCardProps) {
  return (
    <div className={cn("rounded-[12px] border border-[#E5E7EB] bg-white p-[17px]", className)}>
      {/* Filter row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-[12px]">{children}</div>

        <button
          type="button"
          onClick={onClearFilters}
          className="flex h-11 items-center gap-2 rounded-[8px] px-[14px] py-2 text-[16px] text-[#6B7280] transition-colors hover:text-gray-800 hover:bg-gray-100 cursor-pointer"
        >
          <X className="h-4 w-4" />
          <span>Clear All</span>
        </button>
      </div>

      {/* Summary text */}
      {filterDescriptionText && (
        <div className="text-[#6B7280] text-[14px] h-[17px] -mt-1">{filterDescriptionText}</div>
      )}
    </div>
  );
}
