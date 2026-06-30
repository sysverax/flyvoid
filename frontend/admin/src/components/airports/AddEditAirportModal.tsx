"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { X } from "lucide-react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { Airport } from "@/src/types/airports";
import { cn } from "@/src/lib/utils";
import { Dropdown, DropdownOption } from "@/src/components/ui/Dropdown";

const AIRPORT_TYPES: DropdownOption[] = [
  { value: "INTERNATIONAL", label: "INTERNATIONAL" },
  { value: "DOMESTIC", label: "DOMESTIC" },
  { value: "UTC", label: "UTC" },
];

const COUNTRIES: DropdownOption[] = [
  { value: "United States", label: "United States" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "Germany", label: "Germany" },
  { value: "France", label: "France" },
  { value: "India", label: "India" },
  { value: "Canada", label: "Canada" },
  { value: "Australia", label: "Australia" },
];

const IATAS: DropdownOption[] = [
  { value: "PA", label: "PA" },
  { value: "LHR", label: "LHR" },
  { value: "HND", label: "HND" },
  { value: "LAX", label: "LAX" },
  { value: "JFK", label: "JFK" },
  { value: "SIN", label: "SIN" },
];

const COUNTRY_TO_CODE: Record<string, string> = {
  "United States": "US",
  "United Kingdom": "GB",
  Germany: "DE",
  France: "FR",
  India: "IN",
  Canada: "CA",
  Australia: "AU",
  "United Arab Emirates": "AE",
  Japan: "JP",
  Singapore: "SG",
};

const COUNTRY_TO_CITY: Record<string, string> = {
  "United States": "New York",
  "United Kingdom": "London",
  Germany: "Berlin",
  France: "Paris",
  India: "Mumbai",
  Canada: "Toronto",
  Australia: "Sydney",
  "United Arab Emirates": "Dubai",
  Japan: "Tokyo",
  Singapore: "Singapore",
};

const IATA_TO_ICAO: Record<string, string> = {
  PA: "OMDB",
  LHR: "EGLL",
  HND: "RJTT",
  LAX: "KLAX",
  JFK: "KJFK",
  SIN: "WSSS",
};

interface AddEditAirportModalProps {
  isOpen: boolean;
  airport: Airport | null;
  onClose: () => void;
  onSave: (updatedFields: Partial<Airport>) => void;
}

