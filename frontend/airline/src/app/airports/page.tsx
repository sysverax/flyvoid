"use client";

import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { Header } from "@/src/components/layout/Header";
import { Pagination } from "@/src/components/ui/pagination";
import { TableEmptyState } from "@/src/components/ui/EmptyState";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  SortHeader,
} from "@/src/components/ui/table";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { FiltersCard } from "@/src/components/ui/FiltersCard";
import { Dropdown } from "@/src/components/ui/Dropdown";

interface Airport {
  id: string;
  name: string;
  iataCode: string;
  icaoCode: string;
  city: string;
  country: string;
  latitude: number;
  longitude: number;
  timezone: string;
  type: "INTERNATIONAL" | "DOMESTIC";
  isActive: boolean;
}

const MOCK_AIRPORTS: Airport[] = [
  {
    id: "1",
    name: "Los Angeles International Airport",
    iataCode: "LAX",
    icaoCode: "KLAX",
    city: "Los Angeles",
    country: "United States",
    latitude: 33.9416,
    longitude: -118.4085,
    timezone: "GMT-8",
    type: "INTERNATIONAL",
    isActive: true,
  },
  {
    id: "2",
    name: "John F. Kennedy International Airport",
    iataCode: "JFK",
    icaoCode: "KJFK",
    city: "New York",
    country: "United States",
    latitude: 40.6413,
    longitude: -73.7781,
    timezone: "GMT-5",
    type: "INTERNATIONAL",
    isActive: true,
  },
  {
    id: "3",
    name: "London Heathrow Airport",
    iataCode: "LHR",
    icaoCode: "EGLL",
    city: "London",
    country: "United Kingdom",
    latitude: 51.4700,
    longitude: -0.4543,
    timezone: "GMT+0",
    type: "INTERNATIONAL",
    isActive: true,
  },
  {
    id: "4",
    name: "Tokyo Haneda Airport",
    iataCode: "HND",
    icaoCode: "RJTT",
    city: "Tokyo",
    country: "Japan",
    latitude: 35.5494,
    longitude: 139.7798,
    timezone: "GMT+9",
    type: "INTERNATIONAL",
    isActive: true,
  },
  {
    id: "5",
    name: "Charles de Gaulle Airport",
    iataCode: "CDG",
    icaoCode: "LFPG",
    city: "Paris",
    country: "France",
    latitude: 49.0097,
    longitude: 2.5479,
    timezone: "GMT+1",
    type: "INTERNATIONAL",
    isActive: true,
  }
];

const COUNTRY_OPTIONS = [
  { value: "All Countries", label: "All Countries" },
  { value: "United States", label: "United States" },
  { value: "United Kingdom", label: "United Kingdom" },
  { value: "Germany", label: "Germany" },
  { value: "France", label: "France" },
  { value: "Japan", label: "Japan" },
  { value: "Singapore", label: "Singapore" },
  { value: "Australia", label: "Australia" },
  { value: "Canada", label: "Canada" },
  { value: "United Arab Emirates", label: "United Arab Emirates" },
];



export default function AirportsPage() {
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("All Countries");

  // Sorting States
  const [sortField, setSortField] = useState<keyof Airport | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(10);



  // Clear all filters
  const handleClearAll = () => {
    setSearchQuery("");
    setSelectedCountry("All Countries");
    setSortField(null);
    setSortOrder("asc");
    setCurrentPage(1);
  };

  // Header Sorting Click
  const handleSort = (field: keyof Airport) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  // Filtering Logic
  const filteredAirports = useMemo(() => {
    return MOCK_AIRPORTS.filter((ap) => {
      const matchesSearch =
        searchQuery === "" ||
        ap.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ap.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ap.iataCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ap.icaoCode.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCountry =
        selectedCountry === "All Countries" || ap.country === selectedCountry;

      return matchesSearch && matchesCountry;
    });
  }, [searchQuery, selectedCountry]);

  // Sorting Logic
  const sortedAirports = useMemo(() => {
    if (!sortField) return filteredAirports;
    return [...filteredAirports].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];

      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      if (strA < strB) return sortOrder === "asc" ? -1 : 1;
      if (strA > strB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredAirports, sortField, sortOrder]);

  // Pagination Logic
  const paginatedAirports = useMemo(() => {
    const startIndex = (currentPage - 1) * resultsPerPage;
    return sortedAirports.slice(startIndex, startIndex + resultsPerPage);
  }, [sortedAirports, currentPage, resultsPerPage]);

  const totalPages = Math.ceil(sortedAirports.length / resultsPerPage) || 1;

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      <div className="space-y-7">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%]">
            Airports
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            Manage and view your airline's operating airports
          </p>
        </div>

        {/* Filter panel card */}
        <FiltersCard
          searchQuery={searchQuery}
          setSearchQuery={(q) => {
            setSearchQuery(q);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search airports..."
          onClearFilters={handleClearAll}
        >
          {/* Country selector */}
          <Dropdown
            value={selectedCountry}
            onChange={(val) => {
              setSelectedCountry(val);
              setCurrentPage(1);
            }}
            options={COUNTRY_OPTIONS}
            widthClass="w-44"
            triggerWidthClass="w-[180px]"
          />
        </FiltersCard>

        {/* Table view container */}
        <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white mb-6">
          <Table>
            <TableHeader>
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
                <TableHead className="min-w-[95px]">
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
                    label="City"
                    field="city"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[140px]">
                  <SortHeader
                    label="Country"
                    field="country"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedAirports.length === 0 ? (
                <TableEmptyState
                  colSpan={4}
                  icon={Search}
                  title="No airports found"
                  message="Try adjusting your filters or search query."
                />
              ) : (
                paginatedAirports.map((airport) => (
                  <TableRow key={airport.id}>
                    <TableCell className="font-medium text-[#1F2937]">
                      {airport.name}
                    </TableCell>
                    <TableCell>
                      <span className="rounded-[4px] bg-[#E5E7EB] text-[#1F2937] font-inter text-[12px] px-2.5 py-1.5 font-medium h-[28px]">
                        {airport.iataCode}
                      </span>
                    </TableCell>
                    <TableCell className="text-[#6B7280]">
                      {airport.city}
                    </TableCell>
                    <TableCell className="text-[#6B7280]">
                      {airport.country}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <Pagination
          totalResults={sortedAirports.length}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          resultsPerPage={resultsPerPage}
          setResultsPerPage={setResultsPerPage}
          totalPages={totalPages}
        />
      </div>
    </div>
  );
}
