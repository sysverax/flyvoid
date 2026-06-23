import React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/src/lib/utils";

interface InputFieldProps {
  label: string;
  type?: string;
  value?: string;
  onChange?: (val: string) => void;
  disabled?: boolean;
  placeholder?: string;
  showPasswordToggle?: boolean;
  showPassword?: boolean;
  onPasswordToggle?: () => void;
  helperText?: string;
}

export const InputField = ({
  label,
  type = "text",
  value,
  onChange,
  disabled,
  placeholder,
  showPasswordToggle,
  showPassword,
  onPasswordToggle,
  helperText,
}: InputFieldProps) => {
  const inputType =
    type === "password" && showPassword ? "text" : type;

  return (
    <div
      className={cn(
        "self-stretch flex flex-col justify-start items-start",
        helperText ? "gap-2" : "min-h-16"
      )}
    >
      <div className="self-stretch flex flex-col justify-start items-start gap-2 w-full">
        <label className="justify-start text-gray-800 text-base font-medium font-figtree leading-[100%] tracking-[0%]">
          {label}
        </label>

        <div className="self-stretch relative flex items-center w-full">
          <input
            type={inputType}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            disabled={disabled}
            placeholder={placeholder}
            className={cn(
              "w-full h-[41px] px-4 pt-4 pb-3 bg-gray-100 rounded-[10px] outline outline-1 outline-offset-[-1px] outline-gray-300 text-base font-figtree transition-all",
              disabled
                ? "text-gray-500 cursor-not-allowed select-none"
                : "text-gray-800 focus:bg-white focus:outline-primary focus:ring-2 focus:ring-primary/20"
            )}
          />

          {showPasswordToggle && (
            <button
              type="button"
              onClick={onPasswordToggle}
              className="absolute right-4 text-gray-500 hover:text-gray-800 cursor-pointer flex items-center justify-center"
            >
              {showPassword ? (
                <EyeOff className="size-5" />
              ) : (
                <Eye className="size-5" />
              )}
            </button>
          )}
        </div>
      </div>

      {helperText && (
        <p className="self-stretch justify-start text-gray-500 text-xs font-normal font-figtree">
          {helperText}
        </p>
      )}
    </div>
  );
};