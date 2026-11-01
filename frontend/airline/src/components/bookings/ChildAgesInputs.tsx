"use client";

import { cn } from "@/src/lib/utils";
import { MAX_CHILD_AGE } from "@/src/lib/constants";

export interface ChildAgesInputsProps {
  ages: string[];
  onChange: (ages: string[]) => void;
  onBlur?: () => void;
  /** Per-input error messages ("" = valid), shown once touched. */
  errors: string[];
  touched: boolean;
}

/** One age input per child, shown when Children is more than 0. */
export function ChildAgesInputs({
  ages,
  onChange,
  onBlur,
  errors,
  touched,
}: ChildAgesInputsProps) {
  if (ages.length === 0) return null;
  const firstError = touched ? errors.find(Boolean) : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[15px] font-medium text-[#1F2937]">
        Child Ages *
      </label>
      <div className="flex flex-wrap gap-3">
        {ages.map((age, index) => (
          <div key={index} className="flex flex-col gap-1 w-[110px]">
            <span className="text-xs text-gray-500">Child {index + 1}</span>
            <input
              type="number"
              min={0}
              max={MAX_CHILD_AGE}
              inputMode="numeric"
              placeholder={`0–${MAX_CHILD_AGE}`}
              aria-label={`Child ${index + 1} age`}
              value={age}
              onChange={(e) => {
                const next = [...ages];
                next[index] = e.target.value;
                onChange(next);
              }}
              onKeyDown={(e) => {
                if (["-", "e", "+", ".", ","].includes(e.key)) e.preventDefault();
              }}
              onBlur={onBlur}
              className={cn(
                "block h-[42px] w-full rounded-lg border px-3 text-[15px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 transition-all placeholder:text-[#9CA3AF]",
                touched && errors[index]
                  ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                  : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]",
              )}
            />
          </div>
        ))}
      </div>
      {firstError && (
        <p className="step2-field-error mt-0.5 text-xs text-red-500">
          {firstError}
        </p>
      )}
    </div>
  );
}
