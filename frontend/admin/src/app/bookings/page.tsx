"use client";

import { useState, useMemo, useEffect } from "react";
import { toast } from "react-toastify";
import {
  Search,
  Eye,
  DollarSign,
  Hotel,
  TrendingUp,
  Loader2,
  BedDouble,
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
import { formatUtcEndDate, formatUtcStartDate, sortData } from "@/src/lib/utils";
import {
  adminHotelBookingsService,
  AdminHotelBookingDTO,
  AdminHotelBookingsSummaryDTO,
  HotelProviderDTO,
} from "@/src/services/hotel-bookings.service";
import { airlinesService } from "@/src/services/airlines.service";
import type { AirlineListItemDTO } from "@/src/services/airlines.service";
import { TableEmptyState } from "@/src/components/ui/EmptyState";
import { FiltersCard } from "@/src/components/ui/FiltersCard";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { DatePicker } from "@/src/components/ui/DatePicker";
import { TruncatedTooltip } from "@/src/components/ui/TruncatedTooltip";
import { BookingDetailModal } from "@/src/components/bookings/BookingDetailModal";
import { StatCard } from "@/src/components/ui/StatCard";

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
  /** What the supplier charges the platform. */
  buyingPrice?: number;
  flightId?: number | string;
  flightNumber?: string;
  arrival?: string;
  scheduled?: string;
  requestId?: string;
  vendorBookingStatus?: string;
  vendorReference?: string;
  transferReference?: string;
  completedAt?: string;
  /** When the hotel booking was created (ISO 8601, UTC); sorts correctly as text. */
  createdAt?: string;
  failedAt?: string;
  failureReason?: string;
}

/** e.g. "Oct 25, 2026, 10:15 AM" in the viewer's local time; "—" when missing. */
function formatCreatedAt(iso?: string): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
}

/** API booking → the row shape the table and BookingDetailModal use. */
function toAdminBookingItem(dto: AdminHotelBookingDTO): AdminBookingItem {
  return {
    id: String(dto.id),
    bookingId: String(dto.id),
    airlineId: dto.airline.id,
    airlineName: dto.airline.name,
    vendor: dto.provider?.name ?? "—",
    departure: dto.destinationAirport.code,
    hotel: dto.hotel.name,
    passengers: dto.passengers.adults + dto.passengers.children,
    rooms: dto.rooms,
    totalCost: dto.pricing.totalCost,
    earnings: dto.pricing.totalEarning,
    status: dto.status,
    hotelCost: dto.pricing.hotelCost,
    hotelTax: dto.pricing.tax,
    platformFee: dto.pricing.platformFee,
    hotelCommission: dto.pricing.supplierMargin,
    discount: dto.pricing.discount,
    buyingPrice: dto.pricing.buyingPrice,
    createdAt: dto.createdAt,
  };
}

// Hotel booking statuses the API filters by (GET /hotel-bookings, platform users).
const STATUS_OPTIONS = [
  { value: "All Statuses", label: "All Statuses" },
  { value: "confirmed", label: "Confirmed" },
  { value: "in_progress", label: "In Progress" },
  { value: "manual_check", label: "Manual Check" },
];

const RESULTS_PER_PAGE_OPTIONS = [10, 20, 50];

