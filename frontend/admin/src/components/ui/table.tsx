import * as React from "react";
import { cn } from "@/src/lib/utils";

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => (
  <div className="relative w-full overflow-auto">
    <table
      ref={ref}
      className={cn("w-full caption-bottom text-sm", className)}
      {...props}
    />
  </div>
));
Table.displayName = "Table";

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn(
      "border-b border-[#E5E7EB] bg-[#F9FAFB] [&_tr]:border-b h-[40px]",
      className,
    )}
    {...props}
  />
));
TableHeader.displayName = "TableHeader";

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0 bg-white", className)}
    {...props}
  />
));
TableBody.displayName = "TableBody";

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-[#E5E7EB] transition-colors hover:bg-slate-50/50 data-[state=selected]:bg-muted",
      className,
    )}
    {...props}
  />
));
TableRow.displayName = "TableRow";

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-10 px-3 py-2.5 text-left text-[12px] font-medium uppercase leading-[100%] tracking-[0%] text-gray-500 align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
));
TableHead.displayName = "TableHead";

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "h-16 px-3 py-3 text-sm text-[var(--text-primary)] align-middle [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
      className,
    )}
    {...props}
  />
));
TableCell.displayName = "TableCell";

interface SortHeaderProps<T> {
  label: string;
  field: keyof T;
  sortField: keyof T | null;
  sortOrder: "asc" | "desc";
  onSort: (field: keyof T) => void;
  align?: "left" | "right";
}

function SortHeader<T>({
  label,
  field,
  sortField,
  sortOrder,
  onSort,
  align = "left",
}: SortHeaderProps<T>) {
  const isSorted = sortField === field;
  const isAsc = isSorted && sortOrder === "asc";
  const isDesc = isSorted && sortOrder === "desc";

  return (
    <div className={cn("flex items-center", align === "right" && "justify-end")}>
      <span>{label}</span>
      <span
        onClick={() => onSort(field)}
        className="inline-flex cursor-pointer ml-1.5 select-none p-1 rounded transition-colors shrink-0"
        // title={`Sort by ${label}`}
      >
        <svg
          width="8"
          height="12"
          viewBox="0 0 8 12"
          fill="none"
          className="text-gray-400"
        >
          {/* Up Chevron */}
          <path
            d="M1 4.5L4 1.5L7 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              "transition-colors duration-150",
              isAsc ? "text-gray-900" : "text-[#6B7280]"
            )}
          />
          {/* Down Chevron */}
          <path
            d="M1 7.5L4 10.5L7 7.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              "transition-colors duration-150",
              isDesc ? "text-gray-900" : "text-[#6B7280]"
            )}
          />
        </svg>
      </span>
    </div>
  );
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, SortHeader };
