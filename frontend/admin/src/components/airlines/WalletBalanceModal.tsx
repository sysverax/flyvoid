"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Airline } from "@/src/types/airlines";
import { Dialog } from "@/src/components/ui/Dialog";

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
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount("");
      setRemarks("");
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen || !airline) return null;

  const isAdd = mode === "add";
  const currentBalance = airline.spend ?? 0;
  const currentK = (currentBalance / 1000).toFixed(1);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;
    if (!isAdd && !remarks.trim()) return;

    setIsSubmitting(true);
    try {
      await onSuccess(airline.id, val, remarks.trim());
      onClose();
    } catch {
    } finally {
      setIsSubmitting(false);
    }
  };

  const isButtonDisabled =
    isSubmitting ||
    !amount ||
    parseFloat(amount) <= 0 ||
    (!isAdd && !remarks.trim());

  return (
    <Dialog.Root isOpen={isOpen} onClose={isSubmitting ? () => { } : onClose}>
      <Dialog.Header
        title={isAdd ? "Add to Wallet Balance" : "Deduct from Wallet Balance"}
        subtitle={`${airline.airlineName} — current $${currentK}K`}
        onClose={isSubmitting ? () => { } : onClose}
      />
      <Dialog.Body>
        <form id="wallet-balance-form" onSubmit={handleSubmit} className="space-y-4 -mt-2">
          <div>
            <label className="block text-[14px] font-semibold text-[#1F2937] mb-1.5">
              Amount (USD)
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
              className="h-11 w-full rounded-lg border border-[#D1D5DB] bg-white px-3.5 text-[15px] font-medium text-[#1F2937] placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#1B2B6B]/20"
            />
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
              onChange={(e) => setRemarks(e.target.value)}
              required={!isAdd}
              className="w-full rounded-lg border border-[#D1D5DB] bg-[#F9FAFB] p-3 text-[14px] text-[#1F2937] placeholder-gray-400 focus:border-[#1B2B6B] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1B2B6B]/20 resize-none"
            />
          </div>
        </form>
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Cancel onClick={onClose} disabled={isSubmitting} />
        <Dialog.Action
          variant="primary"
          onClick={() => {
            const form = document.getElementById("wallet-balance-form") as HTMLFormElement;
            if (form) form.requestSubmit();
          }}
          disabled={isButtonDisabled}
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