export default function BookingsPage() {
  // Filter states ("All …" = no filter; otherwise the airline / provider id)
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAirline, setSelectedAirline] = useState("All Airlines");
  const [selectedVendor, setSelectedVendor] = useState("All Vendors");
  const [selectedStatus, setSelectedStatus] = useState("All Statuses");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination states (server-side)
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Sorting states (sorts the loaded page)
  const [sortField, setSortField] = useState<keyof AdminBookingItem | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Selected booking for View modal
  const [selectedBooking, setSelectedBooking] = useState<AdminBookingItem | null>(null);

  const [bookings, setBookings] = useState<AdminBookingItem[]>([]);
  // Card totals: confirmed bookings matching the same filters (GET /hotel-bookings/summary).
  const [summary, setSummary] = useState<AdminHotelBookingsSummaryDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [airlines, setAirlines] = useState<AirlineListItemDTO[]>([]);
  const [providers, setProviders] = useState<HotelProviderDTO[]>([]);

  // Filter options from the API
  useEffect(() => {
    airlinesService
      .getAirlines({ page: 1, limit: 100 })
      .then((res) => setAirlines(res.airlines || []))
      .catch((err) => console.error("Failed to load airlines for filter", err));
    adminHotelBookingsService
      .getHotelProviders()
      .then(setProviders)
      .catch((err) => console.error("Failed to load providers for filter", err));
  }, []);

  const airlineOptions = useMemo(
    () => [
      { value: "All Airlines", label: "All Airlines" },
      ...airlines.map((a) => ({ value: String(a.id), label: `${a.name} (${a.code})` })),
    ],
    [airlines],
  );

  const vendorOptions = useMemo(
    () => [
      { value: "All Vendors", label: "All Vendors" },
      ...providers.map((p) => ({
        value: String(p.id),
        label: p.isActive ? p.name : `${p.name} (inactive)`,
      })),
    ],
    [providers],
  );

  // Bookings: filters and pagination are applied by the API; search is debounced.
  useEffect(() => {
    let isMounted = true;
    const timeoutId = setTimeout(async () => {
      setIsLoading(true);
      try {
        const start = formatUtcStartDate(startDate);
        const end = formatUtcEndDate(endDate);
        if (start && end && new Date(start).getTime() >= new Date(end).getTime()) {
          if (isMounted) {
            setBookings([]);
            setTotalResults(0);
            setSummary(null);
          }
          return;
        }
        // The table and the cards use the same filters.
        const filters = {
          search: searchQuery.trim() || undefined,
          airlineId: selectedAirline !== "All Airlines" ? Number(selectedAirline) : undefined,
          providerId: selectedVendor !== "All Vendors" ? Number(selectedVendor) : undefined,
          status: selectedStatus !== "All Statuses" ? selectedStatus : undefined,
          startDate: start,
          endDate: end,
        };
        const [res, summaryRes] = await Promise.all([
          adminHotelBookingsService.getHotelBookings({
            ...filters,
            page: currentPage,
            limit: resultsPerPage,
          }),
          adminHotelBookingsService.getHotelBookingsSummary(filters),
        ]);
        if (isMounted) {
          setBookings(res.hotelBookings.map(toAdminBookingItem));
          setTotalResults(res.total);
          setSummary(summaryRes);
        }
      } catch (err: any) {
        if (isMounted) {
          toast.error(err.message || "Failed to load hotel bookings");
          setBookings([]);
          setTotalResults(0);
          setSummary(null);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }, 300);
    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [
    searchQuery,
    selectedAirline,
    selectedVendor,
    selectedStatus,
    startDate,
    endDate,
    currentPage,
    resultsPerPage,
  ]);

  const paginated = useMemo(
    () => sortData(bookings, sortField, sortOrder, []),
    [bookings, sortField, sortOrder]
  );
  const totalPages = Math.max(1, Math.ceil(totalResults / resultsPerPage));


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
            options={airlineOptions}
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
            options={vendorOptions}
            widthClass="w-80 max-w-[calc(100vw-2rem)]"
            triggerWidthClass="w-[150px]"
            maxListHeightClass="max-h-60"
            searchable
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

        {/* KPI cards: confirmed bookings matching the filters */}
        <div className="space-y-2">
          <p className="text-[13px] text-[#6B7280]">
            Totals of confirmed bookings matching the filters
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard
              title="Total Earnings"
              value={summary ? fmt(summary.totalEarnings) : "—"}
              hint={
                summary
                  ? `Fee ${fmt(summary.totalPlatformFee)} · Supplier margin ${fmt(summary.totalSupplierMargin)}`
                  : undefined
              }
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <StatCard
              title="Billed to Airlines"
              value={summary ? fmt(summary.totalCost) : "—"}
              hint={
                summary
                  ? `From ${summary.totalBookings.toLocaleString()} confirmed booking${summary.totalBookings === 1 ? "" : "s"}`
                  : undefined
              }
              icon={<DollarSign className="h-5 w-5" />}
            />
            <StatCard
              title="Paid to Hotels"
              value={summary ? fmt(summary.totalPaidToHotels) : "—"}
              hint="Supplier cost"
              icon={<Hotel className="h-5 w-5" />}
            />
            <StatCard
              title="Confirmed Bookings"
              value={summary ? summary.totalBookings.toLocaleString() : "—"}
              hint={
                summary
                  ? `${summary.totalRooms.toLocaleString()} room${summary.totalRooms === 1 ? "" : "s"} · ${summary.totalPassengers.toLocaleString()} passenger${summary.totalPassengers === 1 ? "" : "s"}`
                  : undefined
              }
              icon={<BedDouble className="h-5 w-5" />}
            />
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
                <TableHead className="min-w-[170px]">
                  <SortHeader label="Created" field="createdAt" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={12} className="py-12 text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-[#0F2757]" />
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
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
                    <TableCell className="text-[#6B7280] whitespace-nowrap">
                      {formatCreatedAt(b.createdAt)}
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
