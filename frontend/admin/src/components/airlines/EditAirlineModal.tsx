"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { X, Search, Loader2 } from "lucide-react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { Airline } from "@/src/types/airlines";
import { cn } from "@/src/lib/utils";
import { toast } from "react-toastify";
import { airlinesService } from "@/src/services/airlines.service";
import { Dropdown, DropdownOption } from "@/src/components/ui/Dropdown";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  SortHeader,
} from "@/src/components/ui/table";

import { countries } from "countries-list";

const COUNTRIES: DropdownOption[] = [
  { value: "", label: "Select Country" },
  ...Object.entries(countries)
    .map(([_, c]) => ({ value: c.name, label: c.name }))
    .sort((a, b) => a.label.localeCompare(b.label)),
];

const TIMEZONES: DropdownOption[] = [
  { value: "UTC", label: "UTC" },
  { value: "EST", label: "EST" },
  { value: "CST", label: "CST" },
  { value: "PST", label: "PST" },
  { value: "GMT", label: "GMT" },
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
  { value: "CAD", label: "CAD" },
];

interface AirportItem {
  id: string;
  name: string;
  iata: string;
  country: string;
  status: "Active" | "Inactive";
}

const AIRPORT_COUNTRIES: DropdownOption[] = [
  { value: "All Countries", label: "All Countries" },
  { value: "USA", label: "USA" },
  { value: "UK", label: "UK" },
  { value: "Japan", label: "Japan" },
  { value: "UAE", label: "UAE" },
  { value: "Singapore", label: "Singapore" },
  { value: "France", label: "France" },
];

// Validation
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;
const URL_RE = /^(https?:\/\/)?([\w.-]+)\.([a-z]{2,6})(\/[\w.\-/?%&=]*)?$/i;

function validate(key: string, value: any): string {
  const v = String(value ?? "").trim();
  switch (key) {
    case "airlineName": return v ? "" : "Airline Name is required";
    case "companyReg": return v ? "" : "Company Registration Number is required";
    case "adminFirstName": return v ? "" : "First Name is required";
    case "adminLastName":
      if (!v) return "Last Name is required";
      if (v.length < 2) return "Last Name must be longer than or equal to 2 characters";
      return "";
    case "adminJobTitle": return v ? "" : "Job Title is required";
    case "address": return v ? "" : "Address is required";
    case "country": return v ? "" : "Country is required";
    case "airlineCode":
      if (!v) return "Airline Code is required";
      if (!/^[A-Z0-9]+$/i.test(v)) return "Airline Code must contain only letters and numbers";
      return "";
    case "contactEmail":
      if (!v) return "Contact Email is required";
      if (!EMAIL_RE.test(v)) return "Please enter a valid email address";
      return "";
    case "adminEmail":
      if (!v) return "Admin Email is required";
      if (!EMAIL_RE.test(v)) return "Please enter a valid email address";
      return "";
    case "contactPhone":
      if (!v) return "Contact Phone is required";
      if (!PHONE_RE.test(v)) return "Please enter a valid phone (e.g. +971501234567)";
      return "";
    case "website":
      if (v && !URL_RE.test(v)) return "Please enter a valid website URL";
      return "";
    case "logoUrl":
      if (v && !URL_RE.test(v)) return "Please enter a valid logo URL";
      return "";
    case "creditLimit":
      if (v === "" || v === undefined) return "";
      if (isNaN(Number(v)) || Number(v) < 0) return "Credit Limit must be a valid number";
      return "";
    default:
      return "";
  }
}

interface EditAirlineModalProps {
  isOpen: boolean;
  airline: Airline | null;
  onClose: () => void;
  onSave: (updatedFields: Partial<Airline>, assignAirportIds: number[], disableAirportIds: number[]) => void;
  isSaving?: boolean;
}

type Errors = Partial<Record<string, string>>;

