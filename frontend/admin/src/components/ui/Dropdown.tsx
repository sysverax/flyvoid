"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check, Search } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import { cn } from "@/src/lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
}

export interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  widthClass?: string;
  triggerWidthClass?: string;
  heightClass?: string;
  bgClass?: string;
  labelPrefix?: string;
  disabled?: boolean;
  maxListHeightClass?: string;
  error?: boolean;
  searchable?: boolean;
}

export function Dropdown({
  value,
  onChange,
  options,
  widthClass = "w-60",
  triggerWidthClass = "w-[180px]",
  heightClass = "h-11",
  bgClass = "bg-[#F3F4F6]",
  labelPrefix,
  disabled = false,
  maxListHeightClass,
  error = false,
  searchable = false,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSearchQuery("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
    setSearchQuery("");
  };

  const toggleDropdown = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
      if (isOpen) setSearchQuery("");
    }
  };

  const triggerSpanRef = useRef<HTMLSpanElement>(null);
  const [isTriggerTruncated, setIsTriggerTruncated] = useState(false);

  const checkTriggerTruncation = () => {
    if (triggerSpanRef.current) {
      setIsTriggerTruncated(triggerSpanRef.current.scrollWidth > triggerSpanRef.current.clientWidth);
    }
  };

  return (
    <Tooltip.Provider delayDuration={300}>
      <div ref={dropdownRef} className={cn("relative select-none", heightClass, triggerWidthClass)}>
        <Tooltip.Root>
          <Tooltip.Trigger asChild onMouseEnter={checkTriggerTruncation}>
            <button
              type="button"
              disabled={disabled}
              onClick={toggleDropdown}
              className={cn(
                "w-full flex items-center justify-between rounded-[8px] border pl-4 pr-3.5 text-[#1F2937] outline-none cursor-pointer hover:bg-slate-100/80 transition-colors text-[16px]",
                error ? "border-rose-500 bg-rose-50/10 focus:border-rose-500" : "border-[#D1D5DB]",
                heightClass,
                bgClass,
                disabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
              )}
            >
              <span ref={triggerSpanRef} className="truncate text-left flex-1 mr-2">
                {selectedOption ? selectedOption.label : value}
              </span>
              <ChevronDown
                className={cn(
                  "pointer-events-none h-4 w-4 text-[#6B7280] transition-transform duration-200 shrink-0",
                  isOpen && "rotate-180"
                )}
              />
            </button>
          </Tooltip.Trigger>
          <Tooltip.Portal>
            {isTriggerTruncated && (
              <Tooltip.Content side="top" sideOffset={5} className="bg-gray-100 border border-gray-200 text-gray-800 text-[13px] font-medium px-3 py-1.5 rounded-md shadow-lg max-w-xs break-words z-[100] animate-in fade-in-0 zoom-in-95 font-figtree">
                {selectedOption ? selectedOption.label : value}
                <Tooltip.Arrow className="fill-gray-100" />
              </Tooltip.Content>
            )}
          </Tooltip.Portal>
        </Tooltip.Root>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={cn(
            "absolute left-0 mt-2 z-50 p-2 bg-white rounded-lg shadow-[0px_4px_8px_0px_rgba(0,0,0,0.12)] outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-0.5",
            widthClass
          )}
        >
          {searchable && (
            <div className="w-full px-2 py-1.5 mb-1 border-b border-gray-100 flex items-center gap-2">
              <Search className="w-4 h-4 text-gray-400 shrink-0" />
              <input
                type="text"
                className="w-full bg-transparent text-[15px] outline-none text-gray-800 placeholder:text-gray-400 font-figtree"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          <div className={cn("w-full flex flex-col gap-0.5", maxListHeightClass && `${maxListHeightClass} overflow-y-auto scrollbar-thin`)}>
            {(() => {
              const filteredOptions = options.filter((option) => {
                if (option.value === "") return false;
                if (!searchable) return true;
                return option.label.toLowerCase().startsWith(searchQuery.toLowerCase());
              });

              if (filteredOptions.length === 0) {
                return <div className="p-2 text-sm text-gray-500 text-center font-figtree">No results found.</div>;
              }

              return filteredOptions.map((option) => {
                return (
                  <DropdownOptionItem 
                    key={option.value} 
                    option={option} 
                    value={value} 
                    handleSelect={handleSelect} 
                  />
                );
              });
            })()}
          </div>
        </div>
      )}
    </div>
    </Tooltip.Provider>
  );
}

function DropdownOptionItem({ option, value, handleSelect }: { option: DropdownOption; value: string; handleSelect: (val: string) => void }) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const isSelected = option.value === value;

  const checkTruncation = () => {
    if (spanRef.current) {
      setIsTruncated(spanRef.current.scrollWidth > spanRef.current.clientWidth);
    }
  };

  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild onMouseEnter={checkTruncation}>
        <button
          type="button"
          onClick={() => handleSelect(option.value)}
          className={cn(
            "self-stretch p-2 rounded-md inline-flex justify-start items-center gap-2.5 text-left transition-colors cursor-pointer",
            isSelected ? "bg-gray-200" : "hover:bg-gray-100"
          )}
        >
          {/* Standard Tick mark for the selected option */}
          <div className="size-4 flex items-center justify-center shrink-0">
            {isSelected && <Check className="h-3.5 w-3.5 text-gray-800 stroke-[2.5px]" />}
          </div>
          <span ref={spanRef} className="justify-start text-gray-800 text-[16px] font-normal font-figtree truncate leading-[1.5]">
            {option.label}
          </span>
        </button>
      </Tooltip.Trigger>
      <Tooltip.Portal>
        {isTruncated && (
          <Tooltip.Content side="right" sideOffset={10} className="bg-gray-100 border border-gray-200 text-gray-800 text-[13px] font-medium px-3 py-1.5 rounded-md shadow-lg max-w-xs break-words z-[100] animate-in fade-in-0 zoom-in-95 font-figtree">
            {option.label}
            <Tooltip.Arrow className="fill-gray-100" />
          </Tooltip.Content>
        )}
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}
