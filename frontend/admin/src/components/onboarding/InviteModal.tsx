"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { InviteFormState, Invitation } from "@/src/types/onboarding";
import { cn } from "@/src/lib/utils";
import { Dropdown, DropdownOption } from "@/src/components/ui/Dropdown";
import { countries } from "countries-list";

const COUNTRIES: DropdownOption[] = [
  { value: "", label: "Select Country" },
  ...Object.entries(countries)
    .map(([code, c]) => ({ value: code, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label)),
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

// Validation
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;
const URL_RE = /^(https?:\/\/)?([\w.-]+)\.([a-z]{2,6})(\/[\w.\-/?%&=]*)?$/i;

function validate(key: keyof InviteFormState, value: string): string {
  const v = value?.trim() ?? "";
  switch (key) {
    // required only
    case "airlineName": return v ? "" : "Airline Name is required";
    case "companyReg": return v ? "" : "Company Registration Number is required";
    case "adminFirstName": return v ? "" : "First Name is required";
    case "adminLastName": return v ? "" : "Last Name is required";
    case "adminJobTitle": return v ? "" : "Job Title is required";
    case "address": return v ? "" : "Address is required";
    case "country": return v ? "" : "Country is required";
    // alphanumeric + required
    case "airlineCode":
      if (!v) return "Airline Code is required";
      if (!/^[A-Z0-9]+$/i.test(v)) return "Airline Code must contain only letters and numbers";
      return "";
    // email
    case "contactEmail":
      if (!v) return "Contact Email is required";
      if (!EMAIL_RE.test(v)) return "Please enter a valid email address";
      return "";
    case "adminEmail":
      if (!v) return "Admin Email is required";
      if (!EMAIL_RE.test(v)) return "Please enter a valid email address";
      return "";
    // phone
    case "phone":
      if (!v) return "Contact Phone is required";
      if (!PHONE_RE.test(v)) return "Please enter a valid phone (e.g. +971501234567)";
      return "";
    // website
    case "website":
      if (v && !URL_RE.test(v)) return "Please enter a valid website URL";
      return "";
    case "creditLimit":
      if (!v) return "";
      if (isNaN(Number(v)) || Number(v) < 0) return "Credit Limit must be a valid number";
      return "";
    default:
      return "";
  }
}

// Types
interface InviteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formState: InviteFormState;
  setFormState: (s: InviteFormState) => void;
  editTarget?: Invitation | null;
  isLoading?: boolean;
}

type Errors = Partial<Record<keyof InviteFormState, string>>;

export function InviteModal({
  isOpen,
  onClose,
  onSubmit,
  formState,
  setFormState,
  editTarget,
  isLoading = false,
}: InviteModalProps) {
  useLockBodyScroll(isOpen);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof InviteFormState, boolean>>>({});

  // Reset errors/touched when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrors({});
      setTouched({});
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  const isEdit = !!editTarget;

  const setErr = (key: keyof InviteFormState, msg: string) =>
    setErrors((prev) => ({ ...prev, [key]: msg || undefined }));

  const handleChange = (key: keyof InviteFormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setFormState({ ...formState, [key]: val });
      if (touched[key]) setErr(key, validate(key, val));
    };

  const handleBlur = (key: keyof InviteFormState) => () => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    setErr(key, validate(key, formState[key] ?? ""));
  };

  const setField = (key: keyof InviteFormState) => (val: string) => {
    setFormState({ ...formState, [key]: val });
    if (touched[key]) setErr(key, validate(key, val));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const allKeys = Object.keys(formState) as Array<keyof InviteFormState>;
    const newErrors: Errors = {};
    allKeys.forEach((k) => {
      const msg = validate(k, formState[k] ?? "");
      if (msg) newErrors[k] = msg;
    });
    setErrors(newErrors);
    setTouched(Object.fromEntries(allKeys.map((k) => [k, true])));
    if (Object.keys(newErrors).length > 0) {
      const first = scrollContainerRef.current?.querySelector(".field-error");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    onSubmit(e);
  };

  // Shorthand helpers
  const ic = (key: keyof InviteFormState) =>
    cn(inputCls, errors[key] && "border-red-500 focus:ring-red-500/20 focus:border-red-500");

  const err = (key: keyof InviteFormState) =>
    errors[key] ? <p className="field-error mt-1 text-xs text-red-500">{errors[key]}</p> : null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={isLoading ? () => { } : onClose}
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
            disabled={isLoading}
            className="p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X className="w-5 h-5 text-[#1F2937]" />
          </button>
        </div>

        <div className="w-full" style={{ padding: "0px 24px" }}>
          <div className="h-px bg-[#D1D5DB] w-full" />
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-hide relative -left-0.5">
            <section>
              <h3 className="text-[18px] font-semibold text-[#1F2937] mb-2.5 relative -top-0.5">Airline Details</h3>
              <div className="grid grid-cols-2 gap-[23px]">
                <Field label="Airline Name" required>
                  <input placeholder="" value={formState.airlineName} onChange={handleChange("airlineName")} onBlur={handleBlur("airlineName")} className={ic("airlineName")} disabled={isLoading} />
                  {err("airlineName")}
                </Field>
                <Field label="Airline Code" required>
                  <input placeholder="" value={formState.airlineCode} onChange={handleChange("airlineCode")} onBlur={handleBlur("airlineCode")} className={ic("airlineCode")} disabled={isLoading} />
                  {err("airlineCode")}
                </Field>

                {/* Country — custom Dropdown */}
                <Field label="Country" required>
                  <Dropdown
                    value={formState.country}
                    onChange={setField("country")}
                    options={COUNTRIES}
                    widthClass="w-full"
                    triggerWidthClass="w-full"
                    heightClass="h-[49px]"
                    bgClass="bg-white"
                    disabled={isLoading}
                    maxListHeightClass="max-h-[296px]"
                    error={!!(errors["country"] && touched["country"])}
                  />
                  {err("country")}
                </Field>

                <Field label="Company Registration Number" required>
                  <input value={formState.companyReg} onChange={handleChange("companyReg")} onBlur={handleBlur("companyReg")} className={ic("companyReg")} disabled={isLoading} />
                  {err("companyReg")}
                </Field>
                <Field label="Website">
                  <input placeholder="https://" value={formState.website} onChange={handleChange("website")} onBlur={handleBlur("website")} className={ic("website")} disabled={isLoading} />
                  {err("website")}
                </Field>
                <Field label="Contact Email" required>
                  <input type="email" value={formState.contactEmail} onChange={handleChange("contactEmail")} onBlur={handleBlur("contactEmail")} className={ic("contactEmail")} disabled={isLoading} />
                  {err("contactEmail")}
                </Field>
                <Field label="Contact Phone" required>
                  <input type="tel" value={formState.phone} onChange={handleChange("phone")} onBlur={handleBlur("phone")} className={ic("phone")} disabled={isLoading} />
                  {err("phone")}
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
                    disabled={isLoading}
                    error={!!(errors["timezone"] && touched["timezone"])}
                  />
                </Field>

                <Field label="Logo URL">
                  <input placeholder="https://..." value={formState.logoUrl} onChange={handleChange("logoUrl")} onBlur={handleBlur("logoUrl")} className={ic("logoUrl")} disabled={isLoading} />
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
                    disabled={isLoading}
                    error={!!(errors["currency"] && touched["currency"])}
                  />
                </Field>

                <Field label="Address" required className="col-span-2">
                  <input value={formState.address} onChange={handleChange("address")} onBlur={handleBlur("address")} className={ic("address")} disabled={isLoading} />
                  {err("address")}
                </Field>
              </div>
            </section>

            {/* Admin Details Section */}
            <section className="pt-2">
              <h3 className="text-[18px] font-semibold text-[#1F2937] mb-2.5">Admin Details</h3>
              <div className="grid grid-cols-2 gap-[23px]">
                <Field label="Admin First Name" required>
                  <input placeholder="" value={formState.adminFirstName} onChange={handleChange("adminFirstName")} onBlur={handleBlur("adminFirstName")} className={ic("adminFirstName")} disabled={isLoading} />
                  {err("adminFirstName")}
                </Field>
                <Field label="Admin Last Name" required>
                  <input placeholder="" value={formState.adminLastName} onChange={handleChange("adminLastName")} onBlur={handleBlur("adminLastName")} className={ic("adminLastName")} disabled={isLoading} />
                  {err("adminLastName")}
                </Field>
                <Field label="Admin Email" required>
                  <input type="email" placeholder="" value={formState.adminEmail} onChange={handleChange("adminEmail")} onBlur={handleBlur("adminEmail")} className={ic("adminEmail")} disabled={isLoading} />
                  {err("adminEmail")}
                </Field>
                <Field label="Job Title" required>
                  <input placeholder="" value={formState.adminJobTitle} onChange={handleChange("adminJobTitle")} onBlur={handleBlur("adminJobTitle")} className={ic("adminJobTitle")} disabled={isLoading} />
                  {err("adminJobTitle")}
                </Field>
                <Field label="Credit Limit" className="col-span-1">
                  <input type="number" placeholder="" value={formState.creditLimit} onChange={handleChange("creditLimit")} onBlur={handleBlur("creditLimit")} className={ic("creditLimit")} disabled={isLoading} />
                  {err("creditLimit")}
                </Field>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#E5E7EB] flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1 py-3 px-6 rounded-lg border border-[#D1D5DB] text-[#09090B] text-[18px] hover:bg-[#F9FAFB] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 py-3 px-6 rounded-lg bg-[#0F2757] hover:bg-[#162259] text-white text-[18px] transition-colors cursor-pointer flex items-center justify-center disabled:opacity-75 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{isEdit ? "Saving..." : "Sending..."}</span>
                </div>
              ) : isEdit ? (
                "Save Changes"
              ) : (
                "Save Invite"
              )}
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