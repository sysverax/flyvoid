"use client";

import { cn } from "@/src/lib/utils";
import {
  SPECIAL_NOTE_PRESETS,
  appendNote,
  notesInclude,
} from "@/src/lib/booking-fields";

export interface SpecialNotesFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Special Notes as one editable text. Clicking a preset appends it,
 * comma-separated; anything else can be typed in the same field.
 */
export function SpecialNotesField({ value, onChange }: SpecialNotesFieldProps) {
  return (
    <div className="flex flex-col gap-2 pt-1.5">
      <label className="text-base font-semibold text-gray-600">
        Special Notes (Optional)
      </label>

      <div className="flex flex-wrap gap-1.5 mb-1.5">
        {SPECIAL_NOTE_PRESETS.map((preset) => {
          const isListed = notesInclude(value, preset);
          return (
            <button
              key={preset}
              type="button"
              onClick={() => onChange(appendNote(value, preset))}
              disabled={isListed}
              title={isListed ? "Already in the notes" : `Add "${preset}"`}
              className={cn(
                "rounded-full border text-xs px-3 py-1.5 font-medium transition-all",
                isListed
                  ? "bg-[#0F2757] text-white border-[#0F2757] cursor-default"
                  : "bg-white hover:bg-slate-50 border-gray-200 text-gray-600 hover:border-gray-300 cursor-pointer",
              )}
            >
              {preset}
            </button>
          );
        })}
      </div>

      <input
        type="text"
        placeholder="e.g. Wheelchair Assistance, Needs a baby cot"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="block h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-base text-gray-900 bg-[#F9FAFB] focus:bg-white focus:border-[#0F2757] focus:outline-none"
      />
      <p className="text-xs text-gray-400">
        Click a preset to add it, or type your own notes. Separate notes with
        commas.
      </p>
    </div>
  );
}
