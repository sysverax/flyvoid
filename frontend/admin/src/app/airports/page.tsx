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

const INITIAL_AIRPORTS: Airport[] = [
  {
    id: "1",
    name: "Dubai International Airport",
    iataCode: "PA", // As shown in screenshot
    icaoCode: "OMDB",
    city: "Dubai",
    countryCode: "AE",
    country: "United Arab Emirates",
    latitude: 25.2532,
    longitude: 55.3675,
    timezone: "Asia/Dubai",
    type: "INTERNATIONAL",
    isActive: true,
    address: "Terminal 3, Airport Rd, Dubai",
    postalCode: "00000",
  },
  {
    id: "2",
    name: "Heathrow Airport",
    iataCode: "LHR",
    icaoCode: "EGLL",
    city: "London",
    countryCode: "GB",
    country: "United Kingdom",
    latitude: 51.4700,
    longitude: -0.4543,
    timezone: "Europe/London",
    type: "DOMESTIC",
    isActive: true,
    address: "Longford TW6, United Kingdom",
    postalCode: "TW6 1QG",
  },
  {
    id: "3",
    name: "Tokyo Haneda Airport",
    iataCode: "HND",
    icaoCode: "RJTT",
    city: "Tokyo",
    countryCode: "JP",
    country: "Japan",
    latitude: 35.5523,
    longitude: 139.7798,
    timezone: "Asia/Tokyo",
    type: "INTERNATIONAL",
    isActive: true,
    address: "Hanedakuko, Ota City, Tokyo, Japan",
    postalCode: "144-0041",
  },
  {
    id: "4",
    name: "Los Angeles International Airport",
    iataCode: "LAX",
    icaoCode: "KLAX",
    city: "Los Angeles",
    countryCode: "US",
    country: "United States",
    latitude: 33.9416,
    longitude: -118.4085,
    timezone: "America/Los_Angeles",
    type: "DOMESTIC",
    isActive: false,
    address: "1 World Way, Los Angeles, CA 90045, USA",
    postalCode: "90045",
  },
  {
    id: "5",
    name: "John F. Kennedy International Airport",
    iataCode: "JFK",
    icaoCode: "KJFK",
    city: "New York",
    countryCode: "US",
    country: "United States",
    latitude: 40.6413,
    longitude: -73.7781,
    timezone: "America/New_York",
    type: "INTERNATIONAL",
    isActive: true,
    address: "Queens, NY 11430, USA",
    postalCode: "11430",
  },
  {
    id: "6",
    name: "Changi Airport",
    iataCode: "SIN",
    icaoCode: "WSSS",
    city: "Singapore",
    countryCode: "SG",
    country: "Singapore",
    latitude: 1.3644,
    longitude: 103.9915,
    timezone: "Asia/Singapore",
    type: "INTERNATIONAL",
    isActive: false,
    address: "Airport Blvd., Singapore",
    postalCode: "918146",
  },
];

export default function AirportsPage() {
  const [airports, setAirports] = useState<Airport[]>(INITIAL_AIRPORTS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);
  const { hasPermission } = useAuth();

  // Navigation / Details view state
  const [selectedAirportId, setSelectedAirportId] = useState<string | null>(null);

  // Search & Filters states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [selectedCountry, setSelectedCountry] = useState("All Countries");

  // Pagination states
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

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
  ];

  // Current selected airport object
  const selectedAirport = useMemo(() => {
    return airports.find((ap) => ap.id === selectedAirportId) || null;
  }, [airports, selectedAirportId]);

  // Filtration logic
  const filteredAirports = useMemo(() => {
    return airports.filter((ap) => {
      const matchesSearch =
        ap.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ap.iataCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ap.city.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        selectedStatus === "All Status" ||
        (selectedStatus === "Active" && ap.isActive) ||
        (selectedStatus === "Inactive" && !ap.isActive);

      const matchesCountry =
        selectedCountry === "All Countries" || ap.country === selectedCountry;

      return matchesSearch && matchesStatus && matchesCountry;
    });
  }, [airports, searchQuery, selectedStatus, selectedCountry]);

  // Sorting logic
  const sortedAirports = useMemo(() => {
    return sortData(filteredAirports, sortField, sortOrder, []);
  }, [filteredAirports, sortField, sortOrder]);

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(sortedAirports.length / resultsPerPage));

  const paginatedAirports = useMemo(() => {
    const startIndex = (currentPage - 1) * resultsPerPage;
    return sortedAirports.slice(startIndex, startIndex + resultsPerPage);
  }, [sortedAirports, currentPage, resultsPerPage]);

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
  const handleToggleStatus = (airport: Airport) => {
    setAirports((prev) =>
      prev.map((item) => {
        if (item.id === airport.id) {
          return { ...item, isActive: !item.isActive };
        }
        return item;
      })
    );
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
  const handleSaveAirport = (fields: Partial<Airport>) => {
    if (editTarget) {
      // Editing existing airport
      setAirports((prev) =>
        prev.map((item) => {
          if (item.id === editTarget.id) {
            return { ...item, ...fields };
          }
          return item;
        })
      );
    } else {
      // Adding new airport
      const newId = (airports.length + 1).toString();
      const newAirport: Airport = {
        id: newId,
        name: fields.name || "",
        iataCode: fields.iataCode || "",
        icaoCode: fields.icaoCode || "",
        city: fields.city || "",
        countryCode: fields.countryCode || "",
        country: fields.country || "",
        latitude: fields.latitude || 0,
        longitude: fields.longitude || 0,
        timezone: fields.timezone || "Asia/Dubai",
        type: fields.type || "INTERNATIONAL",
        isActive: fields.isActive !== undefined ? fields.isActive : true,
        address: fields.address || "",
        postalCode: fields.postalCode || "",
      };
      setAirports((prev) => [...prev, newAirport]);
    }
    setIsModalOpen(false);
    setEditTarget(null);
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
              ) : paginatedAirports.length === 0 ? (
                <TableEmptyState
                  colSpan={9}
                  icon={Search}
                  title="No airports found"
                  message="Try adjusting your filters or search query."
                />
              ) : (
                paginatedAirports.map((airport) => (
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
          totalResults={filteredAirports.length}
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
        airport={selectedAirport || INITIAL_AIRPORTS[0]}
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
        onClose={() => {
          setIsModalOpen(false);
          setEditTarget(null);
        }}
        onSave={handleSaveAirport}
      />
    </div>
  );
}
