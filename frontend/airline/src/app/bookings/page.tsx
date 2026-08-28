"use client";

import { useState, useMemo, useEffect } from "react";
import { X, Eye, Download, Mail, CalendarCheck, Users, DollarSign } from "lucide-react";
import { toast } from "react-toastify";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  SortHeader,
} from "@/src/components/ui/table";
import { FiltersCard } from "@/src/components/ui/FiltersCard";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { Pagination } from "@/src/components/ui/pagination";
import BookingDetail from "./BookingDetail";

export interface Booking {
  id: string;
  flight: string;
  airport: string; // Kept for selector dropdown filtering
  departure: string;
  hotel: string;
  contactEmail: string;
  passengers: number;
  rooms: number;
  totalCost: number;
  reason?: string;
}

const INITIAL_BOOKINGS: Booking[] = [
  {
    id: "BK-9021",
    flight: "AA-204",
    airport: "JFK",
    departure: "LAX",
    hotel: "Hilton New York JFK Airport",
    contactEmail: "sophia.m@example.com",
    passengers: 2,
    rooms: 1,
    totalCost: 220,
    reason: "Severe weather conditions (snow storm)"
  },
  {
    id: "BK-9022",
    flight: "UA-883",
    airport: "ORD",
    departure: "SFO",
    hotel: "Sheraton Chicago O'Hare Airport",
    contactEmail: "l.henderson@example.com",
    passengers: 4,
    rooms: 2,
    totalCost: 180,
    reason: "Technical maintenance issue"
  },
  {
    id: "BK-9023",
    flight: "SQ-012",
    airport: "LHR",
    departure: "SIN",
    hotel: "Renaissance London Heathrow Hotel",
    contactEmail: "olivia.c@example.com",
    passengers: 3,
    rooms: 1,
    totalCost: 340,
    reason: "Air Traffic Control crew shortage"
  },
  {
    id: "BK-9024",
    flight: "LH-430",
    airport: "JFK",
    departure: "FRA",
    hotel: "Courtyard by Marriott Queens",
    contactEmail: "jackson.v@example.com",
    passengers: 1,
    rooms: 1,
    totalCost: 260,
    reason: "Late incoming aircraft delay"
  },
  {
    id: "BK-9025",
    flight: "EK-201",
    airport: "LHR",
    departure: "DXB",
    hotel: "Sofitel London Heathrow",
    contactEmail: "emma.r@example.com",
    passengers: 1,
    rooms: 1,
    totalCost: 186.5,
    reason: "Aircraft engine sensor malfunction"
  }
];

const FLIGHT_OPTIONS = [
  { value: "All Flights", label: "All Flights" },
  { value: "AA-204", label: "AA-204" },
  { value: "UA-883", label: "UA-883" },
  { value: "SQ-012", label: "SQ-012" },
  { value: "LH-430", label: "LH-430" },
  { value: "EK-201", label: "EK-201" },
];

const AIRPORT_OPTIONS = [
  { value: "All Airports", label: "All Airports" },
  { value: "JFK", label: "JFK" },
  { value: "ORD", label: "ORD" },
  { value: "LHR", label: "LHR" },
];

