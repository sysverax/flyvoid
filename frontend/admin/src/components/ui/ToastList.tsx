"use client";

import { Check, AlertCircle } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { Toast } from "@/src/types/common";

interface ToastListProps {
  toasts: Toast[];
}

export function ToastList({ toasts }: ToastListProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-md w-full">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            "flex items-center gap-3 p-4 rounded-xl border shadow-lg bg-white transition-all duration-300 animate-in slide-in-from-bottom-5",
            toast.type === "success" && "border-green-150 bg-green-50/50 text-green-800",
            toast.type === "warning" && "border-amber-150 bg-amber-50/50 text-amber-800",
            toast.type === "info" && "border-blue-150 bg-blue-50/50 text-blue-800"
          )}
        >
          {toast.type === "success" && <Check className="w-5 h-5 text-green-600 shrink-0" />}
          {toast.type === "warning" && <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />}
          {toast.type === "info" && <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      ))}
    </div>
  );
}
