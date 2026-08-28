import React, { useState } from "react";
import { X } from "lucide-react";

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
}

export function AddCardModal({ isOpen, onClose, onSave }: AddCardModalProps) {
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [isDefaultOnAdd, setIsDefaultOnAdd] = useState(false);

  if (!isOpen) return null;

  const inputCls =
    "w-full px-4 py-3 rounded-lg border border-[#D1D5DB] text-[16px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#0F2757]/20 focus:border-[#0F2757] transition-all placeholder:text-[#9CA3AF]";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSave) onSave();
    onClose();
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    val = val.replace(/(.{4})/g, "$1 ").trim();
    setCardNumber(val.slice(0, 19));
  };

  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length >= 2) {
      val = val.slice(0, 2) + "/" + val.slice(2, 4);
    }
    setCardExpiry(val);
  };

  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    setCardCvc(val.slice(0, 4));
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden relative">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-6">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-2">
            <span className="text-lg font-bold text-[#1F2937] font-figtree">Add New Card</span>
            <button
              type="button"
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-[#1F2937] font-figtree">Cardholder Name</label>
            <input
              type="text"
              required
              value={cardName}
              onChange={(e) => setCardName(e.target.value)}
              placeholder="e.g. John Doe"
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold text-[#1F2937] font-figtree">Card Number</label>
            <input
              type="text"
              required
              value={cardNumber}
              onChange={handleCardNumberChange}
              placeholder="4000 1234 5678 9010"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[#1F2937] font-figtree">Expiry Date</label>
              <input
                type="text"
                required
                value={cardExpiry}
                onChange={handleExpiryChange}
                placeholder="MM/YY"
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[#1F2937] font-figtree">CVC</label>
              <input
                type="text"
                required
                value={cardCvc}
                onChange={handleCvcChange}
                placeholder="123"
                maxLength={4}
                className={inputCls}
              />
            </div>
          </div>

          {/* Set as default card checkbox option */}
          <div className="flex items-center mt-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isDefaultOnAdd}
                onChange={(e) => setIsDefaultOnAdd(e.target.checked)}
                className="size-4.5 rounded border-[#D1D5DB] text-[#0F2757] focus:ring-[#0F2757]/20 cursor-pointer"
              />
              <span className="text-sm font-medium text-[#1F2937] font-figtree">
                Set as default card
              </span>
            </label>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-lg border border-[#D1D5DB] text-[#09090B] text-base font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 rounded-lg bg-[#0F2757] hover:bg-[#162259] text-white text-base font-semibold transition-colors cursor-pointer"
            >
              Save Card
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
