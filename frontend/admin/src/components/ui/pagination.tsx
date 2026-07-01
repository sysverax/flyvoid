"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/src/lib/utils";

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
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="w-[75px] flex items-center justify-between border border-[#D1D5DB] text-[#6B7280] py-1.5 pl-3 pr-2.5 rounded-[8px] text-[14px] font-medium hover:bg-gray-50 cursor-pointer focus:outline-none transition-all h-[34px] font-urbanist bg-white"
            >
              <span className="text-gray-700">{resultsPerPage}</span>
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 text-[#6B7280] transition-transform duration-200 shrink-0",
                  isOpen && "rotate-180"
                )}
              />
            </button>

            {isOpen && (
              <div className="absolute bottom-full mb-1 left-0 z-50 w-[75px] bg-white rounded-lg shadow-[0px_4px_8px_0px_rgba(0,0,0,0.12)] border border-gray-200 p-1 flex flex-col gap-0.5 select-none">
                {[5, 10, 25, 50].map((size) => {
                  const isSelected = size === resultsPerPage;
                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setResultsPerPage(size);
                        setCurrentPage(1);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "w-full text-center py-[3px] rounded-[4px] text-[14px] font-medium transition-colors cursor-pointer font-urbanist",
                        isSelected
                          ? "bg-[#203663] text-white font-semibold"
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Prev/Next buttons */}
        <div className="flex h-[34px] items-center gap-[5px]">
          <button
            type="button"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="h-[34px] w-[34px] cursor-pointer rounded-[8px] border border-[#D1D5DB] p-1.5 text-[#1F2937] transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-4 h-4 rotate-90" />
          </button>
          <span className="text-[14px] text-[#1F2937] font-medium px-2">
            Page {currentPage} of {totalPages}
          </span>
          <button
            type="button"
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages}
            className="h-[34px] w-[34px] cursor-pointer rounded-[8px] border border-[#D1D5DB] p-1.5 text-[#1F2937] transition-colors hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-4 h-4 -rotate-90" />
          </button>
        </div>
      </div>
    </div>
  );
}
