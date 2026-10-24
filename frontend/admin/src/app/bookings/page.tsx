"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Eye,
  DollarSign,
  Hotel,
  TrendingUp,
} from "lucide-react";
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
import { TableEmptyState } from "@/src/components/ui/EmptyState";
import { FiltersCard } from "@/src/components/ui/FiltersCard";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { DatePicker } from "@/src/components/ui/DatePicker";
import { TruncatedTooltip } from "@/src/components/ui/TruncatedTooltip";
import { BookingDetailModal } from "@/src/components/bookings/BookingDetailModal";

export interface AdminBookingItem {
  id: string;
  bookingId: string;
  airlineId: number;
  airlineName: string;
  vendor: string;
  departure: string;
  hotel: string;
  passengers: number;
  rooms: number;
  totalCost: number;
  earnings: number;
  status: string;
  hotelCost?: number;
  hotelTax?: number;
  platformFee?: number;
  hotelCommission?: number;
  discount?: number;
  flightId?: number | string;
  flightNumber?: string;
  arrival?: string;
  scheduled?: string;
  requestId?: string;
  vendorBookingStatus?: string;
  vendorReference?: string;
  transferReference?: string;
  completedAt?: string;
  failedAt?: string;
  failureReason?: string;
}

const DUMMY_BOOKINGS: AdminBookingItem[] = [
  {
    id: "1",
    bookingId: "BK-10001",
    airlineId: 1,
    airlineName: "SkyLine Airways",
    vendor: "Booking.com",
    departure: "JFK",
    hotel: "Hyatt Place JFK",
    passengers: 29,
    rooms: 15,
    hotelCost: 1710.0,
    hotelTax: 205.0,
    platformFee: 86.0,
    hotelCommission: 137.0,
    discount: 86.0,
    totalCost: 1915.0,
    earnings: 223.0,
    status: "Pending",
    flightId: 1,
    flightNumber: "SKY1234",
    arrival: "LAX",
    scheduled: "2/1/2025, 5:30:00 AM",
    requestId: "444dd18c-1e5c-4d3a-a2c5-36229b869e60",
    vendorBookingStatus: "ON_REQUEST",
    vendorReference: "B00-2663671",
    transferReference: "61945ffd-0051-4521-a66c-d2f2ce8f6925",
    completedAt: "—",
    failedAt: "—",
    failureReason: "—",
  },
  {
    id: "2",
    bookingId: "BK-10002",
    airlineId: 1,
    airlineName: "SkyLine Airways",
    vendor: "Booking.com",
    departure: "JFK",
    hotel: "Radisson Blu JFK",
    passengers: 39,
    rooms: 39,
    totalCost: 10735.0,
    earnings: 1246.0,
    status: "Pending",
  },
  {
    id: "3",
    bookingId: "BK-10003",
    airlineId: 2,
    airlineName: "Global Air",
    vendor: "Hotels.com",
    departure: "LAX",
    hotel: "Marriott Los Angeles",
    passengers: 54,
    rooms: 27,
    totalCost: 8420.5,
    earnings: 920.0,
    status: "Confirmed",
  },
  {
    id: "4",
    bookingId: "BK-10004",
    airlineId: 3,
    airlineName: "Delta Express",
    vendor: "Expedia",
    departure: "ORD",
    hotel: "Hilton Chicago O'Hare",
    passengers: 18,
    rooms: 9,
    totalCost: 3240.0,
    earnings: 380.5,
    status: "Confirmed",
  },
  {
    id: "5",
    bookingId: "BK-10005",
    airlineId: 2,
    airlineName: "Global Air",
    vendor: "Booking.com",
    departure: "MIA",
    hotel: "InterContinental Miami",
    passengers: 62,
    rooms: 31,
    totalCost: 14880.0,
    earnings: 1750.0,
    status: "Completed",
  },
  {
    id: "6",
    bookingId: "BK-10006",
    airlineId: 4,
    airlineName: "Pacific Jet",
    vendor: "Agoda",
    departure: "SFO",
    hotel: "W San Francisco",
    passengers: 11,
    rooms: 6,
    totalCost: 2900.0,
    earnings: 310.0,
    status: "Cancelled",
  },
  {
    id: "7",
    bookingId: "BK-10007",
    airlineId: 3,
    airlineName: "Delta Express",
    vendor: "Hotels.com",
    departure: "ATL",
    hotel: "Westin Peachtree Atlanta",
    passengers: 45,
    rooms: 23,
    totalCost: 7650.0,
    earnings: 865.0,
    status: "Confirmed",
  },
  {
    id: "8",
    bookingId: "BK-10008",
    airlineId: 1,
    airlineName: "SkyLine Airways",
    vendor: "Expedia",
    departure: "DFW",
    hotel: "Hyatt Regency Dallas",
    passengers: 33,
    rooms: 17,
    totalCost: 5610.0,
    earnings: 640.0,
    status: "Pending",
  },
  {
    id: "9",
    bookingId: "BK-10009",
    airlineId: 5,
    airlineName: "Sunrise Airlines",
    vendor: "Booking.com",
    departure: "SEA",
    hotel: "Sheraton Seattle Hotel",
    passengers: 27,
    rooms: 14,
    totalCost: 4480.0,
    earnings: 510.0,
    status: "Completed",
  },
  {
    id: "10",
    bookingId: "BK-10010",
    airlineId: 4,
    airlineName: "Pacific Jet",
    vendor: "Agoda",
    departure: "DEN",
    hotel: "Grand Hyatt Denver",
    passengers: 50,
    rooms: 25,
    totalCost: 11250.0,
    earnings: 1300.0,
    status: "Confirmed",
  },
  {
    id: "11",
    bookingId: "BK-10011",
    airlineId: 5,
    airlineName: "Sunrise Airlines",
    vendor: "Hotels.com",
    departure: "BOS",
    hotel: "Marriott Long Wharf Boston",
    passengers: 22,
    rooms: 11,
    totalCost: 3960.0,
    earnings: 440.0,
    status: "Pending",
  },
  {
    id: "12",
    bookingId: "BK-10012",
    airlineId: 2,
    airlineName: "Global Air",
    vendor: "Expedia",
    departure: "PHX",
    hotel: "JW Marriott Phoenix",
    passengers: 36,
    rooms: 18,
    totalCost: 6120.0,
    earnings: 700.0,
    status: "Cancelled",
  },
];

