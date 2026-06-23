"use client";

import { Lock, Mail, ChevronDown, ChevronsUpDown, X, Plus } from "lucide-react";
import { useState, useEffect } from "react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";

interface PlatformReserveModalProps {
  isOpen: boolean;
  onClose: () => void;
  reserveValue: number;
  onConfirm: (type: "Deposit" | "Withdrawal", amount: number, email: string, note: string) => void;
}

export function PlatformReserveModal({
  isOpen,
  onClose,
  reserveValue,
  onConfirm,
}: PlatformReserveModalProps) {
  const [reserveEmail, setReserveEmail] = useState("you@flyvoid.com");
  const [reserveAmount, setReserveAmount] = useState("");
  const [reserveNote, setReserveNote] = useState("");

  useLockBodyScroll(isOpen);

  // Reset fields when modal is opened/closed
  useEffect(() => {
    if (!isOpen) {
      setReserveAmount("");
      setReserveNote("");
      setReserveEmail("you@flyvoid.com");
    }
  }, [isOpen]);

  const handleSubmit = () => {
    const amountNum = Number(reserveAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    onConfirm("Deposit", amountNum, reserveEmail, reserveNote);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div
        className="relative bg-white flex flex-col p-[31px] items-stretch justify-between border border-[#E5E7EB]"
        style={{
          boxSizing: "border-box",
          gap: "24px",
          width: "454px",
          borderRadius: "16px",
        }}
      >
        {/* Form Content Group */}
        <div className="flex flex-col gap-[24px] w-full">
          {/* Header */}
          <div className="flex flex-col gap-2 relative">
            {/* <button
              onClick={onClose}
              className="absolute top-0 right-0 p-1.5 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer flex-shrink-0"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button> */}
            <div className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-[#0F2757]" />
              <h2 className="text-gray-800 text-lg font-semibold font-figtree leading-7">
                Platform Reserve
              </h2>
            </div>
            <p className="text-gray-500 text-sm font-normal font-figtree pr-8">
              Add or withdraw funds from the platform reserve used to back airline credit.
            </p>
          </div>

          {/* Current Reserve Box */}
          <div className="h-[64px] w-full py-3 bg-gray-100 rounded-[8px] flex flex-col items-center justify-center">
            <span className="text-gray-500 text-xs font-normal font-figtree">
              Current Reserve
            </span>
            <span className="text-gray-800 text-xl font-semibold font-figtree">
              ${reserveValue.toLocaleString()}
            </span>
          </div>

          {/* Form Fields */}
          <div className="flex flex-col gap-4">
            {/* Email Address */}
            <div className="flex flex-col gap-1.5">
              <span className="text-gray-800 text-base font-semibold font-figtree">
                Email Address
              </span>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Mail className="w-4 h-4 text-gray-500" />
                </div>
                <select
                  value={reserveEmail}
                  onChange={(e) => setReserveEmail(e.target.value)}
                  className="w-full pl-10 pr-10 py-2.5 bg-white border border-[#D1D5DB] rounded-lg text-gray-500 text-base font-normal font-figtree outline-none appearance-none cursor-pointer focus:border-blue-900 transition-colors"
                >
                  <option value="you@flyvoid.com">you@flyvoid.com</option>
                  <option value="john.smith@flyvoid.com">john.smith@flyvoid.com</option>
                  <option value="jane.doe@flyvoid.com">jane.doe@flyvoid.com</option>
                  <option value="emily.white@flyvoid.com">emily.white@flyvoid.com</option>
                  <option value="michael.johnson@flyvoid.com">michael.johnson@flyvoid.com</option>
                  <option value="sarah.brown@flyvoid.com">sarah.brown@flyvoid.com</option>
                </select>
                <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-gray-400">
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                </div>
              </div>
            </div>

            {/* Amount (USD) */}
            <div className="flex flex-col gap-1.5">
              <span className="text-gray-800 text-base font-semibold font-figtree">
                Amount (USD)
              </span>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500 text-base font-normal font-figtree">
                  $
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={reserveAmount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "" || /^[0-9]*\.?[0-9]*$/.test(val)) {
                      setReserveAmount(val);
                    }
                  }}
                  className="w-full pl-8 pr-10 py-2.5 bg-white border border-[#D1D5DB] rounded-lg text-gray-500 text-base font-normal font-figtree outline-none focus:border-blue-900 transition-colors"
                />
                <div
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const clickY = e.clientY - rect.top;
                    const isUp = clickY < rect.height / 2;
                    const currentVal = Number(reserveAmount) || 0;
                    const step = 1;
                    const newVal = isUp ? currentVal + step : Math.max(0, currentVal - step);
                    setReserveAmount(newVal === 0 ? "" : String(newVal));
                  }}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center cursor-pointer text-gray-500 hover:text-gray-700 select-none"
                >
                  <ChevronsUpDown className="w-4 h-4" />
                </div>
              </div>
            </div>

            {/* Note (Optional) */}
            <div className="flex flex-col gap-1.5">
              <span className="text-gray-800 text-base font-semibold font-figtree">
                Note (Optional)
              </span>
              <textarea
                placeholder="Add a note for this transaction..."
                maxLength={500}
                value={reserveNote}
                onChange={(e) => setReserveNote(e.target.value)}
                rows={3}
                className="h-[89px] w-full px-3.5 py-2.5 bg-white border border-[#D1D5DB] rounded-lg text-gray-500 text-base font-normal font-figtree outline-none focus:border-blue-900 transition-colors resize-none"
              />
              <div className="text-right text-gray-500 text-xs font-normal font-figtree -mt-0.5">
                {reserveNote.length}/500
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 w-full">
          <button
            type="button"
            onClick={onClose}
            className="h-[48px] flex-1 py-2.5 rounded-lg border border-[#D1D5DB] text-gray-800 text-base font-normal font-figtree hover:bg-gray-50 transition-colors cursor-pointer bg-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!reserveAmount || Number(reserveAmount) <= 0}
            className="h-[48px] flex-1 py-2.5 rounded-lg text-white text-[16px] font-normal font-figtree bg-[#0F2757] hover:bg-[#0b1d42] transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>Deposit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
