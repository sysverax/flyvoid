"use client";

import { Download, Lightbulb } from "lucide-react";
import {
  BOOKING_CSV_HEADERS,
  BOOKING_CSV_RULES,
  downloadBookingCsvTemplate,
} from "@/src/lib/booking-fields";

/** Tips beside the drop zone: column order, value rules and the template. */
export function CsvUploadTips() {
  return (
    <div className="rounded-xl bg-[#F6F7F8] p-6 text-left flex flex-col">
      <h4 className="flex items-center gap-2 text-[18px] font-semibold text-[#0F2757] font-figtree mb-4">
        <Lightbulb className="h-5 w-5" />
        Tips
      </h4>
      <ul className="space-y-2.5 mb-6 text-sm text-gray-600">
        <li className="flex items-start gap-3">
          <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gray-400" />
          <span>
            <span className="font-medium text-gray-900">Column order:</span>{" "}
            {BOOKING_CSV_HEADERS.join(", ")}.
          </span>
        </li>
        {BOOKING_CSV_RULES.map((rule) => (
          <li key={rule} className="flex items-start gap-3">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gray-400" />
            {rule}
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={downloadBookingCsvTemplate}
        className="w-fit flex items-center gap-2 border border-[#0F2757] bg-white hover:bg-gray-50 text-[#0F2757] font-medium py-2.5 px-5 rounded-lg transition-colors cursor-pointer text-[15px]"
      >
        <Download className="h-4 w-4" />
        Download CSV template
      </button>
    </div>
  );
}
