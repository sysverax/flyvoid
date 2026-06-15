"use client";

import { useState, useMemo } from "react";
import { Search, Plane, Users, DollarSign, Calendar } from "lucide-react";
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
import { CancelledFlight } from "@/src/types/cancellation";
import { TableEmptyState } from "@/src/components/ui/EmptyState";
import { FiltersCard } from "@/src/components/ui/FiltersCard";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Dropdown } from "@/src/components/ui/Dropdown";

const INITIAL_FLIGHTS: CancelledFlight[] = [
  {
    id: "1",
    flightCode: "PA1234",
    airlineName: "Pacific Airways",
    airlineCode: "PA",
    route: "LAX → JFK",
    date: "01/02/2025",
    passengers: 189,
    cost: 245000,
    revenue: 1770,
    status: "Completed",
  },
  {
    id: "2",
    flightCode: "PA5678",
    airlineName: "Pacific Airways",
    airlineCode: "PA",
    route: "SFO → ORD",
    date: "12/02/2025",
    passengers: 150,
    cost: 180000,
    revenue: 1350,
    status: "Processing",
  },
  {
    id: "3",
    flightCode: "AA9012",
    airlineName: "Atlantic Airlines",
    airlineCode: "AA",
    route: "ATL → LGA",
    date: "20/02/2025",
    passengers: 120,
    cost: 130000,
    revenue: 980,
    status: "Completed",
  },
  {
    id: "4",
    flightCode: "WF3456",
    airlineName: "Western Flights",
    airlineCode: "WF",
    route: "MIA → DFW",
    date: "25/02/2025",
    passengers: 100,
    cost: 110000,
    revenue: 828,
    status: "Failed",
  },
  {
    id: "5",
    flightCode: "SW7890",
    airlineName: "Southern Wings",
    airlineCode: "SW",
    route: "FRA → JFK",
    date: "28/02/2025",
    passengers: 69,
    cost: 150000,
    revenue: 1260,
    status: "Pending",
  },
];

