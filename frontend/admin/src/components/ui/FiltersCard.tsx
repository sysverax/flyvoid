"use client";

import { Search, ChevronDown, X } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface FiltersCardProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchPlaceholder?: string;
  onClearFilters: () => void;
  filterDescriptionText: string;
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
    <div className="bg-white rounded-2xl border border-[#E5E7EB] p-[18px] space-y-4">
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
          className="block w-full pl-11 pr-4 py-3 bg-[#F3F4F6] hover:bg-slate-100/50 focus:bg-white border border-[#D1D5DB] rounded-xl text-slate-950 placeholder-[#6B7280] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-base"
        />
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-1">
        <div className="flex flex-wrap items-center gap-3">
          {children}
        </div>

        <button
          onClick={onClearFilters}
          className="flex items-center gap-1.5 text-[16px] text-[#6B7280] hover:text-gray-800 transition-colors py-2 px-3 rounded-lg cursor-pointer"
        >
          <X className="w-4 h-4" />
          <span>Clear All</span>
        </button>
      </div>

      {/* Summary text */}
      <div className="text-[#6B7280] text-[14px]">{filterDescriptionText}</div>
    </div>
  );
}