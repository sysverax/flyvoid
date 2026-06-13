"use client";

import { X } from "lucide-react";
import { cn } from "@/src/lib/utils";

function DialogRoot({
  isOpen,
  onClose,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div
        className="relative bg-white flex flex-col justify-center items-start py-6 gap-6"
        style={{ width: 560, borderRadius: 16 }}
      >
        {children}
      </div>
    </div>
  );
}

function DialogHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div
      className="flex flex-row justify-between items-center w-full"
      style={{
        padding: "0px 24px 24px",
        borderBottom: "1px solid #D1D5DB",
      }}
    >
      <h2
        className="text-[#1F2937]"
        style={{
          fontFamily: "Figtree",
          fontWeight: 600,
          fontSize: 24,
          lineHeight: "100%",
        }}
      >
        {title}
      </h2>
      <button
        onClick={onClose}
        className="p-1.5 rounded-lg transition-colors cursor-pointer flex-shrink-0"
      >
        <X className="w-5 h-5 text-[#1F2937]" />
      </button>
    </div>
  );
}

function DialogBody({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-6 text-[#6B7280] w-full"
      style={{
        fontFamily: "Figtree, sans-serif",
        fontWeight: 400,
        fontSize: 18,
        lineHeight: "150%",
      }}
    >
      {children}
    </div>
  );
}

function DialogFooter({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-3 px-6 w-full mt-4">{children}</div>;
}

function DialogCancelButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex-1 py-2.5 rounded-lg border border-[#D1D5DB] text-[#1F2937] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
      style={{
        fontFamily: "Figtree, sans-serif",
        fontSize: 18,
        fontWeight: 400,
      }}
    >
      Cancel
    </button>
  );
}

function DialogActionButton({
  onClick,
  variant = "primary",
  children,
}: {
  onClick: () => void;
  variant?: "primary" | "danger";
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex-1 py-2.5 rounded-lg text-white transition-colors cursor-pointer",
        variant === "danger"
          ? "bg-[#EF4444] hover:bg-[#dc2626]"
          : "bg-[#1B2B6B] hover:bg-[#162259]",
      )}
      style={{
        fontFamily: "Figtree, sans-serif",
        fontSize: 18,
        fontWeight: 400,
      }}
    >
      {children}
    </button>
  );
}

export const Dialog = {
  Root: DialogRoot,
  Header: DialogHeader,
  Body: DialogBody,
  Footer: DialogFooter,
  Cancel: DialogCancelButton,
  Action: DialogActionButton,
};