export default function CancellationPage() {
  const [flights] = useState<CancelledFlight[]>(INITIAL_FLIGHTS);

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
  const [sortField, setSortField] = useState<keyof CancelledFlight | null>(
    null,
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Get unique airlines list for dropdown
  const airlinesList = useMemo(() => {
    const unique = new Set(flights.map((f) => f.airlineName));
    return Array.from(unique).sort();
  }, [flights]);

  const statusOptions = [
    { value: "All Status", label: "All Status" },
    { value: "Pending", label: "Pending" },
    { value: "Processing", label: "Processing" },
    { value: "Completed", label: "Completed" },
    { value: "Failed", label: "Failed" },
  ];

  const airlineOptions = useMemo(() => {
    return [
      { value: "All Airlines", label: "All Airlines" },
      ...airlinesList.map((name) => {
        const flight = flights.find((f) => f.airlineName === name);
        const displayLabel = flight ? `${name} (${flight.airlineCode})` : name;
        return {
          value: name,
          label: displayLabel,
        };
      }),
    ];
  }, [airlinesList, flights]);

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

  const handleSort = (field: keyof CancelledFlight) => {
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

  // Filtration logic
  const filteredFlights = useMemo(() => {
    return flights.filter((flight) => {
      // 1. Search filter (flightCode, airlineName, route)
      const matchesSearch =
        flight.flightCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        flight.airlineName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        flight.route.toLowerCase().includes(searchQuery.toLowerCase());

      // 2. Status filter
      const matchesStatus =
        selectedStatus === "All Status" || flight.status === selectedStatus;

      // 3. Airline filter
      const matchesAirline =
        selectedAirline === "All Airlines" ||
        flight.airlineName === selectedAirline;

      // 4. Date range filter
      let matchesDate = true;
      if (startDate || endDate) {
        const parts = flight.date.split("/");
        const flightTime = new Date(
          Number(parts[2]),
          Number(parts[1]) - 1,
          Number(parts[0]),
        ).getTime();

        if (startDate) {
          const startLimit = new Date(startDate).getTime();
          if (flightTime < startLimit) matchesDate = false;
        }
        if (endDate) {
          const endLimit = new Date(endDate).getTime();
          // Add end date boundary check (include entire day by checking <= of date object)
          const adjustedEndLimit = new Date(endDate);
          adjustedEndLimit.setHours(23, 59, 59, 999);
          if (flightTime > adjustedEndLimit.getTime()) matchesDate = false;
        }
      }

      return matchesSearch && matchesStatus && matchesAirline && matchesDate;
    });
  }, [
    flights,
    searchQuery,
    selectedStatus,
    selectedAirline,
    startDate,
    endDate,
  ]);

  // Dynamic values for overview cards based on filtered dataset
  const totalCancellations = filteredFlights.length;

  const totalPassengers = useMemo(() => {
    return filteredFlights.reduce((sum, f) => sum + f.passengers, 0);
  }, [filteredFlights]);

  const platformRevenue = useMemo(() => {
    return filteredFlights.reduce((sum, f) => sum + f.revenue, 0);
  }, [filteredFlights]);

  // Apply sorting utility
  const sortedFlights = useMemo(() => {
    return sortData(filteredFlights, sortField, sortOrder, ["date"]);
  }, [filteredFlights, sortField, sortOrder]);

  // Pagination calculation
  const totalPages = Math.max(
    1,
    Math.ceil(sortedFlights.length / resultsPerPage),
  );

  const paginatedFlights = useMemo(() => {
    const startIndex = (currentPage - 1) * resultsPerPage;
    return sortedFlights.slice(startIndex, startIndex + resultsPerPage);
  }, [sortedFlights, currentPage, resultsPerPage]);

  const statsConfig = [
    {
      title: "Total Cancellations",
      value: totalCancellations,
      description: "Matching current filters",
      icon: <img src="/icons/plane.svg" alt="Plane" />,
    },
    {
      title: "Total Passengers",
      value: totalPassengers.toLocaleString(),
      description: "Across cancelled flights",
      icon: <Users className="h-5 w-5" />,
    },
    {
      title: "Platform Revenue",
      value: `$${platformRevenue.toLocaleString()}`,
      description: "5% of total cost",
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
            className="flex items-start justify-between rounded-[12px] border border-[#E5E7EB] bg-white p-3.5"
          >
            <div>
              <p className="text-[16px] text-[#6B7280]">{card.title}</p>
              <h3 className="text-[24px] font-semibold text-[#1F2937]">
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
          searchPlaceholder="Search airlines..."
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
            <div className="relative h-11 w-[160px]">
              <input
                type={startDate ? "date" : "text"}
                placeholder="Start Date"
                value={startDate}
                onFocus={(e) => (e.target.type = "date")}
                onBlur={(e) => {
                  if (!e.target.value) {
                    e.target.type = "text";
                  }
                }}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-11 w-full appearance-none rounded-[8px] border border-[#D1D5DB] bg-[#F3F4F6] py-3 pl-4 pr-10 text-gray-600 outline-none cursor-pointer hover:bg-slate-100/80 transition-colors text-[16px] custom-date-input"
              />
              <Calendar className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6B7280]" />
            </div>
            <div className="relative h-11 w-[160px] ml-1.5">
              <input
                type={endDate ? "date" : "text"}
                placeholder="End Date"
                value={endDate}
                onFocus={(e) => (e.target.type = "date")}
                onBlur={(e) => {
                  if (!e.target.value) {
                    e.target.type = "text";
                  }
                }}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-11 w-full appearance-none rounded-[8px] border border-[#D1D5DB] bg-[#F3F4F6] py-2 pl-4 pr-10 text-gray-600 outline-none cursor-pointer hover:bg-slate-100/80 transition-colors text-[16px] custom-date-input"
              />
              <Calendar className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6B7280]" />
            </div>
          </div>
        </FiltersCard>
      </div>

      {/* Flights Table */}
      <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white mb-5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[100px]">
                <SortHeader
                  label="Flight"
                  field="flightCode"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="min-w-[223px]">
                <SortHeader
                  label="Airline"
                  field="airlineName"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="min-w-[223px]">
                <SortHeader
                  label="Route"
                  field="route"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="min-w-[110px]">
                <SortHeader
                  label="Date"
                  field="date"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="min-w-[120px]">
                <SortHeader
                  label="Passengers"
                  field="passengers"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="min-w-[120px]">
                <SortHeader
                  label="Cost"
                  field="cost"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="min-w-[120px]">
                <SortHeader
                  label="Revenue"
                  field="revenue"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="min-w-[120px]">
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
            {paginatedFlights.length === 0 ? (
              <TableEmptyState
                colSpan={8}
                icon={Search}
                title="No flights found"
                message="Try adjusting your filters or search query."
              />
            ) : (
              paginatedFlights.map((flight) => (
                <TableRow key={flight.id}>
                  <TableCell className="font-mono text-[#1F2937] font-medium">
                    {flight.flightCode}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-[#1F2937]">
                        {flight.airlineName}
                      </span>
                      <span className="rounded-[4px] bg-[#E5E7EB] text-[#1F2937] font-inter text-[12px] px-2.5 py-1.5 font-medium">
                        {flight.airlineCode}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[#6B7280]">
                    {flight.route}
                  </TableCell>
                  <TableCell className="text-[#6B7280]">
                    {flight.date}
                  </TableCell>
                  <TableCell className="text-[#1F2937]">
                    {flight.passengers}
                  </TableCell>
                  <TableCell className="text-[#6B7280]">
                    ${flight.cost.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-[#10B981] font-semibold">
                    ${flight.revenue.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={flight.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <Pagination
        totalResults={filteredFlights.length}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        resultsPerPage={resultsPerPage}
        setResultsPerPage={setResultsPerPage}
        totalPages={totalPages}
      />
    </div>
  );
}
