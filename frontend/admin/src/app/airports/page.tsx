"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, Eye, Plus, Edit, Loader2 } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  SortHeader,
} from "../../components/ui/table";
import { Pagination } from "@/src/components/ui/pagination";
import { cn, sortData } from "@/src/lib/utils";
import { Airport } from "@/src/types/airports";
import { TableEmptyState } from "@/src/components/ui/EmptyState";
import { FiltersCard } from "@/src/components/ui/FiltersCard";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { AddEditAirportModal } from "@/src/components/airports/AddEditAirportModal";
import { AirportDetailsView } from "@/src/components/airports/AirportDetailsView";
import { useAuth } from "@/src/hooks/useAuth";
import { toast } from "react-toastify";
import { countries } from "countries-list";
import { airportsService } from "@/src/services/airports.service";

const getCountryCode = (countryName: string): string => {
  const entry = Object.entries(countries).find(
    ([_, c]) => c.name.toLowerCase() === countryName.toLowerCase()
  );
  return entry ? entry[0] : "US";
};

function decodeJwt(token: string): any {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

function mapAirportDTOToAirport(dto: any): Airport {
  const countryName = countries[dto.countryCode as keyof typeof countries]?.name || dto.countryCode || "N/A";
  return {
    id: String(dto.id),
    name: dto.name,
    iataCode: dto.iataCode,
    icaoCode: dto.icaoCode,
    city: dto.city,
    countryCode: dto.countryCode,
    country: countryName,
    latitude: dto.latitude,
    longitude: dto.longitude,
    timezone: dto.timezone,
    type: dto.type,
    isActive: dto.isActive,
    address: dto.address,
    postalCode: dto.postalCode,
  };
}

export default function AirportsPage() {
  const [airports, setAirports] = useState<Airport[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { hasPermission } = useAuth();

  const isAirlineUser = useMemo(() => {
    if (typeof window === "undefined") return false;
    const token = sessionStorage.getItem("flyvoid_access_token");
    if (!token) return false;
    const decoded = decodeJwt(token);
    return decoded?.userType === "AIRLINE";
  }, []);

  // Navigation / Details view state
  const [selectedAirportId, setSelectedAirportId] = useState<string | null>(null);

  // Search & Filters states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [selectedCountry, setSelectedCountry] = useState("All Countries");

  // Pagination states
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Sorting states
  const [sortField, setSortField] = useState<keyof Airport | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Add/Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Airport | null>(null);

  // Static options for dropdown filters
  const statusOptions = [
    { value: "All Status", label: "All Status" },
    { value: "Active", label: "Active" },
    { value: "Inactive", label: "Inactive" },
  ];

  // Static country options matching the Airlines tab exactly
  const countryOptions = [
    { value: "All Countries", label: "All Countries" },
    { value: "United States", label: "United States" },
    { value: "United Kingdom", label: "United Kingdom" },
    { value: "Germany", label: "Germany" },
    { value: "France", label: "France" },
    { value: "India", label: "India" },
    { value: "Canada", label: "Canada" },
    { value: "Australia", label: "Australia" },
    { value: "United Arab Emirates", label: "United Arab Emirates" },
  ];

  const fetchAirports = async () => {
    setIsLoading(true);
    try {
      let countryCode: string | undefined = undefined;
      if (selectedCountry !== "All Countries") {
        countryCode = getCountryCode(selectedCountry);
      }

      let status: boolean | undefined = undefined;
      if (!isAirlineUser) {
        if (selectedStatus === "Active") {
          status = true;
        } else if (selectedStatus === "Inactive") {
          status = false;
        }
      }

      const res = await airportsService.getAirports({
        search: searchQuery || undefined,
        countryCode,
        status,
        page: currentPage,
        limit: resultsPerPage,
      });

      const mapped = res.airports.map(mapAirportDTOToAirport);
      setAirports(mapped);
      setTotalResults(res.total);
    } catch (err: any) {
      toast.error(err.message || "Failed to load airports");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAirports();
  }, [searchQuery, selectedStatus, selectedCountry, currentPage, resultsPerPage]);

  // Current selected airport object
  const selectedAirport = useMemo(() => {
    return airports.find((ap) => ap.id === selectedAirportId) || null;
  }, [airports, selectedAirportId]);

  // Sorting logic
  const sortedAirports = useMemo(() => {
    return sortData(airports, sortField, sortOrder, []);
  }, [airports, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(totalResults / resultsPerPage));

  const handleClearAll = () => {
    setSearchQuery("");
    setSelectedStatus("All Status");
    setSelectedCountry("All Countries");
    setSortField(null);
    setSortOrder("asc");
    setCurrentPage(1);
  };

  const handleSort = (field: keyof Airport) => {
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
    setCurrentPage(1);
  };

  // Toggle active status switch directly in the table
  const handleToggleStatus = async (airport: Airport) => {
    setIsLoading(true);
    try {
      const response = await airportsService.updateAirport(Number(airport.id), {
        isActive: !airport.isActive,
      });
      toast.success(response.message || `Successfully updated status for ${airport.name}`);
      fetchAirports();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    } finally {
      setIsLoading(false);
    }
  };

  // Open add/edit modal
  const handleOpenAddModal = () => {
    setEditTarget(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (airport: Airport) => {
    setEditTarget(airport);
    setIsModalOpen(true);
  };

  // Save changes from Add/Edit modal
  const handleSaveAirport = async (fields: Partial<Airport>) => {
    setIsSaving(true);
    try {
      if (editTarget) {
        // Editing existing airport
        const response = await airportsService.updateAirport(Number(editTarget.id), {
          name: fields.name,
          iataCode: fields.iataCode,
          icaoCode: fields.icaoCode,
          countryCode: fields.countryCode,
          city: fields.city,
          latitude: fields.latitude,
          longitude: fields.longitude,
          timezone: fields.timezone,
          type: fields.type,
          isActive: fields.isActive,
          address: fields.address || undefined,
          postalCode: fields.postalCode,
        });
        toast.success(response.message || "Airport updated successfully");
      } else {
        // Adding new airport
        const response = await airportsService.createAirport({
          name: fields.name!,
          iataCode: fields.iataCode!,
          icaoCode: fields.icaoCode!,
          countryCode: fields.countryCode!,
          city: fields.city!,
          latitude: fields.latitude!,
          longitude: fields.longitude!,
          timezone: fields.timezone!,
          type: fields.type!,
          isActive: fields.isActive !== undefined ? fields.isActive : true,
          address: fields.address || undefined,
          postalCode: fields.postalCode!,
        });
        toast.success(response.message || "Airport created successfully");
      }
      setIsModalOpen(false);
      setEditTarget(null);
      fetchAirports();
    } catch (err: any) {
      toast.error(err.message || "Failed to save airport");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      <div className="space-y-6.5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%]">
              Airports
            </h1>
            <p className="text-[14px] text-[#6B7280] mt-1">
              Manage and configure airport details.
            </p>
          </div>
          {hasPermission("edit") && (
            <button
              onClick={handleOpenAddModal}
              className="h-[50px] rounded-[10px] bg-primary hover:bg-[#1A3B75] px-4.5 py-[9px] text-[16px] font-medium font-figtree transition-colors duration-200 cursor-pointer text-white flex items-center justify-center gap-1.5 -translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              <span>Add Airport</span>
            </button>
          )}
        </div>

        {/* Filters Bar */}
        <FiltersCard
          searchQuery={searchQuery}
          setSearchQuery={(q) => {
            setSearchQuery(q);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search airports..."
          onClearFilters={handleClearAll}
        >
          {/* Status Filter */}
          {!isAirlineUser && (
            <Dropdown
              value={selectedStatus}
              onChange={(val) => {
                setSelectedStatus(val);
                setCurrentPage(1);
              }}
              options={statusOptions}
              widthClass="w-44"
              triggerWidthClass="w-[180px]"
            />
          )}

          {/* Country/City Filter */}
          <Dropdown
            value={selectedCountry}
            onChange={(val) => {
              setSelectedCountry(val);
              setCurrentPage(1);
            }}
            options={countryOptions}
            widthClass="w-44"
            triggerWidthClass="w-[180px]"
          />
        </FiltersCard>

        {/* Airports Table */}
        <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white mb-5 -translate-y-0.5">
          <Table>
            <TableHeader >
              <TableRow>
                <TableHead className="min-w-[260px]">
                  <SortHeader
                    label="Name"
                    field="name"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[68px]">
                  <SortHeader
                    label="Iata"
                    field="iataCode"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[140px]">
                  <SortHeader
                    label="Country"
                    field="city"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[100px]">
                  <SortHeader
                    label="Latitude"
                    field="latitude"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[120px]">
                  <SortHeader
                    label="Longitude"
                    field="longitude"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[138px]">
                  <SortHeader
                    label="Timezone"
                    field="timezone"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[140px]">
                  <SortHeader
                    label="Type"
                    field="type"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[89px]">
                  <SortHeader
                    label="Status"
                    field="isActive"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[76px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="px-6 py-12 text-center text-gray-500 font-figtree">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Loading airports...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedAirports.length === 0 ? (
                <TableEmptyState
                  colSpan={9}
                  icon={Search}
                  title="No airports found"
                  message="Try adjusting your filters or search query."
                />
              ) : (
                sortedAirports.map((airport) => (
                  <TableRow key={airport.id}>
                    <TableCell className="leading-[100%] text-[15px] font-inter">
                      {airport.name}
                    </TableCell>
                    <TableCell>
                      <span className="rounded-[4px] bg-[#E5E7EB] text-[#1F2937] font-inter text-[12px] px-2.5 py-1.5 font-medium h-[28px]">
                        {airport.iataCode}
                      </span>
                    </TableCell>
                    <TableCell className="font-inter">{airport.city}</TableCell>
                    <TableCell className="font-inter">
                      {airport.latitude.toFixed(4)}
                    </TableCell>
                    <TableCell className="font-inter">
                      {airport.longitude.toFixed(4)}
                    </TableCell>
                    <TableCell className="truncate max-w-[138px] font-inter" title={airport.timezone}>
                      {airport.timezone}
                    </TableCell>
                    <TableCell className="font-inter">
                      {airport.type}
                    </TableCell>
                    <TableCell>
                      {/* Status Toggle Switch */}
                      <button
                        type="button"
                        disabled={!hasPermission("edit")}
                        onClick={() => handleToggleStatus(airport)}
                        className={cn(
                          "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                          hasPermission("edit") ? "cursor-pointer" : "cursor-not-allowed opacity-70",
                          airport.isActive ? "bg-emerald-500" : "bg-gray-200"
                        )}
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                            airport.isActive ? "translate-x-5" : "translate-x-0"
                          )}
                        />
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-start gap-1 -translate-x-1">
                        <button
                          onClick={() => setSelectedAirportId(airport.id)}
                          className="p-1 text-[#6B7280] hover:text-primary transition-colors cursor-pointer"
                        >
                          <Eye className="h-[20px] w-[20px]" />
                        </button>
                        {hasPermission("edit") && (
                          <button
                            onClick={() => handleOpenEditModal(airport)}
                            className="p-1 text-[#6B7280] hover:text-[#0F2757] transition-colors cursor-pointer"
                          >
                            <Edit className="h-[20px] w-[20px]" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <Pagination
          totalResults={totalResults}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          resultsPerPage={resultsPerPage}
          setResultsPerPage={setResultsPerPage}
          totalPages={totalPages}
        />
      </div>

      {/* Details Modal */}
      <AirportDetailsView
        isOpen={!!selectedAirport}
        airport={selectedAirport || airports[0]}
        onClose={() => setSelectedAirportId(null)}
        onEditClick={() => {
          if (selectedAirport) {
            const target = selectedAirport;
            setSelectedAirportId(null);
            handleOpenEditModal(target);
          }
        }}
      />

      {/* Add / Edit Modal */}
      <AddEditAirportModal
        isOpen={isModalOpen}
        airport={editTarget}
        isSaving={isSaving}
        onClose={() => {
          if (!isSaving) {
            setIsModalOpen(false);
            setEditTarget(null);
          }
        }}
        onSave={handleSaveAirport}
      />
    </div>
  );
}
