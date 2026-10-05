"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, Users, DollarSign, Loader2 } from "lucide-react";
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
import { sortData } from "@/src/lib/utils";
import {
  CancelledFlightItem,
  CancelledFlightsPagination,
  CancelledFlightsSummaryResponse,
  GetCancelledFlightsQueryParams,
  GetCancelledFlightsSummaryQueryParams,
} from "@/src/types/cancellation";
import { TableEmptyState } from "@/src/components/ui/EmptyState";
import { FiltersCard } from "@/src/components/ui/FiltersCard";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { DatePicker } from "@/src/components/ui/DatePicker";
import { cancellationService } from "@/src/services/cancellation.service";
import { airlinesService } from "@/src/services/airlines.service";
import { toast } from "react-toastify";

export default function CancellationPage() {
  const [flights, setFlights] = useState<CancelledFlightItem[]>([]);
  const [pagination, setPagination] = useState<CancelledFlightsPagination>({
    currentPage: 1,
    limit: 10,
    totalCount: 0,
  });
  const [summary, setSummary] = useState<CancelledFlightsSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Airlines list for filter
  const [airlines, setAirlines] = useState<{ id: number; name: string; code: string }[]>([]);

  // State for search and filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [selectedAirline, setSelectedAirline] = useState("All Airlines");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination states
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Sorting states
  const [sortField, setSortField] = useState<keyof CancelledFlightItem | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Load airlines list once for the dropdown filter
  useEffect(() => {
    const fetchAirlines = async () => {
      try {
        const res = await airlinesService.getAirlines({ page: 1, limit: 100 });
        setAirlines(res.airlines || []);
      } catch (err) {
        console.error("Failed to load airlines for filter", err);
      }
    };
    fetchAirlines();
  }, []);

  const airlinesMap = useMemo(() => {
    const map: Record<number, { name: string; code: string }> = {};
    airlines.forEach((a) => {
      map[a.id] = { name: a.name, code: a.code };
    });
    return map;
  }, [airlines]);

  const statusOptions = [
    { value: "All Status", label: "All Status" },
    { value: "draft", label: "Draft" },
    { value: "in_progress", label: "In Progress" },
    { value: "passengers_booking_confirmed", label: "Bookings Confirmed" },
    { value: "allocated", label: "Allocated" },
    { value: "paid", label: "Paid" },
    { value: "published", label: "Published" },
  ];

  const airlineOptions = useMemo(() => {
    return [
      { value: "All Airlines", label: "All Airlines" },
      ...airlines.map((a) => ({
        value: String(a.id),
        label: `${a.name} (${a.code})`,
      })),
    ];
  }, [airlines]);

  // Construct API params
  const apiQueryParams = useMemo<GetCancelledFlightsQueryParams>(() => {
    const params: GetCancelledFlightsQueryParams = {
      page: currentPage,
      limit: resultsPerPage,
    };
    if (searchQuery.trim()) {
      params.search = searchQuery.trim();
    }
    if (selectedStatus && selectedStatus !== "All Status") {
      params.status = selectedStatus;
    }
    if (selectedAirline && selectedAirline !== "All Airlines") {
      const parsedId = Number(selectedAirline);
      if (!isNaN(parsedId)) {
        params.airlineId = parsedId;
      }
    }
    if (startDate) {
      params.startDate = startDate;
    }
    if (endDate) {
      params.endDate = endDate;
    }
    return params;
  }, [currentPage, resultsPerPage, searchQuery, selectedStatus, selectedAirline, startDate, endDate]);

  const summaryQueryParams = useMemo<GetCancelledFlightsSummaryQueryParams>(() => {
    const params: GetCancelledFlightsSummaryQueryParams = {};
    if (searchQuery.trim()) {
      params.search = searchQuery.trim();
    }
    if (selectedStatus && selectedStatus !== "All Status") {
      params.status = selectedStatus;
    }
    if (selectedAirline && selectedAirline !== "All Airlines") {
      const parsedId = Number(selectedAirline);
      if (!isNaN(parsedId)) {
        params.airlineId = parsedId;
      }
    }
    if (startDate) {
      params.startDate = startDate;
    }
    if (endDate) {
      params.endDate = endDate;
    }
    return params;
  }, [searchQuery, selectedStatus, selectedAirline, startDate, endDate]);

  // Fetch paginated flight list
  const fetchFlights = async () => {
    setIsLoading(true);
    try {
      const listResult = await cancellationService.getCancelledFlights(apiQueryParams);
      setFlights(listResult.cancelledFlights || []);
      setPagination(listResult.pagination || { currentPage: 1, limit: 10, totalCount: 0 });
    } catch (err: any) {
      toast.error(err.message || "Failed to load cancelled flights");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch summary totals
  const fetchSummary = async () => {
    try {
      const summaryResult = await cancellationService.getCancelledFlightsSummary(summaryQueryParams);
      if (summaryResult) {
        setSummary(summaryResult);
      }
    } catch (err) {
      console.warn("Summary endpoint failed:", err);
    }
  };

  useEffect(() => {
    fetchFlights();
  }, [apiQueryParams]);

  useEffect(() => {
    fetchSummary();
  }, [summaryQueryParams]);

  // Handler to clear all filters
  const handleClearAll = () => {
    setSearchQuery("");
    setSelectedStatus("All Status");
    setSelectedAirline("All Airlines");
    setStartDate("");
    setEndDate("");
    setSortField(null);
    setSortOrder("asc");
    setCurrentPage(1);
  };

  const handleSort = (field: keyof CancelledFlightItem) => {
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

  // Client-side sort on current dataset
  const sortedFlights = useMemo(() => {
    if (sortField === "airline") {
      return [...flights].sort((a, b) => {
        const nameA = getAirlineDisplay(a).name.toLowerCase();
        const nameB = getAirlineDisplay(b).name.toLowerCase();
        if (nameA < nameB) return sortOrder === "asc" ? -1 : 1;
        if (nameA > nameB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      });
    }
    return sortData(flights, sortField, sortOrder, ["cancellationDate"]);
  }, [flights, sortField, sortOrder, airlinesMap]);

  const totalPages = Math.max(
    1,
    Math.ceil(pagination.totalCount / resultsPerPage)
  );

  const getAirlineDisplay = (flight: CancelledFlightItem) => {
    if (flight.airline) {
      return { name: flight.airline.name, code: flight.airline.code };
    }
    if (flight.airlineId && airlinesMap[flight.airlineId]) {
      return airlinesMap[flight.airlineId];
    }
    return { name: "N/A", code: "N/A" };
  };

  const statsConfig = [
    {
      title: "Total Cancellations",
      value: summary ? summary.totalCancelFlights.toLocaleString() : pagination.totalCount.toLocaleString(),
      description: "Matching current filters",
      icon: <img src="/icons/plane.svg" alt="Plane" />,
    },
    {
      title: "Total Passengers",
      value: summary
        ? (summary.totalAdults + summary.totalChildren).toLocaleString()
        : "0",
      description: "Across cancelled flights",
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: "Platform Revenue",
      value: summary
        ? `$${summary.totalPlatformFee.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
        : "$0",
      description: "Total platform fee",
      icon: <DollarSign className="h-5 w-5" />,
    },
  ];

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      {/* Header */}
      <div className="mb-7">
        <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%]">
          Cancelled Flights
        </h1>
        <p className="text-[14px] text-[#6B7280] mt-1">
          Read-only oversight of all cancelled flights across airlines
        </p>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
        {statsConfig.map((card, idx) => (
          <div
            key={idx}
            className="flex items-start justify-between rounded-[12px] border border-[#E5E7EB] bg-white p-3.5 relative -top-0.5"
          >
            <div>
              <p className="text-[16px] text-[#6B7280]">{card.title}</p>
              <h3 className="text-[24px] font-semibold text-[#1F2937] -ml-0.5">
                {card.value}
              </h3>
              <p className="text-[14px] text-[#6B7280] mt-2.5">
                {card.description}
              </p>
            </div>

            <div className="rounded-[8px] bg-[#F3F4F6] p-2.5 text-[#0F2757] flex items-center justify-center h-11 w-11 shrink-0">
              {card.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Filters Box */}
      <div className="mb-6">
        <FiltersCard
          searchQuery={searchQuery}
          setSearchQuery={(q) => {
            setSearchQuery(q);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search flight number..."
          onClearFilters={handleClearAll}
        >
          {/* Status Dropdown */}
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

          {/* Airline Dropdown */}
          <Dropdown
            value={selectedAirline}
            onChange={(val) => {
              setSelectedAirline(val);
              setCurrentPage(1);
            }}
            options={airlineOptions}
            widthClass="w-60"
            triggerWidthClass="w-[180px]"
          />

          {/* Divider */}
          <div className="hidden sm:block h-11 w-[2px] bg-[#E5E7EB] mx-1.5" />

          {/* Date controls */}
          <div className="flex items-center gap-2">
            <DatePicker
              value={startDate}
              onChange={(val) => {
                setStartDate(val);
                setCurrentPage(1);
              }}
              placeholder="Start Date"
            />
            <div className="ml-1.5">
              <DatePicker
                value={endDate}
                onChange={(val) => {
                  setEndDate(val);
                  setCurrentPage(1);
                }}
                placeholder="End Date"
              />
            </div>
          </div>
        </FiltersCard>
      </div>

      {/* Flights Table */}
      <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white mb-5 relative -left-[1px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[100px]">
                <SortHeader
                  label="Flight"
                  field="flightNumber"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="min-w-[223px]">
                <SortHeader
                  label="Airline"
                  field="airline"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="min-w-[223px]">
                Route
              </TableHead>
              <TableHead className="min-w-[110px]">
                <SortHeader
                  label="Date"
                  field="cancellationDate"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="min-w-[120px]">
                <SortHeader
                  label="Passengers"
                  field="totalPassengers"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="min-w-[120px] relative -left-1">
                <SortHeader
                  label="Cost"
                  field="totalCost"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="min-w-[120px] relative -left-1">
                <SortHeader
                  label="Revenue"
                  field="totalPlatformFee"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="min-w-[120px] relative -left-1">
                <SortHeader
                  label="Status"
                  field="status"
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
                <TableCell colSpan={8} className="px-6 py-12 text-center text-gray-500 font-figtree">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Loading cancellations...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : sortedFlights.length === 0 ? (
              <TableEmptyState
                colSpan={8}
                icon={Search}
                title="No flights found"
                message="Try adjusting your filters or search query."
              />
            ) : (
              sortedFlights.map((flight) => {
                const airlineInfo = getAirlineDisplay(flight);
                const depCode = flight.departureAirport?.code || "N/A";
                const arrCode = flight.arrivalAirport?.code || "N/A";
                const routeStr = `${depCode} → ${arrCode}`;
                const passengersCount = flight.totalPassengers ?? 0;
                const costAmount = flight.totalCost ?? 0;
                const revenueDisplay =
                  flight.totalPlatformFee !== undefined && flight.totalPlatformFee !== null
                    ? `$${flight.totalPlatformFee.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                    : "N/A";

                return (
                  <TableRow key={flight.id}>
                    <TableCell className="font-mono text-[#1F2937] font-medium">
                      {flight.flightNumber}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-[#1F2937]">
                          {airlineInfo.name}
                        </span>
                        {airlineInfo.code !== "N/A" && (
                          <span className="rounded-[4px] bg-[#E5E7EB] text-[#1F2937] font-inter text-[12px] px-2.5 py-1.5 font-medium relative left-1">
                            {airlineInfo.code}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-[#6B7280]">
                      {routeStr}
                    </TableCell>
                    <TableCell className="text-[#6B7280]">
                      {flight.cancellationDate || "N/A"}
                    </TableCell>
                    <TableCell className="text-[#1F2937]">
                      {passengersCount}
                    </TableCell>
                    <TableCell className="text-[#6B7280] relative -left-0.5">
                      ${costAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className={flight.totalPlatformFee !== undefined && flight.totalPlatformFee !== null ? "!text-[#10B981] font-semibold" : "text-[#6B7280]"}>
                      {revenueDisplay}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={flight.status} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <Pagination
        totalResults={pagination.totalCount}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        resultsPerPage={resultsPerPage}
        setResultsPerPage={(limit) => {
          setResultsPerPage(limit);
          setCurrentPage(1);
        }}
        totalPages={totalPages}
      />
    </div>
  );
}
