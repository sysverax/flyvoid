"use client";

import { useState, useMemo, useEffect } from "react";
import { Search } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  SortHeader,
} from "@/src/components/ui/table";
import { Pagination } from "@/src/components/ui/pagination";
import { sortData } from "@/src/lib/utils";
import { Airport } from "@/src/types/airports";
import { TableEmptyState } from "@/src/components/ui/EmptyState";
import { FiltersCard } from "@/src/components/ui/FiltersCard";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { TruncatedTooltip } from "@/src/components/ui/TruncatedTooltip";
import { toast } from "react-toastify";
import { countries } from "countries-list";
import { airportsService } from "@/src/services/airports.service";

const getCountryCode = (countryName: string): string => {
  const entry = Object.entries(countries).find(
    ([_, c]) => c.name.toLowerCase() === countryName.toLowerCase()
  );
  return entry ? entry[0] : "US";
};

function mapAirportDTOToAirport(dto: any): Airport {
  const countryName =
    countries[dto.countryCode as keyof typeof countries]?.name ||
    dto.countryCode ||
    "N/A";
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

  // Search & Filters states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("All Countries");

  // Pagination states
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Sorting states
  const [sortField, setSortField] = useState<keyof Airport | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Country options matching the admin portal format exactly
  const countryOptions = [
    { value: "All Countries", label: "All Countries" },
    ...Object.entries(countries)
      .map(([_, c]) => ({ value: c.name, label: c.name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        let countryCode: string | undefined = undefined;
        if (selectedCountry !== "All Countries") {
          countryCode = getCountryCode(selectedCountry);
        }

        const res = await airportsService.getAirports({
          search: searchQuery.trim() || undefined,
          countryCode,
          page: currentPage,
          limit: resultsPerPage,
        });

        if (isMounted) {
          const mapped = res.airports.map(mapAirportDTOToAirport);
          setAirports(mapped);
          setTotalResults(res.total);
        }
      } catch (err: any) {
        if (isMounted) {
          toast.error(err.message || "Failed to load airports");
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const timeoutId = setTimeout(() => {
      loadData();
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [searchQuery, selectedCountry, currentPage, resultsPerPage]);

  // Sorting logic matching admin portal
  const sortedAirports = useMemo(() => {
    return sortData(airports, sortField, sortOrder, []);
  }, [airports, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(totalResults / resultsPerPage));

  const handleClearAll = () => {
    setSearchQuery("");
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
            options={countryOptions}
            widthClass="w-full sm:w-44"
            triggerWidthClass="w-full sm:w-44"
            maxListHeightClass="max-h-[296px]"
            searchable
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
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="px-6 py-12 text-center text-gray-500 font-figtree"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-8 w-8 text-[#0F2757]"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Loading airports...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedAirports.length === 0 ? (
                <TableEmptyState
                  colSpan={4}
                  icon={Search}
                  title="No airports found"
                  message="Try adjusting your filters or search query."
                />
              ) : (
                sortedAirports.map((airport) => (
                  <TableRow key={airport.id}>
                    <TableCell className="font-medium text-[#1F2937]">
                      <TruncatedTooltip text={airport.name} side="top">
                        <div className="max-w-[200px] truncate cursor-default">
                          {airport.name}
                        </div>
                      </TruncatedTooltip>
                    </TableCell>
                    <TableCell>
                      <span className="rounded-[4px] bg-[#E5E7EB] text-[#1F2937] font-inter text-[12px] px-2.5 py-1.5 font-medium h-[28px]">
                        {airport.iataCode}
                      </span>
                    </TableCell>
                    <TableCell className="text-[#6B7280]">
                      <TruncatedTooltip text={airport.city} side="top">
                        <div className="max-w-[150px] truncate cursor-default">
                          {airport.city}
                        </div>
                      </TruncatedTooltip>
                    </TableCell>
                    <TableCell className="text-[#6B7280]">
                      <TruncatedTooltip text={airport.country} side="top">
                        <div className="max-w-[150px] truncate cursor-default">
                          {airport.country}
                        </div>
                      </TruncatedTooltip>
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
          setResultsPerPage={(size) => {
            setResultsPerPage(size);
            setCurrentPage(1);
          }}
          totalPages={totalPages}
        />
      </div>
    </div>
  );
}
