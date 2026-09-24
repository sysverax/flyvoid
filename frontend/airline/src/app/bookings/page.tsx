"use client";

import { useState, useMemo, useEffect } from "react";
import { Search, Eye, Download, Mail, CalendarCheck, Users, DollarSign } from "lucide-react";
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
import { Pagination } from "@/src/components/ui/pagination";
import { sortData } from "@/src/lib/utils";
import { TableEmptyState } from "@/src/components/ui/EmptyState";
import { FiltersCard } from "@/src/components/ui/FiltersCard";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { TruncatedTooltip } from "@/src/components/ui/TruncatedTooltip";
import { BookingDetailsDrawer } from "@/src/components/ui/BookingDetailsDrawer";
import {
  hotelBookingsService,
  HotelBookingDTO,
  HotelBookingsSummaryDTO,
} from "@/src/services/hotel-bookings.service";
import { airportsService } from "@/src/services/airports.service";
import {
  cancellationService,
  ListCancelledFlightsItemDTO,
} from "@/src/services/cancellation.service";

export interface Booking {
  id: string;
  numericId: number;
  flight: string;
  airport: string;
  destinationName?: string;
  departure: string;
  hotel: string;
  contactEmail: string;
  passengers: number;
  rooms: number;
  totalCost: number;
  status: string;
  reason?: string;
  raw?: HotelBookingDTO;
}

