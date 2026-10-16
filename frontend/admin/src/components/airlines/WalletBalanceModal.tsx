"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Airline } from "@/src/types/airlines";
import { Dialog } from "@/src/components/ui/Dialog";
import { cn } from "@/src/lib/utils";

export type WalletModalMode = "add" | "deduct";

interface WalletBalanceModalProps {
  isOpen: boolean;
  mode: WalletModalMode;
  airline: Airline | null;
  onClose: () => void;
  onSuccess: (airlineId: string, amount: number, remarks: string) => Promise<void> | void;
}

export function WalletBalanceModal({
  isOpen,
  mode,
  airline,
  onClose,
  onSuccess,
}: WalletBalanceModalProps) {
  const [amount, setAmount] = useState("");
  const [remarks, setRemarks] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; remarks?: string }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setRemarks("");
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen || !airline) return null;

  const isAdd = mode === "add";
  const currentBalance = airline.spend ?? 0;
  const currentK = (currentBalance / 1000).toFixed(1);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value;
    if (val.includes("-")) {
      val = val.replace(/-/g, "");
    }
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed < 0) {
      val = Math.abs(parsed).toString();
    }
    setAmount(val);
    if (errors.amount) {
      setErrors((prev) => ({ ...prev, amount: undefined }));
    }
  };

  const validate = () => {
    const newErrors: { amount?: string; remarks?: string } = {};

    if (!amount || !amount.trim()) {
      newErrors.amount = "Amount is required";
    } else {
      const val = parseFloat(amount);
      if (isNaN(val) || val <= 0) {
        newErrors.amount = "Amount must be greater than 0";
      }
    }

    if (!isAdd && (!remarks || !remarks.trim())) {
      newErrors.remarks = "Remarks are required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isSubmitting) return;

    if (!validate()) return;

    const val = parseFloat(amount);
    setIsSubmitting(true);
    try {
      await onSuccess(airline.id, val, remarks.trim());
      onClose();
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog.Root isOpen={isOpen} onClose={isSubmitting ? () => { } : onClose}>
      <Dialog.Header
        title={isAdd ? "Add to Wallet Balance" : "Deduct from Wallet Balance"}
        subtitle={`${airline.airlineName} — current $${currentK}K`}
        onClose={isSubmitting ? () => { } : onClose}
      />
      <Dialog.Body>
        <form
          id="wallet-balance-form"
          onSubmit={handleSubmit}
          noValidate
          className="space-y-4 -mt-2"
        >
          <div>
            <label className="block text-[14px] font-semibold text-[#1F2937] mb-1.5">
              Amount (USD) <span className="text-[#EF4444]">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={handleAmountChange}
              onKeyDown={(e) => {
                if (
                  e.key === "-" ||
                  e.key === "e" ||
                  e.key === "E" ||
                  e.key === "+"
                ) {
                  e.preventDefault();
                }
              }}
              onPaste={(e) => {
                const pasteData = e.clipboardData.getData("text");
                if (pasteData.includes("-")) {
                  e.preventDefault();
                  const cleanData = pasteData.replace(/-/g, "");
                  if (cleanData) {
                    setAmount(cleanData);
                    if (errors.amount) {
                      setErrors((prev) => ({ ...prev, amount: undefined }));
                    }
                  }
                }
              }}
              autoFocus
              className={cn(
                "h-11 w-full rounded-lg border bg-white px-3.5 text-[15px] font-medium text-[#1F2937] placeholder-gray-400 focus:outline-none focus:ring-2",
                errors.amount
                  ? "border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20"
                  : "border-[#D1D5DB] focus:border-[#1B2B6B] focus:ring-[#1B2B6B]/20"
              )}
            />
            {errors.amount && (
              <p className="mt-1.5 text-xs text-[#EF4444] font-medium">
                {errors.amount}
              </p>
            )}
          </div>

          <div>
            <label className="block text-[14px] font-semibold text-[#1F2937] mb-1.5">
              Remarks{" "}
              {isAdd ? (
                <span className="text-[#6B7280] font-normal">(optional)</span>
              ) : (
                <span className="text-[#EF4444]">*</span>
              )}
            </label>
            <textarea
              rows={3}
              placeholder={
                isAdd
                  ? "Add a note (optional)"
                  : "Reason for deduction (required)"
              }
              value={remarks}
              onChange={(e) => {
                setRemarks(e.target.value);
                if (errors.remarks) {
                  setErrors((prev) => ({ ...prev, remarks: undefined }));
                }
              }}
              className={cn(
                "w-full rounded-lg border bg-[#F9FAFB] p-3 text-[14px] text-[#1F2937] placeholder-gray-400 focus:bg-white focus:outline-none focus:ring-2 resize-none",
                errors.remarks
                  ? "border-[#EF4444] focus:border-[#EF4444] focus:ring-[#EF4444]/20"
                  : "border-[#D1D5DB] focus:border-[#1B2B6B] focus:ring-[#1B2B6B]/20"
              )}
            />
            {errors.remarks && (
              <p className="mt-1.5 text-xs text-[#EF4444] font-medium">
                {errors.remarks}
              </p>
            )}
          </div>
        </form>
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Cancel onClick={onClose} disabled={isSubmitting} />
        <Dialog.Action
          variant="primary"
          onClick={() => handleSubmit()}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-white" />
              <span>{isAdd ? "Adding..." : "Deducting..."}</span>
            </>
          ) : isAdd ? (
            "Add Amount"
          ) : (
            "Deduct Amount"
          )}
        </Dialog.Action>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
