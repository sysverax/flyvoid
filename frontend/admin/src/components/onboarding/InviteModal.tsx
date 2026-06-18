"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { InviteFormState, Invitation } from "@/src/types/onboarding";
import { cn } from "@/src/lib/utils";
import { Dropdown, DropdownOption } from "@/src/components/ui/Dropdown";

const COUNTRIES: DropdownOption[] = [
  { value: "France", label: "France" },
  { value: "Japan", label: "Japan" },
  { value: "Switzerland", label: "Switzerland" },
  { value: "Sweden", label: "Sweden" },
  { value: "United States", label: "United States" },
  { value: "Australia", label: "Australia" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "Germany", label: "Germany" },
  { value: "India", label: "India" },
  { value: "Canada", label: "Canada" },
];

const TIMEZONES: DropdownOption[] = [
  { value: "UTC", label: "UTC" },
  { value: "UTC+1", label: "UTC+1" },
  { value: "UTC+2", label: "UTC+2" },
  { value: "UTC+5:30", label: "UTC+5:30" },
  { value: "UTC+9", label: "UTC+9" },
  { value: "UTC+10", label: "UTC+10" },
];

const CURRENCIES: DropdownOption[] = [
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
  { value: "GBP", label: "GBP" },
  { value: "JPY", label: "JPY" },
  { value: "AUD", label: "AUD" },
];

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
  useLockBodyScroll(isOpen);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  const isEdit = !!editTarget;

  const field = (key: keyof InviteFormState) => ({
    value: formState[key] as string,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormState({ ...formState, [key]: e.target.value }),
  });

  const setField = (key: keyof InviteFormState) => (val: string) =>
    setFormState({ ...formState, [key]: val });

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
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-hide relative -left-0.5">
            <section>
              <h3 className="text-[18px] font-semibold text-[#1F2937] mb-2.5 relative -top-0.5">Airline Details</h3>
              <div className="grid grid-cols-2 gap-[23px]">
                <Field label="Airline Name" required>
                  <input placeholder="" {...field("airlineName")} required className={inputCls} />
                </Field>
                <Field label="Airline Code" required>
                  <input placeholder="" {...field("airlineCode")} required className={inputCls} />
                </Field>

                {/* Country — custom Dropdown */}
                <Field label="Country" required>
                  <Dropdown
                    value={formState.country || COUNTRIES[0].value}
                    onChange={setField("country")}
                    options={COUNTRIES}
                    widthClass="w-full"
                    triggerWidthClass="w-full"
                    heightClass="h-[49px]"
                    bgClass="bg-white"
                  />
                </Field>

                <Field label="Company Registration Number" required>
                  <input {...field("companyReg")} required className={inputCls} />
                </Field>
                <Field label="Website">
                  <input placeholder="https://" {...field("website")} className={inputCls} />
                </Field>
                <Field label="Contact Email" required>
                  <input type="email" {...field("contactEmail")} required className={inputCls} />
                </Field>
                <Field label="Contact Phone" required>
                  <input type="tel" {...field("phone")} required className={inputCls} />
                </Field>

                {/* Timezone — custom Dropdown */}
                <Field label="Timezone" required>
                  <Dropdown
                    value={formState.timezone || TIMEZONES[0].value}
                    onChange={setField("timezone")}
                    options={TIMEZONES}
                    widthClass="w-full"
                    triggerWidthClass="w-full"
                    heightClass="h-[49px]"
                    bgClass="bg-white"
                  />
                </Field>

                <Field label="Logo URL">
                  <input placeholder="https://..." {...field("logoUrl")} className={inputCls} />
                </Field>

                {/* Currency — custom Dropdown */}
                <Field label="Currency" required>
                  <Dropdown
                    value={formState.currency || CURRENCIES[0].value}
                    onChange={setField("currency")}
                    options={CURRENCIES}
                    widthClass="w-full"
                    triggerWidthClass="w-full"
                    heightClass="h-[49px]"
                    bgClass="bg-white"
                  />
                </Field>

                <Field label="Address" required className="col-span-2">
                  <input {...field("address")} required className={inputCls} />
                </Field>
              </div>
            </section>

            {/* Admin Details Section */}
            <section className="pt-2">
              <h3 className="text-[18px] font-semibold text-[#1F2937] mb-2.5">Admin Details</h3>
              <div className="grid grid-cols-2 gap-[23px]">
                <Field label="Admin First Name" required>
                  <input placeholder="" {...field("adminFirstName")} required className={inputCls} />
                </Field>
                <Field label="Admin Last Name" required>
                  <input placeholder="" {...field("adminLastName")} required className={inputCls} />
                </Field>
                <Field label="Admin Email" required>
                  <input type="email" placeholder="" {...field("adminEmail")} required className={inputCls} />
                </Field>
                <Field label="Job Title" required>
                  <input placeholder="" {...field("adminJobTitle")} required className={inputCls} />
                </Field>
                <Field label="Credit Limit" className="col-span-1">
                  <input type="number" placeholder="" {...field("creditLimit")} required className={inputCls} />
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
        {label} {required && <span className="text-[#1F2937]">*</span>}
      </label>
      {children}
    </div>
  );
}