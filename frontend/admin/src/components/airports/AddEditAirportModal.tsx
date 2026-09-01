"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { X } from "lucide-react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { Airport } from "@/src/types/airports";
import { cn } from "@/src/lib/utils";
import { Dropdown, DropdownOption } from "@/src/components/ui/Dropdown";
import { countries } from "countries-list";

const AIRPORT_TYPES: DropdownOption[] = [
  { value: "INTERNATIONAL", label: "INTERNATIONAL" },
  { value: "DOMESTIC", label: "DOMESTIC" },
];

const COUNTRIES: DropdownOption[] = [
  { value: "", label: "Select Country" },
  ...Object.entries(countries)
    .map(([_, c]) => ({ value: c.name, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label)),
];

interface AddEditAirportModalProps {
  isOpen: boolean;
  airport: Airport | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (updatedFields: Partial<Airport>) => void;
}

export function AddEditAirportModal({
  isOpen,
  airport,
  isSaving = false,
  onClose,
  onSave,
}: AddEditAirportModalProps) {
  useLockBodyScroll(isOpen);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [formState, setFormState] = useState({
    name: "",
    iataCode: "",
    countryCode: "",
    country: "",
    type: "INTERNATIONAL" as "INTERNATIONAL" | "DOMESTIC" | "UTC",
    timezone: "",
    isActive: true,
    latitude: "",
    longitude: "",
    postalCode: "",
    address: "",
  });

  const [touched, setTouched] = useState<Partial<Record<keyof typeof formState, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<keyof typeof formState, string>>>({});

  // Compute if any fields have changed when editing an existing airport
  const hasChanges = useMemo(() => {
    if (!airport) return true;
    return (
      formState.name.trim() !== (airport.name || "").trim() ||
      formState.iataCode.trim() !== (airport.iataCode || "").trim() ||
      formState.countryCode.trim() !== (airport.countryCode || "").trim() ||
      formState.country.trim() !== (airport.country || "").trim() ||
      formState.type !== (airport.type || "INTERNATIONAL") ||
      formState.timezone.trim() !== (airport.timezone || "").trim() ||
      formState.isActive !== (airport.isActive !== undefined ? airport.isActive : true) ||
      Number(formState.latitude) !== Number(airport.latitude || 0) ||
      Number(formState.longitude) !== Number(airport.longitude || 0) ||
      formState.postalCode.trim() !== (airport.postalCode || "").trim() ||
      formState.address.trim() !== (airport.address || "").trim()
    );
  }, [formState, airport]);

  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  useEffect(() => {
    if (airport) {
      setFormState({
        name: airport.name || "",
        iataCode: airport.iataCode || "",
        countryCode: airport.countryCode || "",
        country: airport.country || "",
        type: airport.type || "INTERNATIONAL",
        timezone: airport.timezone || "",
        isActive: airport.isActive !== undefined ? airport.isActive : true,
        latitude: airport.latitude !== undefined ? String(airport.latitude) : "",
        longitude: airport.longitude !== undefined ? String(airport.longitude) : "",
        postalCode: airport.postalCode || "",
        address: airport.address || "",
      });
    } else {
      setFormState({
        name: "",
        iataCode: "",
        countryCode: "",
        country: "",
        type: "INTERNATIONAL",
        timezone: "",
        isActive: true,
        latitude: "",
        longitude: "",
        postalCode: "",
        address: "",
      });
    }
    setTouched({});
    setErrors({});
  }, [airport, isOpen]);

  const validateField = (name: string, value: any): string => {
    const v = String(value ?? "").trim();
    switch (name) {
      case "name":
        return v ? "" : "Airport Name is required";
      case "country":
        return v ? "" : "Country is required";
      case "timezone":
        return v ? "" : "Timezone is required";
      case "iataCode":
        if (!v) return "IATA Code is required";
        if (!/^[A-Z]{3}$/.test(v)) return "IATA Code must be exactly 3 uppercase letters";
        return "";
      case "postalCode":
        return v ? "" : "Postal Code is required";
      case "address":
        return v ? "" : "Address is required";
      case "latitude": {
        const strVal = v.trim();
        if (strVal === "") return "Latitude is required";
        const latNum = parseFloat(strVal);
        if (isNaN(latNum)) return "Latitude must be a valid number";
        if (latNum < -90 || latNum > 90) return "Latitude must be between -90 and 90";
        return "";
      }
      case "longitude": {
        const strVal = v.trim();
        if (strVal === "") return "Longitude is required";
        const lngNum = parseFloat(strVal);
        if (isNaN(lngNum)) return "Longitude must be a valid number";
        if (lngNum < -180 || lngNum > 180) return "Longitude must be between -180 and 180";
        return "";
      }
      default:
        return "";
    }
  };

  const handleBlur = (key: keyof typeof formState) => () => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({
      ...prev,
      [key]: validateField(key, formState[key]) || undefined,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const allFields = Object.keys(formState) as Array<keyof typeof formState>;
    const newErrors: Partial<Record<keyof typeof formState, string>> = {};
    const newTouched: Partial<Record<keyof typeof formState, boolean>> = {};

    allFields.forEach((key) => {
      newTouched[key] = true;
      const errorMsg = validateField(key, formState[key]);
      if (errorMsg) {
        newErrors[key] = errorMsg;
      }
    });

    setTouched(newTouched);
    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) {
      const firstErrorKey = Object.keys(newErrors)[0];
      const errorEl = document.getElementsByName(firstErrorKey)[0];
      if (errorEl) {
        errorEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    // Auto-compute required schema fields not present in visual form state (ICAO Code and city)
    const upperIata = formState.iataCode.toUpperCase();
    const computedIcao = "Y" + upperIata;

    const submissionFields = {
      ...formState,
      city: airport?.city || formState.country || "Dubai",
      icaoCode: airport?.icaoCode || computedIcao,
      latitude: parseFloat(formState.latitude) || 0,
      longitude: parseFloat(formState.longitude) || 0,
    };

    onSave(submissionFields);
  };

  const handleTextChange = (key: "name" | "timezone" | "postalCode" | "address") => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const val = e.target.value;
    setFormState((prev) => ({ ...prev, [key]: val }));
    if (touched[key]) {
      setErrors((prev) => ({
        ...prev,
        [key]: validateField(key, val) || undefined,
      }));
    }
  };

  const handleCodeChange = (key: "iataCode") => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const val = e.target.value.toUpperCase();
    setFormState((prev) => ({ ...prev, [key]: val }));
    if (touched[key]) {
      setErrors((prev) => ({
        ...prev,
        [key]: validateField(key, val) || undefined,
      }));
    }
  };

  const handleCoordinateChange = (key: "latitude" | "longitude") => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const val = e.target.value;
    setFormState((prev) => ({ ...prev, [key]: val }));
    if (touched[key]) {
      setErrors((prev) => ({
        ...prev,
        [key]: validateField(key, val) || undefined,
      }));
    }
  };

  const handleCountryChange = (val: string) => {
    const entry = Object.entries(countries).find(([_, c]) => c.name === val);
    const code = entry ? entry[0] : "";
    setFormState((prev) => ({
      ...prev,
      country: val,
      countryCode: code,
    }));
    setTouched((prev) => ({ ...prev, country: true }));
    setErrors((prev) => ({
      ...prev,
      country: validateField("country", val) || undefined,
    }));
  };

  const handleTypeChange = (val: any) => {
    setFormState((prev) => ({
      ...prev,
      type: val,
    }));
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={() => !isSaving && onClose()}
      />

      {/* Slide-in panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-[640px] bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between pl-6 pr-4.5 py-5">
          <div>
            <h2 className="text-[24px] font-semibold text-[#1F2937] font-figtree">
              {airport ? "Edit Airport" : "Add New Airport"}
            </h2>
            <p className="text-sm text-[#6B7280] font-figtree -mt-0.5">
              {airport ? "Update airport details and settings." : "Add a new airport to support flight disruptions"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="p-1.5 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-6 h-6 text-[#1F2937]" />
          </button>
        </div>

        <div className="w-full" style={{ padding: "0px 24px" }}>
          <div className="h-px bg-[#E5E7EB] w-full" />
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden" noValidate>
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-7 space-y-6 scrollbar-hide">

            <div className="grid grid-cols-2 gap-[23px] -translate-y-1">
              {/* Row 1 */}
              <Field label="Airport Name *" error={errors.name}>
                <input
                  name="name"
                  placeholder=""
                  value={formState.name}
                  onChange={handleTextChange("name")}
                  onBlur={handleBlur("name")}
                  required
                  disabled={isSaving}
                  className={cn(inputCls, errors.name && "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500")}
                />
              </Field>

              <Field label="Country *" error={errors.country}>
                <Dropdown
                  value={formState.country}
                  onChange={handleCountryChange}
                  options={COUNTRIES}
                  widthClass="w-full"
                  triggerWidthClass="w-full"
                  heightClass="h-[49px]"
                  bgClass="bg-white"
                  error={!!errors.country}
                  disabled={isSaving}
                  maxListHeightClass="max-h-[296px]"
                  searchable
                />
              </Field>

              {/* Row 2 */}
              <Field label="IATA *" error={errors.iataCode}>
                <input
                  name="iataCode"
                  placeholder=""
                  maxLength={3}
                  value={formState.iataCode}
                  onChange={handleCodeChange("iataCode")}
                  onBlur={handleBlur("iataCode")}
                  required
                  disabled={isSaving}
                  className={cn(inputCls, errors.iataCode && "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500")}
                />
              </Field>

              <Field label="Type *">
                <Dropdown
                  value={formState.type}
                  onChange={handleTypeChange}
                  options={AIRPORT_TYPES}
                  widthClass="w-full"
                  triggerWidthClass="w-full"
                  heightClass="h-[49px]"
                  bgClass="bg-white"
                  disabled={isSaving}
                />
              </Field>

              {/* Row 3 */}
              <Field label="Latitude *" error={errors.latitude}>
                <input
                  name="latitude"
                  type="number"
                  step="any"
                  placeholder=""
                  value={formState.latitude}
                  onChange={handleCoordinateChange("latitude")}
                  onBlur={handleBlur("latitude")}
                  required
                  disabled={isSaving}
                  className={cn(inputCls, errors.latitude && "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500")}
                />
              </Field>
              <Field label="Longitude *" error={errors.longitude}>
                <input
                  name="longitude"
                  type="number"
                  step="any"
                  placeholder=""
                  value={formState.longitude}
                  onChange={handleCoordinateChange("longitude")}
                  onBlur={handleBlur("longitude")}
                  required
                  disabled={isSaving}
                  className={cn(inputCls, errors.longitude && "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500")}
                />
              </Field>

              {/* Row 4 */}
              <Field label="Address *" className="col-span-2" error={errors.address}>
                <input
                  name="address"
                  placeholder=""
                  value={formState.address}
                  onChange={handleTextChange("address")}
                  onBlur={handleBlur("address")}
                  required
                  disabled={isSaving}
                  className={cn(inputCls, errors.address && "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500")}
                />
              </Field>

              {/* Row 5 */}
              <Field label="Postal Code *" error={errors.postalCode}>
                <input
                  name="postalCode"
                  placeholder=""
                  value={formState.postalCode}
                  onChange={handleTextChange("postalCode")}
                  onBlur={handleBlur("postalCode")}
                  required
                  disabled={isSaving}
                  className={cn(inputCls, errors.postalCode && "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500")}
                />
              </Field>

              <Field label="Timezone *" error={errors.timezone}>
                <input
                  name="timezone"
                  placeholder=""
                  value={formState.timezone}
                  onChange={handleTextChange("timezone")}
                  onBlur={handleBlur("timezone")}
                  required
                  disabled={isSaving}
                  className={cn(inputCls, errors.timezone && "border-rose-500 focus:ring-rose-500/20 focus:border-rose-500")}
                />
              </Field>

              {/* Row 6 - Update Status Gray Box */}
              <div className="col-span-2 mt-1 w-full bg-[#F3F4F6] border border-gray-200 rounded-[12px] p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setFormState((prev) => ({ ...prev, isActive: !prev.isActive }))}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none translate-y-0.5 translate-x-0.5",
                      formState.isActive ? "bg-[#0F2757]" : "bg-gray-300",
                      isSaving && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                        formState.isActive ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                  <div className="flex flex-col">
                    <span className="text-[16px] font-medium text-[#1F2937] font-figtree ">
                      Update Status
                    </span>
                    <span className="text-[14px] text-[#6B7280] font-figtree">
                      This will affect the status of the particular airport.
                    </span>
                  </div>
                </div>
                <span
                  className={cn(
                    "h-[20px] inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium font-figtree leading-[100%]",
                    formState.isActive
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-gray-200 text-gray-800"
                  )}
                >
                  {formState.isActive ? "Active" : "Inactive"}
                </span>
              </div>
            </div>

          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="flex-1 py-3 px-6 rounded-lg border border-[#D1D5DB] text-[#09090B] text-[18px] hover:bg-[#F9FAFB] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !hasChanges}
              className="flex-1 py-3 px-6 rounded-lg bg-[#0F2757] hover:bg-[#162259] text-white text-[18px] transition-colors cursor-pointer font-medium flex items-center justify-center disabled:opacity-60"
            >
              {isSaving ? (
                <div className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>{airport ? "Saving..." : "Adding..."}</span>
                </div>
              ) : airport ? (
                "Save Changes"
              ) : (
                "Add Airport"
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

const inputCls =
  "w-full h-[49px] px-4 py-3 rounded-lg border border-[#D1D5DB] text-[16px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B] transition-all placeholder:text-[#9CA3AF]";

function Field({
  label,
  children,
  className,
  error,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  error?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[16px] font-medium text-[#1F2937] mb-1.5 font-figtree">
        {label}
      </label>
      {children}
      {error && (
        <span className="text-rose-500 text-xs font-medium font-figtree pl-1 mt-1 block">
          {error}
        </span>
      )}
    </div>
  );
}
