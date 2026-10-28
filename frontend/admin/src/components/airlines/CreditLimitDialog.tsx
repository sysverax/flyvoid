"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
import { Dialog } from "@/src/components/ui/Dialog";
import { cn } from "@/src/lib/utils";
import { airlinesService, CreditLimitHistoryDTO } from "@/src/services/airlines.service";

const MAX_CREDIT_LIMIT = 9_999_999_999.99;

const money = (amount: number, currency: string) =>
  `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const changedAt = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function validateLimit(value: string): string {
  if (value.trim() === "") return "Enter a credit limit";
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return "Use 0 or more, with up to 2 decimal places";
  if (Number(value) > MAX_CREDIT_LIMIT) return "Credit limit is too large";
  return "";
}

function validateReason(value: string): string {
  const reason = value.trim();
  if (!reason) return "A reason is required";
  if (reason.length < 3) return "Reason must be at least 3 characters";
  if (reason.length > 255) return "Reason must be at most 255 characters";
  return "";
}

interface CreditLimitDialogProps {
  isOpen: boolean;
  airlineId: number;
  airlineName: string;
  onClose: () => void;
  /** Called with the new limit after a successful update. */
  onUpdated: (creditLimit: number) => void;
}

/**
 * Updates an onboarded airline's credit limit (any amount >= 0, reason
 * required) and lists its history. A limit below what the airline uses makes
 * available negative, which blocks new hotel allocations; runs already
 * booking are not affected.
 */
export function CreditLimitDialog({ isOpen, airlineId, airlineName, onClose, onUpdated }: CreditLimitDialogProps) {
  const [data, setData] = useState<CreditLimitHistoryDTO | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [limit, setLimit] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    // Fresh figures each time the dialog opens.
    (async () => {
      setIsLoading(true);
      setLoadError(null);
      setLimit("");
      setReason("");
      setTouched(false);
      try {
        const result = await airlinesService.getCreditLimitHistory(airlineId);
        if (!cancelled) {
          setData(result);
          setLimit(String(result.creditLimit));
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : "Failed to load the credit limit.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, airlineId]);

  const limitError = validateLimit(limit);
  const reasonError = validateReason(reason);
  const unchanged = !!data && !limitError && Number(limit) === data.creditLimit;
  const newAvailable = data && !limitError ? data.balance + Number(limit) - data.lockedAmount : null;

  const handleSave = async () => {
    setTouched(true);
    if (!data || limitError || reasonError || unchanged) return;
    setIsSaving(true);
    try {
      const result = await airlinesService.updateCreditLimit(airlineId, {
        creditLimit: Number(limit),
        reason: reason.trim(),
      });
      toast.success(`Credit limit updated to ${money(result.creditLimit, result.currency)}`);
      if (result.availableBalance < 0) {
        toast.warning("Available balance is negative: new hotel allocations are blocked until the wallet is topped up.");
      }
      onUpdated(result.creditLimit);
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update credit limit.");
    } finally {
      setIsSaving(false);
    }
  };

  const inputCls =
    "w-full h-11 rounded-[8px] border border-[#D1D5DB] bg-white px-3.5 text-[16px] text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary";
  const fieldError = (message: string) =>
    touched && message ? <p className="mt-1 text-xs text-red-500">{message}</p> : null;

  return (
    <Dialog.Root isOpen={isOpen} onClose={isSaving ? () => {} : onClose}>
      <Dialog.Header title="Update Credit Limit" subtitle={airlineName} onClose={isSaving ? () => {} : onClose} />
      <Dialog.Body>
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-[#0F2757]" />
          </div>
        ) : loadError || !data ? (
          <p className="py-6 text-[15px] text-red-600">{loadError ?? "Wallet not found."}</p>
        ) : (
          <div className="max-h-[60vh] space-y-5 overflow-y-auto pr-1 text-[15px]">
            {/* Current wallet */}
            <div className="grid grid-cols-2 gap-3 rounded-[10px] bg-[#F9FAFB] p-4 sm:grid-cols-4">
              {[
                ["Credit limit", data.creditLimit],
                ["Balance", data.balance],
                ["Locked", data.lockedAmount],
                ["Available", data.availableBalance],
              ].map(([label, value]) => (
                <div key={label as string}>
                  <p className="text-[13px] text-[#6B7280]">{label}</p>
                  <p
                    className={cn(
                      "font-semibold tabular-nums text-[#1F2937]",
                      (value as number) < 0 && "text-red-600",
                    )}
                  >
                    {money(value as number, data.currency)}
                  </p>
                </div>
              ))}
            </div>

            {/* New limit */}
            <div>
              <label className="mb-1.5 block text-[14px] font-medium text-[#374151]">
                New credit limit ({data.currency}) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={limit}
                onChange={(event) => setLimit(event.target.value)}
                className={cn(inputCls, touched && limitError && "border-red-500")}
              />
              {fieldError(limitError || (unchanged ? "Enter a different credit limit" : ""))}
              {newAvailable !== null && !unchanged && (
                <p className={cn("mt-1.5 text-[13px]", newAvailable < 0 ? "text-red-600" : "text-[#6B7280]")}>
                  Available will become {money(newAvailable, data.currency)}
                </p>
              )}
              {newAvailable !== null && newAvailable < 0 && !unchanged && (
                <div className="mt-2 flex gap-2 rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Available will be negative: new hotel allocations for this airline will be blocked until the wallet is
                    topped up. Allocations already booking are not affected.
                  </span>
                </div>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="mb-1.5 block text-[14px] font-medium text-[#374151]">
                Reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reason}
                maxLength={255}
                rows={2}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Increased after contract renewal"
                className={cn(inputCls, "h-auto py-2.5", touched && reasonError && "border-red-500")}
              />
              {fieldError(reasonError)}
            </div>

            {/* History */}
            <div>
              <p className="mb-2 text-[14px] font-semibold text-[#1F2937]">History</p>
              {data.history.length === 0 ? (
                <p className="text-[13px] text-[#9CA3AF]">No changes yet.</p>
              ) : (
                <ul className="divide-y divide-[#F3F4F6] rounded-[8px] border border-[#E5E7EB]">
                  {data.history.map((entry) => (
                    <li key={entry.id} className="px-3 py-2.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium tabular-nums text-[#1F2937]">
                          {money(entry.previousCreditLimit, data.currency)} → {money(entry.newCreditLimit, data.currency)}
                        </span>
                        <span className="text-[12px] text-[#6B7280]">{changedAt(entry.changedAt)}</span>
                      </div>
                      <p className="text-[13px] text-[#374151]">{entry.reason}</p>
                      {entry.changedBy && (
                        <p className="text-[12px] text-[#6B7280]">
                          by {entry.changedBy.name || entry.changedBy.email}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Cancel onClick={onClose} disabled={isSaving} />
        <Dialog.Action onClick={handleSave} disabled={isSaving || isLoading || !data}>
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          Update Limit
        </Dialog.Action>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
