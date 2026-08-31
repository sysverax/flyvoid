"use client";

import { useState, useRef, useEffect } from "react";
import { X, Info, Upload, CreditCard, Plus, Check, Loader2 } from "lucide-react";
import { AddCardModal } from "./AddCardModal";

interface PaymentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  balance: number;
  onPaymentComplete: (amount: number, method: "card" | "bank", title: string, description: string) => void;
}

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expiry: string;
  isDefault: boolean;
}

const inputCls =
  "w-full px-4 py-3 rounded-lg border border-[#D1D5DB] text-[16px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#0F2757]/20 focus:border-[#0F2757] transition-all placeholder:text-[#9CA3AF]";

function Field({
  label,
  required,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-[7.5px] items-stretch ${className || ""}`}>
      <span className="text-[16px] font-semibold text-[#1F2937] leading-[100%] font-figtree">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </div>
  );
}

export function PaymentDrawer({
  isOpen,
  onClose,
  balance,
  onPaymentComplete,
}: PaymentDrawerProps) {
  const [activeTab, setActiveTab] = useState<"card" | "bank">("card");
  const [amount, setAmount] = useState<string>("");
  const [selectedCardId, setSelectedCardId] = useState<string>("1");
  const [isAddingCard, setIsAddingCard] = useState(false);

  // Card Form State
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [cardName, setCardName] = useState("");
  const [isDefaultOnAdd, setIsDefaultOnAdd] = useState(false);

  // Bank Transfer State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [reference, setReference] = useState("");

  // Transaction State
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initial cards list
  const [cards, setCards] = useState<SavedCard[]>([
    { id: "1", brand: "Visa", last4: "4242", expiry: "08/28", isDefault: true },
    { id: "2", brand: "Mastercard", last4: "5599", expiry: "03/27", isDefault: false },
  ]);

  // Reset state when drawer is opened or closed
  useEffect(() => {
    if (!isOpen) {
      // Delay reset so transitions finish
      const timer = setTimeout(() => {
        setAmount("");
        setActiveTab("card");
        setSelectedCardId("1");
        setIsAddingCard(false);
        setCardNumber("");
        setCardExpiry("");
        setCardCvc("");
        setCardName("");
        setIsDefaultOnAdd(false);
        setUploadedFile(null);
        setReference("");
        setIsSuccess(false);
        setSuccessMessage("");
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Handle outside click or Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Format Card Number (adds spaces every 4 digits)
  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    const formatted = val.match(/.{1,4}/g)?.join(" ") || "";
    setCardNumber(formatted.substring(0, 19));
  };

  // Format Expiry (adds slash MM/YY)
  const handleExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 2) {
      val = val.substring(0, 2) + "/" + val.substring(2, 4);
    }
    setCardExpiry(val.substring(0, 5));
  };

  // Format CVC (max 3 or 4 digits)
  const handleCvcChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    setCardCvc(val.substring(0, 4));
  };

  // Add Card handler
  const handleSaveCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardNumber || !cardExpiry || !cardCvc || !cardName) return;

    const brand = cardNumber.startsWith("4") ? "Visa" : "Mastercard";
    const last4 = cardNumber.replace(/\s/g, "").slice(-4) || "0000";

    const newCard: SavedCard = {
      id: Date.now().toString(),
      brand,
      last4,
      expiry: cardExpiry,
      isDefault: isDefaultOnAdd,
    };

    let updatedCards = [...cards];
    if (isDefaultOnAdd) {
      // Unset previous defaults
      updatedCards = updatedCards.map((c) => ({ ...c, isDefault: false }));
    }
    updatedCards.push(newCard);

    setCards(updatedCards);
    setSelectedCardId(newCard.id);
    setIsAddingCard(false);

    // Clear inputs
    setCardNumber("");
    setCardExpiry("");
    setCardCvc("");
    setCardName("");
    setIsDefaultOnAdd(false);
  };

  // Set card as default manually
  const handleMakeDefault = (cardId: string) => {
    setCards((prev) =>
      prev.map((c) => ({
        ...c,
        isDefault: c.id === cardId,
      }))
    );
  };

  // File Upload Handlers
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
    }
  };

  const handleRemoveFile = (e: React.MouseEvent) => {
    e.stopPropagation();
    setUploadedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Process payment submission
  const handleSubmit = () => {
    const paymentAmount = amount === "" ? balance : parseFloat(amount);

    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      alert("Please enter a valid amount.");
      return;
    }

    if (activeTab === "bank" && !uploadedFile) {
      alert("Please upload a payment receipt.");
      return;
    }

    setIsProcessing(true);

    // Simulate server response
    setTimeout(() => {
      setIsProcessing(false);
      onClose(); // Close the drawer immediately

      if (activeTab === "card") {
        const selectedCard = cards.find((c) => c.id === selectedCardId);
        const title = "Payment Successful";
        const desc = `Payment of $${paymentAmount.toLocaleString()} processed successfully using your ${selectedCard?.brand || "Card"} ending in ${selectedCard?.last4 || "Card"}.`;
        onPaymentComplete(paymentAmount, "card", title, desc);
      } else {
        const title = "Payment Submitted";
        const desc = `Your payment of $${paymentAmount.toLocaleString()} has been submitted for review. It usually takes 1-2 business days for validation.`;
        onPaymentComplete(paymentAmount, "bank", title, desc);
      }
    }, 1500);
  };

  // Determine current effective amount for button label
  const displayAmount = amount === "" ? 0 : parseFloat(amount);
  const selectedProduct = cards.find((c) => c.id === selectedCardId);
  const isSelectedCardDefault = selectedProduct?.isDefault ?? false;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 transition-opacity duration-300 ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
        onClick={onClose}
      />

      {/* Drawer Container */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-[640px] bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out transform ${isOpen ? "translate-x-0" : "translate-x-full"
          }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5">
          <div className="flex flex-col">
            <h2 className="text-[24px] font-semibold text-[#1F2937] font-figtree">
              Pay Outstanding Balance
            </h2>
            <p className="text-sm text-[#6B7280] mt-0.5 font-figtree">
              Balance: ${balance.toLocaleString()}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors cursor-pointer text-[#1F2937] hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Separator Line */}
        <div className="w-full" style={{ padding: "0px 24px" }}>
          <div className="h-px bg-[#D1D5DB] w-full" />
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-hide relative -left-0.5">
          {isSuccess ? (
            /* Success Screen */
            <div className="flex flex-col items-center justify-center text-center py-8 h-full">
              <div className="size-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 animate-bounce shadow-sm">
                <Check className="h-8 w-8 stroke-[2.5]" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">
                {activeTab === "card" ? "Payment Successful" : "Payment Submitted"}
              </h3>
              <p className="text-gray-600 max-w-sm mb-8 leading-relaxed font-figtree px-4">
                {successMessage}
              </p>
              <button
                onClick={onClose}
                className="w-full max-w-[240px] bg-[#0F2757] hover:bg-[#162259] text-white font-medium py-3 px-6 rounded-lg transition-colors cursor-pointer text-base"
              >
                Close Drawer
              </button>
            </div>
          ) : (
            /* Main Form */
            <div className="flex flex-col gap-6">
              {/* Amount to pay input */}
              <Field label="Amount to pay (USD)">
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <span className="text-[#9CA3AF] text-[16px] font-medium">$</span>
                  </div>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder=""
                    min="1"
                    max={balance}
                    disabled={isProcessing}
                    className={`${inputCls} pl-8`}
                  />
                </div>
                <span className="text-xs text-[#6B7280] font-figtree mt-0.5">
                  Defaults to your full balance. You can pay a partial amount.
                </span>
              </Field>

              {/* Tabs */}
              <div className="flex p-1 bg-gray-100 rounded-xl">
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => {
                    setActiveTab("card");
                    setIsAddingCard(false);
                  }}
                  className={`flex-1 py-2.5 px-3 text-center text-sm font-semibold rounded-lg transition-all cursor-pointer ${activeTab === "card"
                      ? "bg-white text-[#1F2937] shadow-xs"
                      : "text-gray-500 hover:text-gray-900"
                    }`}
                >
                  Pay by Card
                </button>
                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setActiveTab("bank")}
                  className={`flex-1 py-2.5 px-3 text-center text-sm font-semibold rounded-lg transition-all cursor-pointer ${activeTab === "bank"
                      ? "bg-white text-[#1F2937] shadow-xs"
                      : "text-gray-500 hover:text-gray-900"
                    }`}
                >
                  Bank Transfer
                </button>
              </div>

              {/* Dynamic View */}
              {activeTab === "card" ? (
                <div className="flex flex-col gap-5">
                  <AddCardModal isOpen={isAddingCard} onClose={() => setIsAddingCard(false)} />
                  {/* Saved Cards List */}
                  <div className="flex flex-col gap-3">
                    {cards.map((card) => {
                      const isSelected = card.id === selectedCardId;
                      return (
                        <div
                          key={card.id}
                          onClick={() => setSelectedCardId(card.id)}
                          className={`flex items-center justify-between p-4 border rounded-xl cursor-pointer transition-all ${isSelected
                              ? "border-[#0F2757] bg-[#0F2757]/5 ring-1 ring-[#0F2757]"
                              : "border-[#E5E7EB] bg-gray-50/30 hover:bg-gray-50"
                            }`}
                        >
                          <div className="flex items-center">
                            <div className="p-2.5 bg-white border border-gray-200 rounded-lg flex items-center justify-center size-10.5 text-gray-700 shrink-0 shadow-2xs">
                              <CreditCard className="h-5 w-5 text-gray-500" />
                            </div>
                            <div className="flex flex-col ml-3.5">
                              <div className="flex items-center text-sm font-semibold text-gray-900 font-figtree">
                                <span>{card.brand} •••• {card.last4}</span>
                                {card.isDefault && (
                                  <span className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full font-medium ml-2 font-figtree">
                                    Default
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-gray-500 font-figtree mt-0.5">
                                Expires {card.expiry}
                              </span>
                            </div>
                          </div>

                          {/* Checkmark selection dot */}
                          {isSelected && (
                            <div className="size-5 bg-[#0F2757] text-white rounded-full flex items-center justify-center p-0.5 shrink-0 shadow-xs">
                              <Check className="h-3 w-3 stroke-[2.5]" />
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Row containing both Add New Card and Make Default buttons */}
                    <div className="flex items-center gap-3 mt-1.5 animate-fadeIn">
                      {/* Add Card Button */}
                      <button
                        type="button"
                        onClick={() => setIsAddingCard(true)}
                        className="flex items-center gap-1.5 py-2.5 px-4 border border-[#D1D5DB] text-sm font-semibold hover:bg-gray-50 cursor-pointer bg-white text-[#1F2937] shadow-2xs rounded-lg"
                      >
                        <Plus className="h-4 w-4 text-gray-500" />
                        Add New Card
                      </button>

                      {/* Make Default Button */}
                      <button
                        type="button"
                        onClick={() => handleMakeDefault(selectedCardId)}
                        disabled={isSelectedCardDefault}
                        className="flex items-center gap-1.5 py-2.5 px-4 border border-[#D1D5DB] text-sm font-semibold hover:bg-gray-50 cursor-pointer bg-white text-[#1F2937] shadow-2xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Make Default
                      </button>
                    </div>

                    {/* Pay Button inline at the bottom of the section */}
                    <button
                      type="button"
                      disabled={isProcessing}
                      onClick={handleSubmit}
                      className="w-full bg-[#0F2757] hover:bg-[#162259] text-white font-medium py-3 px-4 rounded-lg mt-4 transition-colors flex items-center justify-center text-base cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="h-5 w-5 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        `Pay $${displayAmount.toLocaleString()}`
                      )}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-6 animate-fadeIn">
                  {/* Alert box */}
                  <div className="flex gap-3 p-4 bg-[#F9FAFB] border border-[#D1D5DB] rounded-xl text-sm text-[#4B5563] font-figtree shadow-2xs leading-relaxed">
                    <Info className="h-5 w-5 text-[#0F2757] shrink-0 mt-0.5" />
                    <p>
                      Bank transfer payments are reviewed by our team before your balance is updated. This usually takes 1–2 business days.
                    </p>
                  </div>

                  {/* Upload box */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[16px] font-semibold text-[#1F2937] font-figtree">
                      Payment receipt (PDF, JPG, PNG)
                    </label>
                    <div className="flex items-center gap-3.5 mt-0.5">
                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept=".pdf,image/png,image/jpeg,image/jpg"
                        className="hidden"
                      />
                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={triggerFileInput}
                        className="flex items-center gap-2 py-2.5 px-4 border border-[#D1D5DB] rounded-lg text-sm font-semibold hover:bg-gray-50 bg-white text-[#1F2937] cursor-pointer shadow-2xs shrink-0"
                      >
                        <Upload className="h-4 w-4 text-gray-500" />
                        Upload Receipt
                      </button>
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-sm text-gray-500 truncate font-figtree">
                          {uploadedFile ? uploadedFile.name : "No file selected"}
                        </span>
                        {uploadedFile && (
                          <button
                            type="button"
                            onClick={handleRemoveFile}
                            className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Reference input */}
                  <Field label="Reference / note (optional)">
                    <input
                      type="text"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      placeholder="Transaction ID or note"
                      disabled={isProcessing}
                      className={inputCls}
                    />
                  </Field>

                  {/* Submit for Verification Button inline at the bottom of the section */}
                  <button
                    type="button"
                    disabled={isProcessing || !uploadedFile}
                    onClick={handleSubmit}
                    className="w-full bg-[#0F2757] hover:bg-[#162259] text-white font-medium py-3 px-4 rounded-lg mt-2 transition-colors flex items-center justify-center text-base cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                        Submitting...
                      </>
                    ) : (
                      "Submit for Verification"
                    )}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
