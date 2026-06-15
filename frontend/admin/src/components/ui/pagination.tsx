"use client";

import { ChevronDown } from "lucide-react";

interface PaginationProps {
  totalResults: number;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  resultsPerPage: number;
  setResultsPerPage: (size: number) => void;
  totalPages: number;
}

export function Pagination({
  totalResults,
  currentPage,
  setCurrentPage,
  resultsPerPage,
  setResultsPerPage,
  totalPages,
}: PaginationProps) {
  const startIndex =
    totalResults > 0 ? (currentPage - 1) * resultsPerPage + 1 : 0;
  const endIndex = Math.min(currentPage * resultsPerPage, totalResults);

  return (
    <div className="flex flex-col items-center justify-between gap-4 sm:flex-row font-urbanist ">
      {/* Show Results counts */}
      <div className="text-[14px] text-[#1F2937] font-medium font-urbanist mt-2">
        Showing {startIndex}-{endIndex} of {totalResults} results
      </div>

      {/* Results page size and navigations */}
      <div className="flex items-center gap-6 mt-2">
        <div className="flex h-[34px] items-center gap-[8px]">
          <span className="text-[14px] text-[#1F2937] font-medium font-urbanist">
            Results per page:
          </span>
          <div className="relative">
            <select
              value={resultsPerPage}
              onChange={(e) => {
                setResultsPerPage(parseInt(e.target.value));
                setCurrentPage(1);
              }}
              className="w-[75px] appearance-none border border-[#D1D5DB] text-[#6B7280] py-1.5 pl-3 pr-8 rounded-[8px] text-[14px] font-medium hover:bg-gray-50 cursor-pointer focus:outline-none transition-all h-[34px] font-urbanist"
            >
              {[5, 10, 25, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#6B7280] pointer-events-none" />
          </div>
        </div>

        {/* Prev/Next buttons */}
        <div className="flex h-[34px] items-center gap-[5px]">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="h-[34px] w-[34px] cursor-pointer rounded-[8px] border border-[#D1D5DB] p-1.5 text-[#1F2937] transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronDown className="w-4 h-4 rotate-90" />
          </button>
          <span className="text-[14px] text-[#1F2937] font-medium px-2">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages}
            className="h-[34px] w-[34px] cursor-pointer rounded-[8px] border border-[#D1D5DB] p-1.5 text-[#1F2937] transition-colors hover:bg-gray-50 disabled:opacity-50"
          >
            <ChevronDown className="w-4 h-4 -rotate-90" />
          </button>
        </div>
      </div>
    </div>
  );
}
