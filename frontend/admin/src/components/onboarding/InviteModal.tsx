"use client";

import { X } from "lucide-react";
import { InviteFormState, Invitation } from "@/src/types/onboarding";
import { cn } from "@/src/lib/utils";

const COUNTRIES = ["France", "Japan", "Switzerland", "Sweden", "United States", "Australia"];
const TIMEZONES = ["UTC", "UTC+1", "UTC+2", "UTC+5:30", "UTC+9", "UTC+10"];
const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD"];

interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formState: InviteFormState;
  setFormState: (s: InviteFormState) => void;
  editTarget?: Invitation | null;
}

export function InviteModal({
  isOpen,
  onClose,
  onSubmit,
  formState,
  setFormState,
  editTarget,
}: InviteModalProps) {
  const isEdit = !!editTarget;

  const field = (key: keyof InviteFormState) => ({
    value: formState[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setFormState({ ...formState, [key]: e.target.value }),
  });

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-[640px] bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5">
          <div>
            <h2 className="text-[24px] font-semibold text-[#1F2937]">
              {isEdit ? "Edit Invitation" : "Invite New Airline"}
            </h2>
            <p className="text-sm text-[#6B7280] mt-0.5">
              {isEdit
                ? "Update the airline & admin details for this invitation."
                : "Send an onboarding invitation with full airline and admin details."}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-[#1F2937]" />
          </button>
        </div>

         <div className="w-full" style={{ padding: "0px 24px" }}>
        <div className="h-px bg-[#D1D5DB] w-full" />
      </div>

        {/* Scrollable body */}
        <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-hide">
            <section>
              <h3 className="text-[18px] font-semibold text-[#1F2937] mb-4">Airline Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Airline Name" required>
                  <input placeholder="" {...field("airlineName")} className={inputCls} />
                </Field>
                <Field label="Airline Code" required>
                  <input placeholder="" {...field("airlineCode")} className={inputCls} />
                </Field>
                <Field label="Country" required>
                  <select {...field("country")} className={inputCls}>
                    {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Company Registration Number" required>
                  <input {...field("companyReg" as any)} className={inputCls} />
                </Field>
                <Field label="Website">
                  <input placeholder="https://" {...field("website" as any)} className={inputCls} />
                </Field>
                <Field label="Contact Email" required>
                  <input type="email" {...field("contactEmail")} className={inputCls} />
                </Field>
                <Field label="Contact Phone" required>
                  <input type="tel" {...field("phone" as any)} className={inputCls} />
                </Field>
                <Field label="Timezone" required>
                  <select {...field("timezone" as any)} className={inputCls}>
                    {TIMEZONES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Logo URL">
                  <input placeholder="https://..." {...field("logoUrl" as any)} className={inputCls} />
                </Field>
                <Field label="Currency" required>
                  <select {...field("currency" as any)} className={inputCls}>
                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Address" required className="col-span-2">
                  <input {...field("address" as any)} className={inputCls} />
                </Field>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#E5E7EB] flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-6 rounded-lg border border-[#D1D5DB] text-[#09090B] text-[18px] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-6 rounded-lg bg-[#0F2757] hover:bg-[#162259] text-white text-[18px] transition-colors cursor-pointer"
            >
              {isEdit ? "Save Changes" : "Save Invite"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────
const inputCls =
  "w-full px-4 py-3 rounded-lg border border-[#D1D5DB] text-[16px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B] transition-all placeholder:text-[#9CA3AF]";

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
    <div className={className}>
      <label className="block text-[16px] font-medium text-[#1F2937] mb-1.5">
        {label} {required && <span>*</span>}
      </label>
      {children}
    </div>
  );
}