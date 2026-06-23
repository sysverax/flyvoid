import { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface DatePickerProps {
  value: string; // "YYYY-MM-DD"
  onChange: (val: string) => void;
  placeholder: string;
  align?: "left" | "right";
}

export function DatePicker({ value, onChange, placeholder, align = "left" }: DatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial value or default to current date
  const parsedDate = value ? new Date(value) : new Date();
  const [viewMonth, setViewMonth] = useState(parsedDate.getMonth()); // 0-11
  const [viewYear, setViewYear] = useState(parsedDate.getFullYear());

  // Close calendar dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Sync state if value changes externally (like clear filters)
  useEffect(() => {
    if (value) {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        setViewMonth(parsed.getMonth());
        setViewYear(parsed.getFullYear());
      }
    } else {
      const today = new Date();
      setViewMonth(today.getMonth());
      setViewYear(today.getFullYear());
    }
  }, [value]);

  // Format date to DD/MM/YYYY for visible input
  const displayValue = value ? (() => {
    const parts = value.split("-");
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return value;
  })() : "";

  // Month names
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Days of week labels
  const daysOfWeek = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // Helper to generate dates for grid
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const firstDayIndex = new Date(viewYear, viewMonth, 1).getDay();

  // Handle month navigation
  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  // Handle date selection
  const selectDate = (day: number) => {
    const paddedMonth = String(viewMonth + 1).padStart(2, "0");
    const paddedDay = String(day).padStart(2, "0");
    const selectedValue = `${viewYear}-${paddedMonth}-${paddedDay}`;
    onChange(selectedValue);
    setIsOpen(false);
  };

  // Check if a day is the currently selected date
  const isSelected = (day: number) => {
    if (!value) return false;
    const [y, m, d] = value.split("-").map(Number);
    return y === viewYear && m === (viewMonth + 1) && d === day;
  };

  // Check if a day is today
  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === viewMonth && today.getFullYear() === viewYear;
  };

  return (
    <div className="relative inline-block w-[160px]" ref={containerRef}>
      {/* Trigger input */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="relative h-11 w-full rounded-[8px] border border-[#D1D5DB] bg-[#F3F4F6] py-3 pl-4 pr-16 text-gray-600 cursor-pointer hover:bg-slate-100/80 transition-colors flex items-center select-none"
      >
        <span className={cn("text-[16px] overflow-hidden text-ellipsis whitespace-nowrap", !displayValue && "text-gray-400")}>
          {displayValue || placeholder}
        </span>
        {value ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            className="absolute right-10 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded-full text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}
        <Calendar className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6B7280]" />
      </div>

      {/* Calendar Dropdown */}
      {isOpen && (
        <div className={cn(
          "absolute top-full mt-1 z-50 w-[280px] bg-white rounded-xl shadow-xl border border-gray-200 p-4 select-none",
          align === "right" ? "right-0" : "left-0"
        )}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-gray-800 text-sm font-semibold">
              {months[viewMonth]} {viewYear}
            </div>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-600 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday labels */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {daysOfWeek.map((day) => (
              <div key={day} className="text-xs font-semibold text-gray-400 py-1">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {/* Blank spaces before first day */}
            {Array.from({ length: firstDayIndex }).map((_, idx) => (
              <div key={`empty-${idx}`} className="py-2" />
            ))}
            {/* Calendar days */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const selected = isSelected(day);
              const today = isToday(day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDate(day)}
                  className={cn(
                    "text-sm py-1.5 rounded-lg transition-colors cursor-pointer outline-none font-medium",
                    selected && "bg-blue-950 text-white font-semibold hover:bg-blue-900",
                    !selected && today && "border border-blue-950 text-blue-950",
                    !selected && !today && "text-gray-700 hover:bg-gray-100",
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