export default function BookingsPage() {
  const [bookings] = useState<Booking[]>(INITIAL_BOOKINGS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFlight, setSelectedFlight] = useState("All Flights");
  const [selectedAirport, setSelectedAirport] = useState("All Airports");

  // Sorting
  const [sortField, setSortField] = useState<keyof Booking | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(10);

  // Modals
  const [detailBooking, setDetailBooking] = useState<Booking | null>(null);

  // Sort function
  const handleSort = (field: keyof Booking) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  // Action handlers
  const handleDownloadReceipt = (bookingId: string) => {
    toast.success("Receipt downloaded");
  };

  const handleSendEmail = (bookingId: string) => {
    toast.success("Email sent successfully");
  };

  // Clear filters
  const handleClearAll = () => {
    setSearchQuery("");
    setSelectedFlight("All Flights");
    setSelectedAirport("All Airports");
    setSortField(null);
    setSortOrder("asc");
    setCurrentPage(1);
  };

  // Filtering Logic
  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      const matchesSearch =
        searchQuery === "" ||
        b.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.contactEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.hotel.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFlight =
        selectedFlight === "All Flights" || b.flight === selectedFlight;

      const matchesAirport =
        selectedAirport === "All Airports" || b.airport === selectedAirport;

      return matchesSearch && matchesFlight && matchesAirport;
    });
  }, [bookings, searchQuery, selectedFlight, selectedAirport]);

  // Computed Stats
  const stats = useMemo(() => {
    const totalBookings = filteredBookings.length;
    const totalPassengers = filteredBookings.reduce((sum, b) => sum + b.passengers, 0);
    const totalCost = filteredBookings.reduce((sum, b) => sum + b.totalCost, 0);
    return { totalBookings, totalPassengers, totalCost };
  }, [filteredBookings]);

  // Sorting Logic
  const sortedBookings = useMemo(() => {
    if (!sortField) return filteredBookings;
    return [...filteredBookings].sort((a, b) => {
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
  }, [filteredBookings, sortField, sortOrder]);

  // Pagination Logic
  const paginatedBookings = useMemo(() => {
    const startIndex = (currentPage - 1) * resultsPerPage;
    return sortedBookings.slice(startIndex, startIndex + resultsPerPage);
  }, [sortedBookings, currentPage, resultsPerPage]);

  const totalPages = Math.ceil(sortedBookings.length / resultsPerPage) || 1;

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      {detailBooking ? (
        <BookingDetail booking={detailBooking} onClose={() => setDetailBooking(null)} />
      ) : (
        <div className="space-y-7">
          {/* Header Block */}
        <div>
          <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%]">
            Bookings
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            Confirmed hotel bookings from cancelled flights
          </p>
        </div>

        {/* 3 KPI Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Total Bookings */}
          <div className="w-full px-4 py-4 leading-[100%] tracking-[0%] bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-4 hover:shadow-md transition-shadow">
            <div className="self-stretch flex flex-col justify-start items-start gap-2">
              <div className="self-stretch inline-flex justify-between items-start gap-5 relative -left-0.5">
                <div className="flex-1 inline-flex flex-col justify-start items-start gap-1.5">
                  <div className="self-stretch justify-start text-gray-500 text-base font-normal font-figtree leading-[100%] tracking-[0%]">
                    Total Bookings
                  </div>
                  <div className="inline-flex justify-start items-center gap-1.5">
                    <div className="justify-start text-gray-800 text-2xl font-semibold font-figtree">
                      {stats.totalBookings}
                    </div>
                  </div>
                </div>
                <div className="size-11 p-2.5 bg-gray-100 rounded-lg flex justify-center items-center shrink-0">
                  <CalendarCheck className="h-5.5 w-6 text-blue-950 stroke-[1.8]" />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Total Passengers */}
          <div className="w-full px-4 py-4 leading-[100%] tracking-[0%] bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-4 hover:shadow-md transition-shadow">
            <div className="self-stretch flex flex-col justify-start items-start gap-2">
              <div className="self-stretch inline-flex justify-between items-start gap-5 relative -left-0.5">
                <div className="flex-1 inline-flex flex-col justify-start items-start gap-1.5">
                  <div className="self-stretch justify-start text-gray-500 text-base font-normal font-figtree leading-[100%] tracking-[0%]">
                    Total Passengers
                  </div>
                  <div className="inline-flex justify-start items-center gap-1.5">
                    <div className="justify-start text-gray-800 text-2xl font-semibold font-figtree">
                      {stats.totalPassengers}
                    </div>
                  </div>
                </div>
                <div className="size-11 p-2.5 bg-gray-100 rounded-lg flex justify-center items-center shrink-0">
                  <Users className="h-5.5 w-6 text-blue-950 stroke-[1.8]" />
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Total Cost */}
          <div className="w-full px-4 py-4 leading-[100%] tracking-[0%] bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-4 hover:shadow-md transition-shadow">
            <div className="self-stretch flex flex-col justify-start items-start gap-2">
              <div className="self-stretch inline-flex justify-between items-start gap-5 relative -left-0.5">
                <div className="flex-1 inline-flex flex-col justify-start items-start gap-1.5">
                  <div className="self-stretch justify-start text-gray-500 text-base font-normal font-figtree leading-[100%] tracking-[0%]">
                    Total Cost
                  </div>
                  <div className="inline-flex justify-start items-center gap-1.5">
                    <div className="justify-start text-gray-800 text-2xl font-semibold font-figtree">
                      ${stats.totalCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
                <div className="size-11 p-2.5 bg-gray-100 rounded-lg flex justify-center items-center shrink-0">
                  <DollarSign className="h-5.5 w-6 text-blue-950 stroke-[1.8]" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters Card */}
        <FiltersCard
          searchQuery={searchQuery}
          setSearchQuery={(q) => {
            setSearchQuery(q);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search by Booking ID, contact email, or hotel..."
          onClearFilters={handleClearAll}
        >
          {/* Flight dropdown */}
          <Dropdown
            value={selectedFlight}
            onChange={(val) => {
              setSelectedFlight(val);
              setCurrentPage(1);
            }}
            options={FLIGHT_OPTIONS}
            widthClass="w-44"
            triggerWidthClass="w-[180px]"
          />

          {/* Airport dropdown */}
          <Dropdown
            value={selectedAirport}
            onChange={(val) => {
              setSelectedAirport(val);
              setCurrentPage(1);
            }}
            options={AIRPORT_OPTIONS}
            widthClass="w-44"
            triggerWidthClass="w-[180px]"
          />
        </FiltersCard>

        {/* Bookings Table */}
        <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white mb-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[135px]">
                  <SortHeader
                    label="Booking ID"
                    field="id"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[110px]">
                  <SortHeader
                    label="Flight"
                    field="flight"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[130px]">
                  <SortHeader
                    label="Departure"
                    field="departure"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[180px]">
                  <SortHeader
                    label="Hotel"
                    field="hotel"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[180px]">
                  <SortHeader
                    label="Contact Email"
                    field="contactEmail"
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
                <TableHead className="min-w-[100px]">
                  <SortHeader
                    label="Rooms"
                    field="rooms"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[120px]">
                  <SortHeader
                    label="Total Cost"
                    field="totalCost"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedBookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="px-6 py-12 text-center text-gray-500 font-figtree">
                    No bookings found.
                  </TableCell>
                </TableRow>
              ) : (
                paginatedBookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell>
                      {b.id}
                    </TableCell>
                    <TableCell>
                      {b.flight}
                    </TableCell>
                    <TableCell>
                      {b.departure}
                    </TableCell>
                    <TableCell className="text-left">
                      {b.hotel}
                    </TableCell>
                    <TableCell>
                      {b.contactEmail}
                    </TableCell>
                    <TableCell>
                      {b.passengers}
                    </TableCell>
                    <TableCell>
                      {b.rooms}
                    </TableCell>
                    <TableCell>
                      ${b.totalCost.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-start gap-1 -translate-x-1">
                        <button
                          onClick={() => setDetailBooking(b)}
                          className="p-1 text-[#6B7280] hover:text-[#0F2757] transition-colors cursor-pointer"
                          title="View"
                        >
                          <Eye className="h-[20px] w-[20px]" />
                        </button>
                        <button
                          onClick={() => handleDownloadReceipt(b.id)}
                          className="p-1 text-[#6B7280] hover:text-emerald-600 transition-colors cursor-pointer"
                          title="Download"
                        >
                          <Download className="h-[20px] w-[20px]" />
                        </button>
                        <button
                          onClick={() => handleSendEmail(b.id)}
                          className="p-1 text-[#6B7280] hover:text-blue-600 transition-colors cursor-pointer"
                          title="Confirmation email sent"
                        >
                          <Mail className="h-[20px] w-[20px]" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination footer */}
        <Pagination
          totalResults={sortedBookings.length}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          resultsPerPage={resultsPerPage}
          setResultsPerPage={setResultsPerPage}
          totalPages={totalPages}
        />
        </div>
      )}
    </div>
  );
}
