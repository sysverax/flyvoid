"use client";

import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { Toast } from "@/src/types/common";

interface ToastListProps {
  toasts: Toast[];
}

const toastConfig = {
  success: {
    border: "border-l-green-500",
    iconColor: "text-green-500",
    textColor: "text-green-800",
    Icon: CheckCircle2,
  },
  warning: {
    border: "border-l-amber-500",
    iconColor: "text-amber-500",
    textColor: "text-amber-800",
    Icon: AlertTriangle,
  },
  info: {
    border: "border-l-blue-500",
    iconColor: "text-blue-500",
    textColor: "text-blue-800",
    Icon: Info,
  },
};

export function ToastList({ toasts }: ToastListProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-2.5 w-[340px]">
      {toasts.map((toast) => {
        const config = toastConfig[toast.type ?? "success"];
        const { Icon } = config;
        return (
          <div
            key={toast.id}
            className={cn(
              "flex items-start gap-3 px-4 py-3.5 bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.10)] border border-gray-100 border-l-4 animate-in slide-in-from-top-4 duration-300",
              config.border
            )}
          >
            <Icon className={cn("h-5 w-5 shrink-0 mt-0.5", config.iconColor)} />
            <span className={cn("text-[14px] font-medium leading-snug", config.textColor)}>
              {toast.message}
            </span>
          </div>
        );
      })}
    </div>
  );
}