export function AddEditAirportModal({
  isOpen,
  airport,
  onClose,
  onSave,
}: AddEditAirportModalProps) {
  useLockBodyScroll(isOpen);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [formState, setFormState] = useState({
    name: "",
    iataCode: "PA",
    icaoCode: "OMDB",
    city: "Dubai",
    countryCode: "AE",
    country: "United Arab Emirates",
    timezone: "",
    type: "UTC" as "INTERNATIONAL" | "DOMESTIC" | "UTC",
    isActive: true,
    latitude: 0,
    longitude: 0,
    postalCode: "",
    address: "",
  });

  const modalCountryOptions = useMemo(() => {
    if (formState.country && !COUNTRIES.find((c) => c.value === formState.country)) {
      return [...COUNTRIES, { value: formState.country, label: formState.country }];
    }
    return COUNTRIES;
  }, [formState.country]);

  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  useEffect(() => {
    if (airport) {
      setFormState({
        name: airport.name || "",
        iataCode: airport.iataCode || "PA",
        icaoCode: airport.icaoCode || "OMDB",
        city: airport.city || "Dubai",
        countryCode: airport.countryCode || "AE",
        country: airport.country || "United Arab Emirates",
        timezone: airport.timezone || "",
        type: airport.type || "UTC",
        isActive: airport.isActive !== undefined ? airport.isActive : true,
        latitude: airport.latitude || 0,
        longitude: airport.longitude || 0,
        postalCode: airport.postalCode || "",
        address: airport.address || "",
      });
    } else {
      setFormState({
        name: "",
        iataCode: "PA",
        icaoCode: "OMDB",
        city: "Dubai",
        countryCode: "AE",
        country: "United Arab Emirates",
        timezone: "",
        type: "UTC",
        isActive: true,
        latitude: 0,
        longitude: 0,
        postalCode: "",
        address: "",
      });
    }
  }, [airport, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formState);
  };

  const field = (key: "name" | "postalCode" | "address" | "timezone") => ({
    value: formState[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setFormState({ ...formState, [key]: e.target.value }),
  });

  const handleCountryChange = (val: string) => {
    setFormState((prev) => ({
      ...prev,
      country: val,
      countryCode: COUNTRY_TO_CODE[val] || "US",
      city: COUNTRY_TO_CITY[val] || val,
    }));
  };

  const handleIataChange = (val: string) => {
    setFormState((prev) => ({
      ...prev,
      iataCode: val,
      icaoCode: IATA_TO_ICAO[val] || "OMDB",
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
            className="p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-6 h-6 text-[#1F2937]" />
          </button>
        </div>

        <div className="w-full" style={{ padding: "0px 24px" }}>
          <div className="h-px bg-[#E5E7EB] w-full" />
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-7 space-y-6 scrollbar-hide">

            <div className="grid grid-cols-2 gap-[23px] -translate-y-1">
              {/* Row 1 */}
              <Field label="Airport Name *">
                <input placeholder="" {...field("name")} required className={inputCls} />
              </Field>

              <Field label="Country *">
                <Dropdown
                  value={formState.country}
                  onChange={handleCountryChange}
                  options={modalCountryOptions}
                  widthClass="w-full"
                  triggerWidthClass="w-full"
                  heightClass="h-[49px]"
                  bgClass="bg-white"
                />
              </Field>

              {/* Row 2 */}
              <Field label="IATA *">
                <Dropdown
                  value={formState.iataCode}
                  onChange={handleIataChange}
                  options={IATAS}
                  widthClass="w-full"
                  triggerWidthClass="w-full"
                  heightClass="h-[49px]"
                  bgClass="bg-white"
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
                />
              </Field>

              {/* Row 3 */}
              <Field label="Latitude *">
                <input
                  type="number"
                  step="any"
                  value={formState.latitude || ""}
                  onChange={(e) => setFormState({ ...formState, latitude: parseFloat(e.target.value) || 0 })}
                  required
                  className={inputCls}
                />
              </Field>
              <Field label="Longitude *">
                <input
                  type="number"
                  step="any"
                  value={formState.longitude || ""}
                  onChange={(e) => setFormState({ ...formState, longitude: parseFloat(e.target.value) || 0 })}
                  required
                  className={inputCls}
                />
              </Field>

              {/* Row 4 */}
              <Field label="Address *" className="col-span-2">
                <input placeholder="" {...field("address")} required className={inputCls} />
              </Field>

              {/* Row 5 */}
              <Field label="Postal Code *">
                <input placeholder="" {...field("postalCode")} required className={inputCls} />
              </Field>

              <Field label="Timezone *">
                <input placeholder="" {...field("timezone")} required className={inputCls} />
              </Field>

              {/* Row 6 - Update Status Gray Box */}
              <div className="col-span-2 mt-1 w-full bg-[#F3F4F6] border border-gray-200 rounded-[12px] p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={() => setFormState(prev => ({ ...prev, isActive: !prev.isActive }))}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none translate-y-0.5 translate-x-0.5",
                      formState.isActive ? "bg-[#0F2757]" : "bg-gray-300"
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
              className="flex-1 py-3 px-6 rounded-lg border border-[#D1D5DB] text-[#09090B] text-[18px] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-3 px-6 rounded-lg bg-[#0F2757] hover:bg-[#162259] text-white text-[18px] transition-colors cursor-pointer font-medium"
            >
              {airport ? "Save Changes" : "Add Airport"}
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
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[16px] font-medium text-[#1F2937] mb-1.5 font-figtree">
        {label}
      </label>
      {children}
    </div>
  );
}