const AIRLINE_OPTIONS = [
  { value: "All Airlines", label: "All Airlines" },
  { value: "SkyLine Airways", label: "SkyLine Airways" },
  { value: "Global Air", label: "Global Air" },
  { value: "Delta Express", label: "Delta Express" },
  { value: "Pacific Jet", label: "Pacific Jet" },
  { value: "Sunrise Airlines", label: "Sunrise Airlines" },
];

const VENDOR_OPTIONS = [
  { value: "All Vendors", label: "All Vendors" },
  { value: "Booking.com", label: "Booking.com" },
  { value: "Hotels.com", label: "Hotels.com" },
  { value: "Expedia", label: "Expedia" },
  { value: "Agoda", label: "Agoda" },
];

const STATUS_OPTIONS = [
  { value: "All Status", label: "All Status" },
  { value: "Pending", label: "Pending" },
  { value: "Confirmed", label: "Confirmed" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
];

const RESULTS_PER_PAGE_OPTIONS = [10, 20, 50];

export default function BookingsPage() {
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAirline, setSelectedAirline] = useState("All Airlines");
  const [selectedVendor, setSelectedVendor] = useState("All Vendors");
  const [selectedStatus, setSelectedStatus] = useState("All Statuses");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination states
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Sorting states
  const [sortField, setSortField] = useState<keyof AdminBookingItem | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Selected booking for View modal
  const [selectedBooking, setSelectedBooking] = useState<AdminBookingItem | null>(null);

  // Filter the dummy data
  const filtered = useMemo(() => {
    return DUMMY_BOOKINGS.filter((b) => {
      const q = searchQuery.toLowerCase();
      const matchesSearch =
        !q ||
        b.bookingId.toLowerCase().includes(q) ||
        b.hotel.toLowerCase().includes(q) ||
        b.airlineName.toLowerCase().includes(q) ||
        b.vendor.toLowerCase().includes(q) ||
        b.departure.toLowerCase().includes(q);
      const matchesAirline =
        selectedAirline === "All Airlines" || b.airlineName === selectedAirline;
      const matchesVendor =
        selectedVendor === "All Vendors" || b.vendor === selectedVendor;
      const matchesStatus =
        selectedStatus === "All Statuses" || b.status === selectedStatus;
      return matchesSearch && matchesAirline && matchesVendor && matchesStatus;
    });
  }, [searchQuery, selectedAirline, selectedVendor, selectedStatus]);

  const sorted = useMemo(
    () => sortData(filtered, sortField, sortOrder, []),
    [filtered, sortField, sortOrder]
  );

  const totalResults = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / resultsPerPage));
  const paginated = sorted.slice(
    (currentPage - 1) * resultsPerPage,
    currentPage * resultsPerPage
  );

  // KPI summary computed from filtered set
  const totalPaymentsByAirlines = filtered.reduce((s, b) => s + b.totalCost, 0);
  const totalPaidToHotels = filtered.reduce(
    (s, b) => s + (b.totalCost - b.earnings),
    0
  );
  const totalEarnings = filtered.reduce((s, b) => s + b.earnings, 0);

  const handleClearAll = () => {
    setSearchQuery("");
    setSelectedAirline("All Airlines");
    setSelectedVendor("All Vendors");
    setSelectedStatus("All Statuses");
    setStartDate("");
    setEndDate("");
    setSortField(null);
    setSortOrder("asc");
    setCurrentPage(1);
  };

  const handleSort = (field: keyof AdminBookingItem) => {
    if (sortField === field) {
      if (sortOrder === "asc") setSortOrder("desc");
      else setSortField(null);
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const fmt = (n: number) =>
    `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      <div className="space-y-7">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%]">
            Bookings
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            Hotel bookings made for disrupted passengers across airlines
          </p>
        </div>

        {/* Filters */}
        <FiltersCard
          searchQuery={searchQuery}
          setSearchQuery={(q) => {
            setSearchQuery(q);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search by booking ID or hotel name..."
          onClearFilters={handleClearAll}
        >
          {/* Airline Dropdown */}
          <Dropdown
            value={selectedAirline}
            onChange={(val) => {
              setSelectedAirline(val);
              setCurrentPage(1);
            }}
            options={AIRLINE_OPTIONS}
            widthClass="w-80 max-w-[calc(100vw-2rem)]"
            triggerWidthClass="w-[180px]"
            maxListHeightClass="max-h-60"
            searchable
          />

          {/* Vendor Dropdown */}
          <Dropdown
            value={selectedVendor}
            onChange={(val) => {
              setSelectedVendor(val);
              setCurrentPage(1);
            }}
            options={VENDOR_OPTIONS}
            widthClass="w-44"
            triggerWidthClass="w-[150px]"
            maxListHeightClass="max-h-60"
          />

          {/* Status Dropdown */}
          <Dropdown
            value={selectedStatus}
            onChange={(val) => {
              setSelectedStatus(val);
              setCurrentPage(1);
            }}
            options={STATUS_OPTIONS}
            widthClass="w-44"
            triggerWidthClass="w-[140px]"
          />

          {/* Divider */}
          <div className="hidden sm:block h-11 w-[2px] bg-[#E5E7EB] mx-1.5" />

          {/* Date controls */}
          <DatePicker
            value={startDate}
            onChange={(val) => {
              setStartDate(val);
              setCurrentPage(1);
            }}
            placeholder="Start Date"
          />
          <DatePicker
            value={endDate}
            onChange={(val) => {
              setEndDate(val);
              setCurrentPage(1);
            }}
            placeholder="End Date"
          />
        </FiltersCard>

        {/* 3 KPI Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1 */}
          <div className="flex items-start justify-between rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-4 hover:shadow-sm transition-shadow">
            <div className="flex flex-col gap-1.5">
              <p className="text-base text-[#6B7280]">Total Payments by Airlines</p>
              <h3 className="text-2xl font-semibold text-[#1F2937]">
                {fmt(totalPaymentsByAirlines)}
              </h3>
            </div>
            <div className="rounded-[8px] bg-[#F3F4F6] p-2.5 text-[#0F2757] flex items-center justify-center h-11 w-11 shrink-0">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>

          {/* Card 2 */}
          <div className="flex items-start justify-between rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-4 hover:shadow-sm transition-shadow">
            <div className="flex flex-col gap-1.5">
              <p className="text-base text-[#6B7280]">Total Paid to Hotels</p>
              <h3 className="text-2xl font-semibold text-[#1F2937]">
                {fmt(totalPaidToHotels)}
              </h3>
            </div>
            <div className="rounded-[8px] bg-[#F3F4F6] p-2.5 text-[#0F2757] flex items-center justify-center h-11 w-11 shrink-0">
              <Hotel className="h-5 w-5" />
            </div>
          </div>

          {/* Card 3 */}
          <div className="flex items-start justify-between rounded-[12px] border border-[#E5E7EB] bg-white px-4 py-4 hover:shadow-sm transition-shadow">
            <div className="flex flex-col gap-1.5">
              <p className="text-base text-[#6B7280]">Total Earnings</p>
              <h3 className="text-2xl font-semibold text-[#1F2937]">
                {fmt(totalEarnings)}
              </h3>
            </div>
            <div className="rounded-[8px] bg-[#F3F4F6] p-2.5 text-[#0F2757] flex items-center justify-center h-11 w-11 shrink-0">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Bookings Table */}
        <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[120px]">
                  <SortHeader label="Booking ID" field="bookingId" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </TableHead>
                <TableHead className="min-w-[90px]">
                  <SortHeader label="Airline ID" field="airlineId" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </TableHead>
                <TableHead className="min-w-[160px]">
                  <SortHeader label="Airline" field="airlineName" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </TableHead>
                <TableHead className="min-w-[130px]">
                  <SortHeader label="Vendor" field="vendor" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </TableHead>
                <TableHead className="min-w-[110px]">
                  <SortHeader label="Departure" field="departure" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </TableHead>
                <TableHead className="min-w-[180px]">
                  <SortHeader label="Hotel" field="hotel" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </TableHead>
                <TableHead className="min-w-[110px]">
                  <SortHeader label="Passengers" field="passengers" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </TableHead>
                <TableHead className="min-w-[90px]">
                  <SortHeader label="Rooms" field="rooms" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </TableHead>
                <TableHead className="min-w-[120px]">
                  <SortHeader label="Total Cost" field="totalCost" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </TableHead>
                <TableHead className="min-w-[110px]">
                  <SortHeader label="Earnings" field="earnings" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </TableHead>
                <TableHead className="min-w-[120px]">
                  <SortHeader label="Status" field="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </TableHead>
                <TableHead className="min-w-[80px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.length === 0 ? (
                <TableEmptyState
                  colSpan={12}
                  icon={Search}
                  title="No bookings found"
                  message="Try adjusting your filters or search query."
                />
              ) : (
                paginated.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium text-[#1F2937]">
                      {b.bookingId}
                    </TableCell>
                    <TableCell className="text-[#6B7280]">
                      {b.airlineId}
                    </TableCell>
                    <TableCell className="font-medium text-[#1F2937]">
                      {b.airlineName}
                    </TableCell>
                    <TableCell className="text-[#6B7280]">
                      {b.vendor}
                    </TableCell>
                    <TableCell className="text-[#6B7280]">
                      {b.departure}
                    </TableCell>
                    <TableCell>
                      <TruncatedTooltip text={b.hotel} side="top">
                        <div className="max-w-[160px] truncate cursor-default text-[#6B7280]">
                          {b.hotel}
                        </div>
                      </TruncatedTooltip>
                    </TableCell>
                    <TableCell className="text-[#1F2937]">
                      {b.passengers}
                    </TableCell>
                    <TableCell className="text-[#1F2937]">
                      {b.rooms}
                    </TableCell>
                    <TableCell className="text-[#6B7280]">
                      {fmt(b.totalCost)}
                    </TableCell>
                    <TableCell className="text-green-600">
                      {fmt(b.earnings)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={b.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-start gap-1">
                        <button
                          onClick={() => setSelectedBooking(b)}
                          className="p-1 text-[#6B7280] hover:text-[#0F2757] transition-colors cursor-pointer"
                          title="View"
                        >
                          <Eye className="h-[20px] w-[20px]" />
                        </button>
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
          setResultsPerPage={(size) => {
            setResultsPerPage(size);
            setCurrentPage(1);
          }}
          totalPages={totalPages}
        />
      </div>

      {/* Booking Detail Modal */}
      <BookingDetailModal
        isOpen={!!selectedBooking}
        onClose={() => setSelectedBooking(null)}
        booking={selectedBooking}
      />
    </div>
  );
}
