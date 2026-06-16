"use client";

import { useState, useEffect } from "react";
import { X, Search } from "lucide-react";
import { Airline } from "@/src/types/airlines";
import { cn } from "@/src/lib/utils";
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

const ALL_AIRPORTS: AirportItem[] = [
  { id: "pac-act", name: "Pacific Airport", iata: "PA", country: "USA", status: "Active" },
  { id: "lhr-act", name: "Heathrow Airport", iata: "LHR", country: "UK", status: "Active" },
  { id: "hnd-act", name: "Tokyo Haneda Airport", iata: "HND", country: "Japan", status: "Active" },
  { id: "lax-act", name: "Los Angeles International Airport", iata: "LAX", country: "USA", status: "Active" },
  { id: "dxb-act", name: "Heathrow Airport", iata: "DXB", country: "UAE", status: "Active" },
  { id: "lhr-inact", name: "Dubai International Airport", iata: "LHR", country: "UK", status: "Active" },
  { id: "lax-inact", name: "Heathrow Airport", iata: "LAX", country: "USA", status: "Inactive" },
  { id: "hnd-inact", name: "Los Angeles International Airport", iata: "HND", country: "Japan", status: "Inactive" },
  { id: "sin-inact", name: "Tokyo Haneda Airport", iata: "SIN", country: "Singapore", status: "Inactive" },
  { id: "sidn-inact", name: "Changi Airport", iata: "SIN", country: "Singapore", status: "Inactive" },
  { id: "atl-inact", name: "Hartsfield-Jackson Atlanta International Airport", iata: "ATL", country: "USA", status: "Inactive" },
  { id: "cdg-inact", name: "Charles de Gaulle Airport", iata: "CDG", country: "France", status: "Inactive" },
];

const AIRPORT_COUNTRIES: DropdownOption[] = [
  { value: "All Countries", label: "All Countries" },
  { value: "USA", label: "USA" },
  { value: "UK", label: "UK" },
  { value: "Japan", label: "Japan" },
  { value: "UAE", label: "UAE" },
  { value: "Singapore", label: "Singapore" },
  { value: "France", label: "France" },
];

interface EditAirlineModalProps {
  isOpen: boolean;
  airline: Airline | null;
  onClose: () => void;
  onSave: (updatedFields: Partial<Airline>) => void;
}

export function EditAirlineModal({
  isOpen,
  airline,
  onClose,
  onSave,
}: EditAirlineModalProps) {
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

  const [selectedAirportIds, setSelectedAirportIds] = useState<string[]>([]);
  const [airportSearch, setAirportSearch] = useState("");
  const [airportCountry, setAirportCountry] = useState("All Countries");
  const [sortField, setSortField] = useState<keyof AirportItem | "isSelected" | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

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

      // Initialize selected airports
      const initialSelected: string[] = [];
      if (airline.assignedAirports) {
        const names = airline.assignedAirports.split(",").map((n) => n.trim());
        const tempNames = [...names];
        ALL_AIRPORTS.forEach((ap) => {
          const idx = tempNames.indexOf(ap.name);
          if (idx !== -1) {
            initialSelected.push(ap.id);
            tempNames.splice(idx, 1);
          }
        });
      } else {
        // Fallback default selection
        initialSelected.push("pac-act", "lhr-act", "hnd-act", "lax-act", "dxb-act");
      }
      setSelectedAirportIds(initialSelected);
    }
    setAirportSearch("");
    setAirportCountry("All Countries");
  }, [airline]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Map selected airport IDs back to a comma-separated list of airport names
    const selectedAirports = ALL_AIRPORTS.filter((ap) => selectedAirportIds.includes(ap.id));
    const assignedAirportsStr = selectedAirports.map((ap) => ap.name).join(", ");

    onSave({
      ...editFormState,
      assignedAirports: assignedAirportsStr,
    });
  };

  const handleToggleAirport = (id: string) => {
    setSelectedAirportIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const field = (key: keyof typeof editFormState) => ({
    value: editFormState[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setEditFormState({ ...editFormState, [key]: e.target.value }),
  });

  const setField = (key: keyof typeof editFormState) => (val: string) =>
    setEditFormState({ ...editFormState, [key]: val });

  // Filter airports list
  const filteredAirports = ALL_AIRPORTS.filter((ap) => {
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
            <X className="w-5 h-5 text-[#1F2937]" />
          </button>
        </div>

        <div className="w-full" style={{ padding: "0px 24px" }}>
          <div className="h-px bg-[#D1D5DB] w-full" />
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-hide">

            {/* Airline Details Section */}
            <section>
              <h3 className="text-[18px] font-semibold text-[#1F2937] mb-2.5">Airline Details</h3>
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
                    value={editFormState.country || COUNTRIES[0].value}
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
                  <input type="tel" {...field("contactPhone")} required className={inputCls} />
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
                  />
                </Field>

                <Field label="Logo URL">
                  <input placeholder="https://..." {...field("logoUrl")} className={inputCls} />
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
                  <input {...field("adminFirstName")} required className={inputCls} />
                </Field>
                <Field label="Admin Last Name" required>
                  <input {...field("adminLastName")} required className={inputCls} />
                </Field>
                <Field label="Admin Email" required>
                  <input type="email" {...field("adminEmail")} required className={inputCls} />
                </Field>
                <Field label="Job Title" required>
                  <input {...field("adminJobTitle")} required className={inputCls} />
                </Field>
                <Field label="Credit Limit" required className="col-span-2">
                  <input
                    type="number"
                    value={editFormState.creditLimit}
                    onChange={(e) => setEditFormState({ ...editFormState, creditLimit: Number(e.target.value) })}
                    required
                    className={inputCls}
                  />
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
              className="flex-1 py-3 px-6 rounded-lg bg-[#0F2757] hover:bg-[#162259] text-white text-[18px] transition-colors cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

// Helpers
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