export function EditAirlineModal({
  isOpen,
  airline,
  onClose,
  onSave,
  isSaving = false,
}: EditAirlineModalProps) {
  useLockBodyScroll(isOpen);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [editFormState, setEditFormState] = useState({
    airlineName: "",
    airlineCode: "",
    country: "United States",
    companyReg: "",
    website: "",
    contactEmail: "",
    contactPhone: "",
    timezone: "UTC",
    currency: "USD",
    address: "",
    logoUrl: "",
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    adminJobTitle: "",
    creditLimit: 0,
  });

  const [airports, setAirports] = useState<AirportItem[]>([]);
  const [initialSelectedIds, setInitialSelectedIds] = useState<string[]>([]);
  const [selectedAirportIds, setSelectedAirportIds] = useState<string[]>([]);
  const [airportSearch, setAirportSearch] = useState("");
  const [airportCountry, setAirportCountry] = useState("All Countries");
  const [sortField, setSortField] = useState<keyof AirportItem | "isSelected" | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [isLoadingAirports, setIsLoadingAirports] = useState(false);

  const [errors, setErrors] = useState<Errors>({});
  const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({});

  // Reset errors/touched when modal opens
  useEffect(() => {
    if (isOpen) {
      setErrors({});
      setTouched({});
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  useEffect(() => {
    if (airline) {
      setEditFormState({
        airlineName: airline.airlineName || "",
        airlineCode: airline.airlineCode || "",
        country: airline.country || "United States",
        companyReg: airline.companyReg || "",
        website: airline.website || "",
        contactEmail: airline.contactEmail || "",
        contactPhone: airline.contactPhone || "",
        timezone: airline.timezone || "UTC",
        currency: airline.currency || "USD",
        address: airline.address || "",
        logoUrl: airline.logoUrl || "",
        adminFirstName: airline.adminFirstName || "",
        adminLastName: airline.adminLastName || "",
        adminEmail: airline.adminEmail || "",
        adminJobTitle: airline.adminJobTitle || "",
        creditLimit: airline.creditLimit || 0,
      });

      setAirportSearch("");
      setAirportCountry("All Countries");

      if (isOpen) {
        const fetchAirports = async () => {
          setIsLoadingAirports(true);
          try {
            let allAirportsData: AirportItem[] = [];
            let currentPage = 1;
            let totalPages = 1;

            do {
              const data = await airlinesService.getAirlineAirports(Number(airline.id), { limit: 200, page: currentPage });
              totalPages = data.totalPages;
              
              const fetchedAirports: AirportItem[] = data.airports.map((ap) => ({
                id: String(ap.id),
                name: ap.name,
                iata: ap.iataCode,
                country: countries[ap.countryCode as keyof typeof countries]?.name || ap.countryCode || "Unknown",
                status: ap.isActive ? "Active" : "Inactive",
                isAssigned: ap.isAssigned
              }));

              allAirportsData = [...allAirportsData, ...fetchedAirports];
              currentPage++;
            } while (currentPage <= totalPages);
            
            setAirports(allAirportsData);
            
            const assignedIds = allAirportsData.filter((ap: any) => ap.isAssigned).map(ap => String(ap.id));
            setSelectedAirportIds(assignedIds);
            setInitialSelectedIds(assignedIds);
          } catch (error) {
            toast.error("Failed to load airports");
          } finally {
            setIsLoadingAirports(false);
          }
        };
        fetchAirports();
      }
    }
  }, [airline, isOpen]);

  // Compute if any form field or airport selection has changed
  const hasChanges = useMemo(() => {
    if (!airline) return false;
    const keys = Object.keys(editFormState) as Array<keyof typeof editFormState>;
    const anyFieldChanged = keys.some((k) => {
      if (k === "creditLimit") {
        return Number(editFormState[k]) !== Number(airline[k]);
      }
      return String(editFormState[k] ?? "").trim() !== String(airline[k] ?? "").trim();
    });

    const airportsChanged =
      selectedAirportIds.length !== initialSelectedIds.length ||
      selectedAirportIds.some((id) => !initialSelectedIds.includes(id));

    return anyFieldChanged || airportsChanged;
  }, [editFormState, selectedAirportIds, airline]);

  const setErr = (key: keyof typeof editFormState, msg: string) =>
    setErrors((prev) => ({ ...prev, [key]: msg || undefined }));

  const handleChange = (key: keyof typeof editFormState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setEditFormState({ ...editFormState, [key]: val });
      if (touched[key]) setErr(key, validate(key, val));
    };

  const handleBlur = (key: keyof typeof editFormState) => () => {
    setTouched((prev) => ({ ...prev, [key]: true }));
    setErr(key, validate(key, editFormState[key] ?? ""));
  };

  const setField = (key: keyof typeof editFormState) => (val: string) => {
    setEditFormState({ ...editFormState, [key]: val });
    if (touched[key]) setErr(key, validate(key, val));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const allKeys = Object.keys(editFormState) as Array<keyof typeof editFormState>;
    const newErrors: Errors = {};
    allKeys.forEach((k) => {
      const msg = validate(k, editFormState[k] ?? "");
      if (msg) newErrors[k] = msg;
    });

    setErrors(newErrors);
    setTouched(Object.fromEntries(allKeys.map((k) => [k, true])));

    if (Object.keys(newErrors).length > 0) {
      const first = scrollContainerRef.current?.querySelector(".field-error");
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const assignIds: number[] = [];
    const disableIds: number[] = [];
    
    airports.forEach((ap) => {
      const wasSelected = initialSelectedIds.includes(ap.id);
      const isSelected = selectedAirportIds.includes(ap.id);
      
      if (isSelected && !wasSelected) {
        assignIds.push(Number(ap.id));
      } else if (!isSelected && wasSelected) {
        disableIds.push(Number(ap.id));
      }
    });

    const selectedAirports = airports.filter((ap) => selectedAirportIds.includes(ap.id));
    const assignedAirportsStr = selectedAirports.map((ap) => ap.name).join(", ");

    onSave({
      ...editFormState,
      assignedAirports: assignedAirportsStr,
    }, assignIds, disableIds);
  };

  const handleToggleAirport = (id: string) => {
    setSelectedAirportIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Filter airports list
  const filteredAirports = airports.filter((ap) => {
    const matchesSearch =
      ap.name.toLowerCase().includes(airportSearch.toLowerCase()) ||
      ap.iata.toLowerCase().includes(airportSearch.toLowerCase());
    const matchesCountry = airportCountry === "All Countries" || ap.country === airportCountry;
    return matchesSearch && matchesCountry;
  });

  const handleSort = (field: any) => {
    if (sortField === field) {
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedAirports = [...filteredAirports].sort((a, b) => {
    if (!sortField) return 0;

    let aValue: any;
    let bValue: any;

    if (sortField === "isSelected") {
      aValue = selectedAirportIds.includes(a.id) ? 1 : 0;
      bValue = selectedAirportIds.includes(b.id) ? 1 : 0;
    } else {
      aValue = a[sortField];
      bValue = b[sortField];
    }

    if (typeof aValue === "string") {
      return sortOrder === "asc"
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    } else {
      return sortOrder === "asc"
        ? (aValue > bValue ? 1 : -1)
        : (aValue < bValue ? 1 : -1);
    }
  });

  const ic = (key: keyof typeof editFormState) =>
    cn(inputCls, errors[key] && "border-red-500 focus:ring-red-500/20 focus:border-red-500");

  const err = (key: keyof typeof editFormState) =>
    errors[key] ? <p className="field-error mt-1 text-xs text-red-500">{errors[key]}</p> : null;

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
            <h2 className="text-[24px] font-semibold text-[#1F2937]">
              Edit Airline Details
            </h2>
            <p className="text-sm text-[#6B7280]">
              Update airline & admin information.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-6 h-6 text-[#1F2937]" />
          </button>
        </div>

        <div className="w-full" style={{ padding: "0px 24px" }}>
          <div className="h-px bg-[#D1D5DB] w-full" />
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-7 space-y-6 scrollbar-hide relative -left-0.5">

            {/* Airline Details Section */}
            <section>
              <h3 className="text-[18px] font-semibold text-[#1F2937] mb-2.5 relative -top-1">Airline Details</h3>
              <div className="grid grid-cols-2 gap-[23px]">
                <Field label="Airline Name" required >
                  <input placeholder="" value={editFormState.airlineName} onChange={handleChange("airlineName")} onBlur={handleBlur("airlineName")} className={ic("airlineName")} />
                  {err("airlineName")}
                </Field>
                <Field label="Airline Code" required>
                  <input placeholder="" value={editFormState.airlineCode} onChange={handleChange("airlineCode")} onBlur={handleBlur("airlineCode")} className={ic("airlineCode")} />
                  {err("airlineCode")}
                </Field>

                {/* Country — custom Dropdown */}
                <Field label="Country" required>
                  <Dropdown
                    value={editFormState.country || COUNTRIES[0].value}
                    onChange={setField("country")}
                    options={COUNTRIES}
                    widthClass="w-full"
                    triggerWidthClass="w-full"
                    heightClass="h-[49px]"
                    bgClass="bg-white"
                    error={!!(errors["country"] && touched["country"])}
                    maxListHeightClass="max-h-[296px]"
                    searchable
                  />
                  {err("country")}
                </Field>

                <Field label="Company Registration Number" required>
                  <input value={editFormState.companyReg} onChange={handleChange("companyReg")} onBlur={handleBlur("companyReg")} className={ic("companyReg")} />
                  {err("companyReg")}
                </Field>
                <Field label="Website">
                  <input placeholder="https://" value={editFormState.website} onChange={handleChange("website")} onBlur={handleBlur("website")} className={ic("website")} />
                  {err("website")}
                </Field>
                <Field label="Contact Email" required>
                  <input type="email" value={editFormState.contactEmail} onChange={handleChange("contactEmail")} onBlur={handleBlur("contactEmail")} className={ic("contactEmail")} />
                  {err("contactEmail")}
                </Field>
                <Field label="Contact Phone" required>
                  <input type="tel" value={editFormState.contactPhone} onChange={handleChange("contactPhone")} onBlur={handleBlur("contactPhone")} className={ic("contactPhone")} />
                  {err("contactPhone")}
                </Field>

                {/* Timezone — custom Dropdown */}
                <Field label="Timezone" required>
                  <Dropdown
                    value={editFormState.timezone || TIMEZONES[0].value}
                    onChange={setField("timezone")}
                    options={TIMEZONES}
                    widthClass="w-full"
                    triggerWidthClass="w-full"
                    heightClass="h-[49px]"
                    bgClass="bg-white"
                    error={!!(errors["timezone"] && touched["timezone"])}
                  />
                  {err("timezone")}
                </Field>

                <Field label="Logo URL">
                  <input placeholder="https://..." value={editFormState.logoUrl} onChange={handleChange("logoUrl")} onBlur={handleBlur("logoUrl")} className={ic("logoUrl")} />
                  {err("logoUrl")}
                </Field>

                {/* Currency — custom Dropdown */}
                <Field label="Currency" required>
                  <Dropdown
                    value={editFormState.currency || CURRENCIES[0].value}
                    onChange={setField("currency")}
                    options={CURRENCIES}
                    widthClass="w-full"
                    triggerWidthClass="w-full"
                    heightClass="h-[49px]"
                    bgClass="bg-white"
                    error={!!(errors["currency"] && touched["currency"])}
                  />
                  {err("currency")}
                </Field>

                <Field label="Address" required className="col-span-2">
                  <input value={editFormState.address} onChange={handleChange("address")} onBlur={handleBlur("address")} className={ic("address")} />
                  {err("address")}
                </Field>
              </div>
            </section>

            {/* Admin Details Section */}
            <section className="pt-2">
              <h3 className="text-[18px] font-semibold text-[#1F2937] mb-2.5">Admin Details</h3>
              <div className="grid grid-cols-2 gap-[23px]">
                <Field label="Admin First Name" required>
                  <input value={editFormState.adminFirstName} onChange={handleChange("adminFirstName")} onBlur={handleBlur("adminFirstName")} className={ic("adminFirstName")} />
                  {err("adminFirstName")}
                </Field>
                <Field label="Admin Last Name" required>
                  <input value={editFormState.adminLastName} onChange={handleChange("adminLastName")} onBlur={handleBlur("adminLastName")} className={ic("adminLastName")} />
                  {err("adminLastName")}
                </Field>
                <Field label="Admin Email" required>
                  <input type="email" value={editFormState.adminEmail} onChange={handleChange("adminEmail")} onBlur={handleBlur("adminEmail")} className={ic("adminEmail")} />
                  {err("adminEmail")}
                </Field>
                <Field label="Job Title" required>
                  <input value={editFormState.adminJobTitle} onChange={handleChange("adminJobTitle")} onBlur={handleBlur("adminJobTitle")} className={ic("adminJobTitle")} />
                  {err("adminJobTitle")}
                </Field>
                <Field label="Credit Limit" required className="col-span-2">
                  <input
                    type="number"
                    value={editFormState.creditLimit}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setEditFormState({ ...editFormState, creditLimit: val });
                      if (touched["creditLimit"]) setErr("creditLimit", validate("creditLimit", val));
                    }}
                    onBlur={handleBlur("creditLimit")}
                    className={ic("creditLimit")}
                  />
                  {err("creditLimit")}
                </Field>
              </div>
            </section>

            {/* Assigned Airports Section */}
            <section className="pt-2">
              <div className="self-stretch inline-flex justify-between items-center w-full mb-6">
                <h3 className="text-[18px] font-semibold text-[#1F2937] font-figtree">Assigned Airports</h3>
                <span className="text-emerald-600 text-base font-medium font-figtree">
                  Selected: {selectedAirportIds.length} Airports
                </span>
              </div>

              <div className="self-stretch bg-white rounded-xl flex flex-col justify-start items-start gap-3.5 mb-5.5">
                <div className="self-stretch h-11 inline-flex justify-start items-center gap-3.5 w-full">
                  {/* Search input */}
                  <div className="flex-1 h-11 px-4 py-3 bg-white rounded-lg outline outline-1 outline-offset-[-1px] outline-gray-300 flex justify-start items-center gap-2 overflow-hidden">
                    <Search className="size-5 text-gray-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Search airports..."
                      value={airportSearch}
                      onChange={(e) => setAirportSearch(e.target.value)}
                      className="w-full bg-transparent outline-none text-gray-800 text-[16px] placeholder:text-gray-400 font-figtree"
                    />
                  </div>

                  {/* Country Dropdown */}
                  <div className="w-44 h-11">
                    <Dropdown
                      value={airportCountry}
                      onChange={setAirportCountry}
                      options={AIRPORT_COUNTRIES}
                      widthClass="w-44"
                      triggerWidthClass="w-full"
                      heightClass="h-11"
                      bgClass="bg-white"
                    />
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="self-stretch rounded-[12px] border border-[#E5E7EB] bg-white overflow-hidden w-full">
                <Table>
                  <TableHeader className="pt-1 uppercase text-xs font-medium text-gray-500 font-inter h-10 bg-gray-50">
                    <TableRow>
                      <TableHead className="flex-1 min-w-[168px]">
                        <SortHeader<any>
                          label="Airport"
                          field="name"
                          sortField={sortField}
                          sortOrder={sortOrder}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className="w-20 min-w-[68px]">
                        <SortHeader<any>
                          label="IATA"
                          field="iata"
                          sortField={sortField}
                          sortOrder={sortOrder}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className="w-28 min-w-[120px]">
                        <SortHeader<any>
                          label="Country"
                          field="country"
                          sortField={sortField}
                          sortOrder={sortOrder}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className="w-32 min-w-[126px]">
                        <SortHeader<any>
                          label="Status"
                          field="status"
                          sortField={sortField}
                          sortOrder={sortOrder}
                          onSort={handleSort}
                        />
                      </TableHead>
                      <TableHead className="w-28 min-w-[110px]">
                        <SortHeader<any>
                          label="Selection"
                          field="isSelected"
                          sortField={sortField}
                          sortOrder={sortOrder}
                          onSort={handleSort}
                        />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAirports.map((ap) => {
                      const isSelected = selectedAirportIds.includes(ap.id);
                      return (
                        <TableRow key={ap.id}>
                          <TableCell className="font-normal text-[#1F2937] max-w-[150px] h-[64px] leading-[100%] pr-5" title={ap.name}>
                            {ap.name}
                          </TableCell>
                          <TableCell>
                            <span className="rounded-sm bg-gray-200 text-gray-800 font-inter text-xs px-2.5 py-1.5 font-medium">
                              {ap.iata}
                            </span>
                          </TableCell>
                          <TableCell className="text-[#1F2937] truncate max-w-[100px]" title={ap.country}>
                            {ap.country}
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex items-center rounded-2xl px-2.5 py-0.5 text-xs font-medium font-inter",
                                ap.status === "Active"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              )}
                            >
                              {ap.status}
                            </span>
                          </TableCell>
                          <TableCell>
                            <button
                              type="button"
                              onClick={() => handleToggleAirport(ap.id)}
                              className={cn(
                                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                                isSelected ? "bg-[#0F2757]" : "bg-gray-200"
                              )}
                            >
                              <span
                                className={cn(
                                  "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                  isSelected ? "translate-x-5" : "translate-x-0"
                                )}
                              />
                            </button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {sortedAirports.length === 0 && (
                  <div className="p-6 text-center text-gray-500 text-sm w-full bg-white">
                    No airports found matching the filters.
                  </div>
                )}
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
              disabled={!hasChanges || isSaving}
              className="flex-1 py-3 px-6 rounded-lg bg-[#0F2757] hover:bg-[#162259] text-white text-[18px] transition-colors cursor-pointer disabled:opacity-60 flex justify-center items-center"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// Helpers
const inputCls =
  "w-full h-[49px] px-4 py-3 rounded-lg border border-[#D1D5DB] text-[16px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B] transition-all placeholder:text-[#9CA3AF]";

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
