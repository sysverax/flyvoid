"use client";

import { Search, X } from "lucide-react";

interface FiltersCardProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchPlaceholder?: string;
  onClearFilters: () => void;
  filterDescriptionText?: string;
  children?: React.ReactNode;
}

export function FiltersCard({
  searchQuery,
  setSearchQuery,
  searchPlaceholder = "Search...",
  onClearFilters,
  filterDescriptionText,
  children,
}: FiltersCardProps) {
  return (
    <div className="space-y-[14px] rounded-[12px] border border-[#E5E7EB] bg-white p-[17px]">
      {/* Search */}
      <div className="relative">
        <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-[#6B7280]" />
        </span>
        <input
          type="text"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block h-11 w-full rounded-[8px] border border-[#D1D5DB] bg-[#F3F4F6] py-[14px] pl-11 pr-4 text-[16px] text-slate-950 placeholder-[#6B7280] transition-all hover:bg-slate-100/50 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-[12px]">{children}</div>

        <button
          onClick={onClearFilters}
          className="flex h-11 items-center gap-2 rounded-[8px] px-[14px] py-2 text-[16px] text-[#6B7280] transition-colors hover:text-gray-800"
        >
          <X className="h-4 w-4" />
          <span>Clear All</span>
        </button>
      </div>

      {/* Summary text */}
      {filterDescriptionText && (
        <div className="text-[#6B7280] text-[14px] h-[17px]">{filterDescriptionText}</div>
      )}
    </div>
  );
}