function mapHotelBookingDTOToBooking(dto: HotelBookingDTO): Booking {
  const adults = Number(dto.passenger?.adults || 0);
  const children = Number(dto.passenger?.children || 0);
  return {
    id: String(dto.id),
    numericId: dto.id,
    flight: dto.flightNumber || "N/A",
    airport: dto.destinationAirport?.code || "N/A",
    destinationName: dto.destinationAirport?.name || "",
    departure: dto.destinationAirport?.code || "N/A",
    hotel: dto.hotelName || "N/A",
    contactEmail: dto.passenger?.email || "N/A",
    passengers: dto.passenger ? adults + children : 0,
    rooms: Number(dto.totalRooms || 1),
    totalCost: Number(dto.totalPrice || 0),
    status: dto.status,
    raw: dto,
  };
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [summaryData, setSummaryData] = useState<HotelBookingsSummaryDTO | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filters states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFlight, setSelectedFlight] = useState("All Cancelled Flights");
  const [selectedAirport, setSelectedAirport] = useState("All Airports");

  // Options states
  const [airportOptions, setAirportOptions] = useState<
    Array<{ value: string; label: string; id?: number }>
  >([{ value: "All Airports", label: "All Airports" }]);

  const [flightOptions, setFlightOptions] = useState<
    Array<{ value: string; label: string; cancelledFlightId?: number }>
  >([{ value: "All Cancelled Flights", label: "All Cancelled Flights" }]);

  // Pagination states
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Sorting states
  const [sortField, setSortField] = useState<keyof Booking | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Drawer modal states
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDrawerBooking, setSelectedDrawerBooking] = useState<Booking | null>(null);
  const [viewingId, setViewingId] = useState<number | string | null>(null);
  const [drawerDetailData, setDrawerDetailData] = useState<any>(null);
  const [sendingEmailId, setSendingEmailId] = useState<number | string | null>(null);

  // Load airport and cancelled flight options on mount
  useEffect(() => {
    let isMounted = true;

    airportsService
      .getAirports({ page: 1, limit: 200 })
      .then((res) => {
        if (!isMounted) return;
        const opts = res.airports.map((a) => ({
          value: a.iataCode,
          label: `${a.iataCode} - ${a.name}`,
          id: a.id,
        }));
        setAirportOptions([{ value: "All Airports", label: "All Airports" }, ...opts]);
      })
      .catch((err: any) => {
        console.error("Failed to load airports for filters:", err);
      });

    hotelBookingsService
      .getCancelledFlights({ page: 1, limit: 200 })
      .then((flights) => {
        if (!isMounted) return;
        const opts = flights.map((f: any) => ({
          value: f.flightNumber,
          label: f.flightNumber,
          cancelledFlightId: f.id,
        }));
        const uniqueMap = new Map<string, { value: string; label: string; cancelledFlightId?: number }>();
        opts.forEach((opt: any) => {
          if (!uniqueMap.has(opt.value)) {
            uniqueMap.set(opt.value, opt);
          }
        });
        setFlightOptions([
          { value: "All Cancelled Flights", label: "All Cancelled Flights" },
          ...Array.from(uniqueMap.values()),
        ]);
      })
      .catch((err: any) => {
        console.error("Failed to load cancelled flights for filters:", err);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  // Fetch hotel bookings with debounced effect matching airports page
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        let destinationAirportId: number | undefined = undefined;
        if (selectedAirport !== "All Airports") {
          const found = airportOptions.find((a) => a.value === selectedAirport);
          destinationAirportId = found?.id;
        }

        let cancelledFlightId: number | undefined = undefined;
        if (selectedFlight !== "All Cancelled Flights") {
          const found = flightOptions.find((f) => f.value === selectedFlight);
          cancelledFlightId = found?.cancelledFlightId;
        }

        const searchFilter = searchQuery.trim() || undefined;

        const [res, summaryRes] = await Promise.all([
          hotelBookingsService.getHotelBookings({
            search: searchFilter,
            destinationAirportId,
            cancelledFlightId,
            page: currentPage,
            limit: resultsPerPage,
          }),
          hotelBookingsService.getHotelBookingsSummary({
            search: searchFilter,
            destinationAirportId,
            cancelledFlightId,
          }),
        ]);

        if (isMounted) {
          const mapped = res.hotelBookings.map(mapHotelBookingDTOToBooking);
          setBookings(mapped);
          setTotalResults(res.total);
          setSummaryData(summaryRes);

          // Update flight options dynamically if new flights are received
          if (res.hotelBookings.length > 0) {
            setFlightOptions((prev) => {
              const map = new Map<string, { value: string; label: string; cancelledFlightId?: number }>();
              prev.forEach((opt) => map.set(opt.value, opt));
              let added = false;
              res.hotelBookings.forEach((b) => {
                if (b.flightNumber && !map.has(b.flightNumber)) {
                  map.set(b.flightNumber, {
                    value: b.flightNumber,
                    label: b.flightNumber,
                    cancelledFlightId: b.cancelledFlightId,
                  });
                  added = true;
                }
              });
              return added ? Array.from(map.values()) : prev;
            });
          }
        }
      } catch (err: any) {
        if (isMounted) {
          toast.error(err.message || "Failed to load hotel bookings");
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
  }, [searchQuery, selectedAirport, selectedFlight, currentPage, resultsPerPage]);

  // Sorting logic matching airports tab
  const sortedBookings = useMemo(() => {
    return sortData(bookings, sortField, sortOrder, []);
  }, [bookings, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(totalResults / resultsPerPage));

  const handleClearAll = () => {
    setSearchQuery("");
    setSelectedFlight("All Cancelled Flights");
    setSelectedAirport("All Airports");
    setSortField(null);
    setSortOrder("asc");
    setCurrentPage(1);
  };

  const handleSort = (field: keyof Booking) => {
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

  // Computed Stats from API summary data
  const stats = useMemo(() => {
    const totalBookings = summaryData ? summaryData.totalBookings : totalResults;
    const totalPassengers = summaryData ? summaryData.totalPassengers : 0;
    const totalCost = summaryData ? summaryData.totalCost : 0;
    return { totalBookings, totalPassengers, totalCost };
  }, [summaryData, totalResults]);

  const [exportingId, setExportingId] = useState<number | string | null>(null);

  // Action handlers
  const handleViewDetail = async (b: Booking) => {
    const targetId = b.numericId || b.id.replace(/\D/g, "");
    if (!targetId) {
      setSelectedDrawerBooking(b);
      setIsDrawerOpen(true);
      return;
    }
    setViewingId(targetId);
    try {
      const detail = await hotelBookingsService.getHotelBookingDetail(targetId);
      setDrawerDetailData(detail);
      setSelectedDrawerBooking(b);
      setIsDrawerOpen(true);
    } catch (err: any) {
      console.error("Failed to load booking detail:", err);
      setSelectedDrawerBooking(b);
      setIsDrawerOpen(true);
    } finally {
      setViewingId(null);
    }
  };

  const handleDownloadReceipt = async (b: Booking) => {
    const targetId = b.numericId || b.id.replace(/\D/g, "");
    if (!targetId) {
      toast.error("Invalid booking ID for export.");
      return;
    }
    setExportingId(targetId);
    try {
      await hotelBookingsService.exportHotelBooking(targetId);
      toast.success(`Booking CSV exported successfully.`);
    } catch (err: any) {
      toast.error(err.message || "Failed to export hotel booking CSV.");
    } finally {
      setExportingId(null);
    }
  };

  const handleSendEmail = async (b: Booking) => {
    const targetId = b.numericId || b.id.replace(/\D/g, "");
    if (!targetId) {
      toast.error("Invalid booking ID.");
      return;
    }
    setSendingEmailId(targetId);
    try {
      const res = await hotelBookingsService.sendHotelBookingEmail(targetId);
      toast.success(res?.message || "Hotel booking confirmation email sent successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to send hotel booking confirmation email.");
    } finally {
      setSendingEmailId(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
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

        {/* Filter panel card */}
        <FiltersCard
          searchQuery={searchQuery}
          setSearchQuery={(q) => {
            setSearchQuery(q);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search by Booking ID, flight number, hotel name, or email..."
          onClearFilters={handleClearAll}
        >
          {/* Flight dropdown */}
          <Dropdown
            value={selectedFlight}
            onChange={(val) => {
              setSelectedFlight(val);
              setCurrentPage(1);
            }}
            options={flightOptions}
            widthClass="w-52"
            triggerWidthClass="w-[195px]"
            maxListHeightClass="max-h-60"
            searchable
          />

          {/* Airport dropdown */}
          <Dropdown
            value={selectedAirport}
            onChange={(val) => {
              setSelectedAirport(val);
              setCurrentPage(1);
            }}
            options={airportOptions}
            widthClass="w-44"
            triggerWidthClass="w-[180px]"
            maxListHeightClass="max-h-60"
            searchable
          />
        </FiltersCard>

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
                      $
                      {stats.totalCost.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })}
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
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
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
                      <span>Loading bookings...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedBookings.length === 0 ? (
                <TableEmptyState
                  colSpan={9}
                  icon={Search}
                  title="No bookings found"
                  message="Try adjusting your filters or search query."
                />
              ) : (
                sortedBookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium text-gray-900">
                      {b.id}
                    </TableCell>
                    <TableCell>{b.flight}</TableCell>
                    <TableCell>
                      {b.destinationName ? (
                        <TruncatedTooltip text={b.destinationName} side="top">
                          <span className="cursor-default">{b.airport}</span>
                        </TruncatedTooltip>
                      ) : (
                        b.airport
                      )}
                    </TableCell>
                    <TableCell className="text-left">
                      <TruncatedTooltip text={b.hotel} side="top">
                        <div className="max-w-[160px] truncate cursor-default">
                          {b.hotel}
                        </div>
                      </TruncatedTooltip>
                    </TableCell>
                    <TableCell>
                      <TruncatedTooltip text={b.contactEmail} side="top">
                        <div className="max-w-[160px] truncate cursor-default">
                          {b.contactEmail}
                        </div>
                      </TruncatedTooltip>
                    </TableCell>
                    <TableCell>{b.passengers}</TableCell>
                    <TableCell>{b.rooms}</TableCell>
                    <TableCell>
                      $
                      {b.totalCost.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-start gap-1 -translate-x-1">
                        <button
                          onClick={() => handleViewDetail(b)}
                          disabled={viewingId === (b.numericId || b.id.replace(/\D/g, ""))}
                          className="p-1 text-[#6B7280] hover:text-[#0F2757] transition-colors cursor-pointer disabled:opacity-75"
                          title="View"
                        >
                          {viewingId === (b.numericId || b.id.replace(/\D/g, "")) ? (
                            <svg
                              className="animate-spin h-[20px] w-[20px] text-[#0F2757]"
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
                          ) : (
                            <Eye className="h-[20px] w-[20px]" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDownloadReceipt(b)}
                          disabled={exportingId === (b.numericId || b.id.replace(/\D/g, ""))}
                          className="p-1 text-[#6B7280] hover:text-emerald-600 transition-colors cursor-pointer disabled:opacity-50"
                          title="Download CSV"
                        >
                          {exportingId === (b.numericId || b.id.replace(/\D/g, "")) ? (
                            <svg className="animate-spin h-[20px] w-[20px] text-emerald-600" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                          ) : (
                            <Download className="h-[20px] w-[20px]" />
                          )}
                        </button>
                        <button
                          onClick={() => handleSendEmail(b)}
                          disabled={sendingEmailId === (b.numericId || b.id.replace(/\D/g, ""))}
                          className="p-1 text-[#6B7280] hover:text-blue-600 transition-colors cursor-pointer disabled:opacity-50"
                          title="Send confirmation email"
                        >
                          {sendingEmailId === (b.numericId || b.id.replace(/\D/g, "")) ? (
                            <svg
                              className="animate-spin h-[20px] w-[20px] text-blue-600"
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
                          ) : (
                            <Mail className="h-[20px] w-[20px]" />
                          )}
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

      <BookingDetailsDrawer
        isOpen={isDrawerOpen}
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedDrawerBooking(null);
          setDrawerDetailData(null);
        }}
        booking={selectedDrawerBooking?.raw || selectedDrawerBooking}
        hotelBookingId={selectedDrawerBooking?.numericId || selectedDrawerBooking?.id.replace(/\D/g, "")}
        flightId={selectedDrawerBooking?.raw?.cancelledFlightId}
        detailData={drawerDetailData}
        showSendConfirmation
        downloadType="csv"
        isBookingsTab
      />
    </div>
  );
}
