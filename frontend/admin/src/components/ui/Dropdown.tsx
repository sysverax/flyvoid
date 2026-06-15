"use client";

import { useState, useEffect, useRef } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/src/lib/utils";

export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  widthClass?: string;        // Width of the open menu container (e.g., "w-60" or "w-44")
  triggerWidthClass?: string; // Width of the trigger button container (e.g., "w-[180px]")
}

export function Dropdown({
  value,
  onChange,
  options,
  widthClass = "w-60",
  triggerWidthClass = "w-[180px]",
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
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
  };

  return (
    <div ref={dropdownRef} className={cn("relative h-11 select-none", triggerWidthClass)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-11 w-full flex items-center justify-between rounded-[8px] border border-[#D1D5DB] bg-[#F3F4F6] pl-4 pr-3.5 text-[#1F2937] outline-none cursor-pointer hover:bg-slate-100/80 transition-colors text-[16px] font-medium"
      >
        <span className="truncate text-left flex-1 mr-2">{selectedOption ? selectedOption.label : value}</span>
        <ChevronDown 
          className={cn(
            "pointer-events-none h-4 w-4 text-[#6B7280] transition-transform duration-200 shrink-0",
            isOpen && "rotate-180"
          )}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div 
          className={cn(
            "absolute left-0 mt-2 z-50 p-2 bg-white rounded-lg shadow-[0px_4px_8px_0px_rgba(0,0,0,0.12)] outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-0.5",
            widthClass
          )}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
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
                <span className="justify-start text-gray-800 text-[16px] font-normal font-figtree truncate leading-[1.5]">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
