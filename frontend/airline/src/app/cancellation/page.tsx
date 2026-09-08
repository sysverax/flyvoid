"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  Plus,
  Send,
  Eye,
  ArrowLeft,
  Plane,
  Calendar,
  FileText,
  Users,
  DollarSign,
  CheckCircle2,
  Download,
  Bed,
  Percent,
  Wallet,
  Receipt,
  Star,
  Loader2,
} from "lucide-react";
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
import { TableEmptyState } from "@/src/components/ui/EmptyState";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { FiltersCard } from "@/src/components/ui/FiltersCard";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { TruncatedTooltip } from "@/src/components/ui/TruncatedTooltip";
import { Pagination } from "@/src/components/ui/pagination";
import { BookingDetailsDrawer } from "@/src/components/ui/BookingDetailsDrawer";
import CancellationWizard from "./CancellationWizard";
import {
  cancellationService,
  CancelledFlightApiStatus,
  ListCancelledFlightsItemDTO,
  ListCancelledFlightsResponseDataDto,
  ReviewFlightResponse,
  HotelSummaryCancelledFlightSummaryDto,
  HotelBookingItemDTO,
} from "@/src/services/cancellation.service";

const ENUM_TO_TRAVEL_CLASS: Record<string, string> = {
  first_class: "First Class",
  business: "Business",
  premium_economy: "Premium Economy",
  economy: "Economy",
};

interface Cancellation {
  id: string;
  flight: string;
  route: string;
  cancellationDate: string;
  bookings: number;
  passengers: number;
  totalCost: number;
  status: "Published" | "Verified" | "Allocated" | "Draft" | "Paid";
  displayStatus: string;
  reason: string;
}

const STATUS_OPTIONS = [
  { value: "All Status", label: "All Status" },
  { value: "Draft", label: "Draft" },
  { value: "In Progress", label: "In Progress" },
  { value: "Confirmed", label: "Confirmed" },
  { value: "HA In Progress", label: "HA In Progress" },
  { value: "Allocated", label: "Allocated" },
  { value: "Paid", label: "Paid" },
  { value: "Published", label: "Published" },
];

const UI_STATUS_TO_API_STATUS: Record<
  string,
  CancelledFlightApiStatus | undefined
> = {
  "All Status": undefined,
  Draft: "draft",
  "In Progress": "in_progress",
  Confirmed: "passengers_booking_confirmed",
  "HA In Progress": "hotel_allocation_in_progress",
  Allocated: "allocated",
  Paid: "paid",
  Published: "published",
};

const API_STATUS_TO_UI_STATUS: Record<
  string,
  { status: Cancellation["status"]; displayStatus: string }
> = {
  draft: { status: "Draft", displayStatus: "Draft" },
  in_progress: { status: "Draft", displayStatus: "In Progress" },
  passengers_booking_confirmed: {
    status: "Verified",
    displayStatus: "Confirmed",
  },
  hotel_allocation_in_progress: {
    status: "Verified",
    displayStatus: "HA In Progress",
  },
  allocated: { status: "Allocated", displayStatus: "Allocated" },
  paid: { status: "Paid", displayStatus: "Paid" },
  published: { status: "Published", displayStatus: "Published" },
};

function formatDateString(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function mapApiCancelledFlight(
  item: ListCancelledFlightsItemDTO,
): Cancellation {
  const mappedStatus = API_STATUS_TO_UI_STATUS[item.status] || {
    status: "Draft" as const,
    displayStatus: "Draft",
  };

  const depCode =
    item.departureAirport?.code ||
    (item as any).departureAirport?.iataCode ||
    "";
  const arrCode =
    item.arrivalAirport?.code ||
    (item as any).arrivalAirport?.iataCode ||
    "";

  return {
    id: String(item.id),
    flight: item.flightNumber,
    route: `${depCode} ➔ ${arrCode}`,
    cancellationDate: formatDateString(item.cancellationDate),
    bookings: Number(item.totalBookings || 0),
    passengers: Number(item.totalPassengers || 0),
    totalCost: Number(item.totalCost || 0),
    status: mappedStatus.status,
    displayStatus: mappedStatus.displayStatus,
    reason: "Not specified",
  };
}

function withDisplayStatus(
  item: Omit<Cancellation, "displayStatus"> | Cancellation,
): Cancellation {
  return {
    ...item,
    displayStatus: (item as Cancellation).displayStatus || item.status,
  };
}

function PublishedDetailView({
  cancellation,
  onClose,
}: {
  cancellation: Cancellation;
  onClose: () => void;
}) {
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(10);

  // API states
  const [reviewData, setReviewData] = useState<ReviewFlightResponse | null>(null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);

  const [hotelSummary, setHotelSummary] =
    useState<HotelSummaryCancelledFlightSummaryDto | null>(null);
  const [isLoadingHotelSummary, setIsLoadingHotelSummary] = useState(false);

  const [hotelBookings, setHotelBookings] = useState<HotelBookingItemDTO[]>([]);
  const [totalHotelBookings, setTotalHotelBookings] = useState(0);
  const [isLoadingHotelBookings, setIsLoadingHotelBookings] = useState(false);

  // Drawer state
  const [selectedBookingForDrawer, setSelectedBookingForDrawer] =
    useState<any>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const flightId = Number(cancellation.id);

  // 1. Fetch Review Flight API
  useEffect(() => {
    if (!flightId) return;
    let isMounted = true;

    const fetchReview = async () => {
      setIsLoadingReview(true);
      try {
        const res = await cancellationService.reviewFlight(flightId);
        const data = res?.data || res;
        if (isMounted && data) {
          setReviewData(data);
        }
      } catch (err: any) {
        console.error("Failed to load flight review details:", err);
      } finally {
        if (isMounted) {
          setIsLoadingReview(false);
        }
      }
    };

    fetchReview();

    return () => {
      isMounted = false;
    };
  }, [flightId]);

  // 2. Fetch Hotel Summary API
  useEffect(() => {
    if (!flightId) return;
    let isMounted = true;

    const fetchSummary = async () => {
      setIsLoadingHotelSummary(true);
      try {
        const res = await cancellationService.getHotelSummary(flightId);
        const summary =
          res?.data?.summary || (res?.data as any) || (res as any)?.summary;
        if (isMounted && summary) {
          setHotelSummary(summary);
        }
      } catch (err: any) {
        console.error("Failed to load hotel summary:", err);
      } finally {
        if (isMounted) {
          setIsLoadingHotelSummary(false);
        }
      }
    };

    fetchSummary();

    return () => {
      isMounted = false;
    };
  }, [flightId]);

  // 3. Fetch List All Hotel Bookings API
  useEffect(() => {
    if (!flightId) return;
    let isMounted = true;

    const fetchBookings = async () => {
      setIsLoadingHotelBookings(true);
      try {
        const res = await cancellationService.listHotelBookings(flightId, {
          page: currentPage,
          limit: resultsPerPage,
        });
        const data = res?.data || (res as any);
        if (isMounted && data?.hotelBookings) {
          setHotelBookings(data.hotelBookings);
          setTotalHotelBookings(
            data.totalHotelBookings ?? data.hotelBookings.length,
          );
        }
      } catch (err: any) {
        console.error("Failed to load hotel bookings:", err);
      } finally {
        if (isMounted) {
          setIsLoadingHotelBookings(false);
        }
      }
    };

    fetchBookings();

    return () => {
      isMounted = false;
    };
  }, [flightId, currentPage, resultsPerPage]);

  // Flight summary card details
  const flightNumber = reviewData?.flight?.flightNumber || cancellation.flight;
  const routeDisplay =
    reviewData?.flight?.route?.departureAirport?.code &&
      reviewData?.flight?.route?.arrivalAirport?.code
      ? `${reviewData.flight.route.departureAirport.code} → ${reviewData.flight.route.arrivalAirport.code}`
      : cancellation.route.replace("➔", "→");

  const cancellationDateDisplay = reviewData?.flight?.cancellationDate
    ? formatDateString(reviewData.flight.cancellationDate)
    : cancellation.cancellationDate;

  const bookingsCount =
    hotelSummary?.totalBookings ??
    reviewData?.summary?.totalBookings ??
    cancellation.bookings;

  const passengersCount = hotelSummary
    ? (hotelSummary.totalAdults || 0) + (hotelSummary.totalChildren || 0)
    : reviewData?.summary
      ? (reviewData.summary.totalAdults || 0) +
      (reviewData.summary.totalChildren || 0)
      : cancellation.passengers;

  const reasonDisplay = reviewData?.flight?.cancellationReason
    ? reviewData.flight.cancellationReason.replace(/_/g, " ")
    : cancellation.reason && cancellation.reason !== "Not specified"
      ? cancellation.reason
      : "Not specified";

  // Financial calculations from hotel summary (with fallbacks)
  const totalRoomsBooked =
    hotelSummary?.totalRooms ||
    hotelSummary?.totalBookings ||
    cancellation.bookings;

  const totalHotelCost =
    hotelSummary?.totalHotelCost ?? cancellation.bookings * 144;
  const hotelCost = totalHotelCost;

  const platformDiscount =
    hotelSummary?.totalDiscount ?? hotelCost * 0.1;

  const hotelTax =
    hotelSummary?.totalHotelTax ?? hotelCost * 0.08;

  const platformFee =
    hotelSummary?.totalPlatformFee ??
    (hotelCost - platformDiscount + hotelTax) * 0.05;

  const totalPayment =
    hotelSummary?.totalPayable ??
    hotelCost - platformDiscount + hotelTax + platformFee;

  const totalResults =
    totalHotelBookings > 0
      ? totalHotelBookings
      : bookingsCount > 0
        ? bookingsCount
        : 1;

  const totalPages = Math.ceil(totalResults / resultsPerPage) || 1;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center w-full mt-2">
        <button
          onClick={onClose}
          className="relative -top-1 flex items-center gap-1.5 text-[16px] text-[#6B7280] hover:text-[#1F2937] transition-colors duration-150 font-medium group cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Cancelled Flights</span>
        </button>
        <StatusBadge
          status={cancellation.displayStatus}
          className="h-[28px] px-3.5 text-[14px]"
        />
      </div>

      {/* Flight Summary Card */}
      <div className="w-full bg-white rounded-[16px] border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-[52px] h-[52px] rounded-[12px] bg-[#F3F4F6] flex items-center justify-center text-[#4B5563]">
            <Plane className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-[24px] font-bold text-[#1F2937] leading-tight">
              {flightNumber}
            </h2>
            <p className="text-[#6B7280] mt-0.5">
              {routeDisplay}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-[#F9FAFB] rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[#6B7280] mb-2">
              <Calendar className="w-[15px] h-[15px]" />
              <span className="text-[13px] font-medium">Cancellation Date</span>
            </div>
            <p className="text-[#1F2937] font-semibold">
              {cancellationDateDisplay}
            </p>
          </div>
          <div className="bg-[#F9FAFB] rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[#6B7280] mb-2">
              <FileText className="w-[15px] h-[15px]" />
              <span className="text-[13px] font-medium">Bookings</span>
            </div>
            <p className="text-[#1F2937] font-semibold">
              {bookingsCount}
            </p>
          </div>
          <div className="bg-[#F9FAFB] rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[#6B7280] mb-2">
              <Users className="w-[15px] h-[15px]" />
              <span className="text-[13px] font-medium">Passengers</span>
            </div>
            <p className="text-[#1F2937] font-semibold">
              {passengersCount}
            </p>
          </div>
          <div className="bg-[#F9FAFB] rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[#6B7280] mb-2">
              <DollarSign className="w-[15px] h-[15px]" />
              <span className="text-[13px] font-medium">Total Cost</span>
            </div>
            <p className="text-[#059669] font-semibold">
              ${totalPayment.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>
        </div>

        <div className="h-px bg-gray-100 w-full mb-4"></div>

        <p className="text-[#4B5563] text-[15px] capitalize">
          <span className="font-semibold text-[#6B7280] mr-2 normal-case">Reason:</span>
          {reasonDisplay}
        </p>
      </div>

      {/* Published Bookings Detail Card */}
      <div className="w-full bg-white rounded-[16px] border border-gray-200 p-6">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className="w-[42px] h-[42px] rounded-full bg-[#ECFDF5] flex items-center justify-center text-[#10B981]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-[18px] font-bold text-[#1F2937] leading-tight">
                Published Bookings
              </h3>
              <p className="text-[#6B7280] text-[15px] mt-0.5">
                Confirmation emails have been sent to all passengers
              </p>
            </div>
          </div>
          <button className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-[#374151] px-4 py-2.5 rounded-lg font-medium transition-colors cursor-pointer text-sm">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
            <div className="flex items-center gap-2 text-gray-500 mb-3">
              <Bed className="h-4 w-4" />
              <span className="text-[13px] font-semibold uppercase">
                Total Room Bookings
              </span>
            </div>
            <div className="text-[24px] font-bold text-gray-900">
              {isLoadingHotelSummary && !hotelSummary ? (
                <Loader2 className="h-5 w-5 animate-spin text-gray-400 my-1" />
              ) : (
                totalRoomsBooked
              )}
            </div>
            <div className="text-sm text-gray-400 mt-1">Rooms booked</div>
          </div>

          <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
            <div className="flex items-center gap-2 text-gray-500 mb-3">
              <Receipt className="h-4 w-4" />
              <span className="text-[13px] font-semibold uppercase">
                Total Hotel Cost
              </span>
            </div>
            <div className="text-[24px] font-bold text-gray-900">
              {isLoadingHotelSummary && !hotelSummary ? (
                <Loader2 className="h-5 w-5 animate-spin text-gray-400 my-1" />
              ) : (
                `$${totalHotelCost.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              )}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              Hotel charges before platform discount
            </div>
          </div>

          <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
            <div className="flex items-center gap-2 text-gray-500 mb-3">
              <Percent className="h-4 w-4" />
              <span className="text-[13px] font-semibold uppercase">
                Platform Discount
              </span>
            </div>
            <div className="text-[24px] font-bold text-green-600">
              {isLoadingHotelSummary && !hotelSummary ? (
                <Loader2 className="h-5 w-5 animate-spin text-gray-400 my-1" />
              ) : (
                `-$${platformDiscount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              )}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              Discount provided by platform
            </div>
          </div>

          <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
            <div className="flex items-center gap-2 text-gray-500 mb-3">
              <DollarSign className="h-4 w-4" />
              <span className="text-[13px] font-semibold uppercase">
                Hotel Tax
              </span>
            </div>
            <div className="text-[24px] font-bold text-gray-900">
              {isLoadingHotelSummary && !hotelSummary ? (
                <Loader2 className="h-5 w-5 animate-spin text-gray-400 my-1" />
              ) : (
                `$${hotelTax.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              )}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              Applicable hotel taxes
            </div>
          </div>

          <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
            <div className="flex items-center gap-2 text-gray-500 mb-3">
              <Percent className="h-4 w-4" />
              <span className="text-[13px] font-semibold uppercase">
                Platform Fee (5%)
              </span>
            </div>
            <div className="text-[24px] font-bold text-gray-900">
              {isLoadingHotelSummary && !hotelSummary ? (
                <Loader2 className="h-5 w-5 animate-spin text-gray-400 my-1" />
              ) : (
                `$${platformFee.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              )}
            </div>
            <div className="text-sm text-gray-400 mt-1">
              Platform fee on the hotel payment
            </div>
          </div>

          <div className="bg-[#F6F7F8] border-[2px] border-[#0F2757] rounded-xl p-5 text-left">
            <div className="flex items-center gap-2 text-[#0F2757] mb-3">
              <Wallet className="h-4 w-4" />
              <span className="text-[13px] font-semibold uppercase">
                Total Payment
              </span>
            </div>
            <div className="text-[24px] font-bold text-[#0F2757]">
              {isLoadingHotelSummary && !hotelSummary ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#0F2757] my-1" />
              ) : (
                `$${totalPayment.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}`
              )}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              Total amount to be charged
            </div>
          </div>
        </div>

        {/* Booked Hotels Table */}
        <div className="mt-8 text-left">
          <h4 className="text-[16px] font-semibold text-[#0F2757]">
            Booked Hotels
          </h4>
          <p className="text-sm text-gray-500 mt-1">
            Review the hotel assigned to each booking and the associated room
            costs.
          </p>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded-xl mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px]">
                  Hotel Booking ID
                </TableHead>
                <TableHead className="min-w-[100px]">PNR</TableHead>
                <TableHead className="min-w-[160px]">Contact</TableHead>
                <TableHead className="min-w-[120px]">Passengers</TableHead>
                <TableHead className="min-w-[180px]">Hotel</TableHead>
                <TableHead className="min-w-[100px]">Rating</TableHead>
                <TableHead className="min-w-[80px]">Rooms</TableHead>
                <TableHead className="min-w-[100px]">Total</TableHead>
                <TableHead className="min-w-[80px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingHotelBookings && hotelBookings.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center py-10 text-gray-500"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-[#0F2757]" />
                      <span>Loading hotel bookings...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : hotelBookings.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="text-center py-10 text-gray-500"
                  >
                    No hotel bookings found
                  </TableCell>
                </TableRow>
              ) : (
                hotelBookings.map((hb) => {
                  const pb = hb.passengerBooking;
                  const hotelBookingId = `HB-${String(hb.id).padStart(6, "0")}`;
                  const pnr = pb?.pnr || "-";
                  const contactName =
                    `${pb?.firstName || ""} ${pb?.lastName || ""}`.trim() || "-";
                  const email = pb?.email || "";
                  const travelClass =
                    ENUM_TO_TRAVEL_CLASS[pb?.travelClass] ||
                    pb?.travelClass ||
                    "Economy";
                  const totalPax =
                    (pb?.adults || 0) + (pb?.children || 0);
                  const passengersStr =
                    totalPax > 1
                      ? `${totalPax} Passengers`
                      : `${totalPax || 1} Passenger`;
                  const hotelName = hb.hotelName || "Transit Hotel";
                  const ratingVal = parseFloat(hb.rating) || 4;
                  const stars = Math.min(
                    5,
                    Math.max(1, Math.round(ratingVal)),
                  );
                  const rooms = hb.totalRooms || 1;
                  const bookingCost = Number(hb.totalCost) || 0;

                  return (
                    <TableRow key={hb.id}>
                      <TableCell className="font-medium text-gray-900">
                        {hotelBookingId}
                      </TableCell>
                      <TableCell className="font-medium text-gray-900">
                        {pnr}
                      </TableCell>
                      <TableCell>
                        <div className="font-semibold text-gray-900">
                          {contactName}
                        </div>
                        {email && (
                          <TruncatedTooltip text={email} side="top">
                            <div className="text-xs text-gray-500 max-w-[160px] truncate cursor-default">
                              {email}
                            </div>
                          </TruncatedTooltip>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {passengersStr}
                      </TableCell>
                      <TableCell className="font-medium">
                        <TruncatedTooltip text={hotelName} side="top">
                          <div className="max-w-[180px] truncate cursor-default">
                            {hotelName}
                          </div>
                        </TruncatedTooltip>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center text-amber-400">
                          {[...Array(stars)].map((_, i) => (
                            <Star
                              key={i}
                              className="h-3 w-3 fill-current"
                            />
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{rooms}</TableCell>
                      <TableCell className="font-semibold text-gray-900">
                        $
                        {bookingCost.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedBookingForDrawer({
                              ...pb,
                              hotelBookingId,
                              hotelName,
                              rating: hb.rating,
                              totalRooms: rooms,
                              totalCost: bookingCost,
                              travelClass,
                              roomName:
                                (hb as any).rooms?.[0]?.roomName ||
                                (hb as any).rooms?.[0]?.name ||
                                "Standard Twin Room",
                              roomType:
                                (hb as any).rooms?.[0]?.roomName ||
                                (hb as any).rooms?.[0]?.name ||
                                "Standard Twin Room",
                              checkInDate:
                                (hb as any).checkInDate ||
                                cancellationDateDisplay,
                              checkOutDate: (hb as any).checkOutDate,
                              hotelAddress:
                                (hb as any).hotelAddress ||
                                (hb as any).address,
                            });
                            setIsDrawerOpen(true);
                          }}
                          className="p-1.5 text-gray-400 hover:text-[#0F2757] hover:bg-gray-100 rounded transition-colors cursor-pointer"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="mt-4">
          <Pagination
            totalResults={totalResults}
            resultsPerPage={resultsPerPage}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            setResultsPerPage={(val: number) => {
              setResultsPerPage(val);
              setCurrentPage(1);
            }}
            totalPages={totalPages}
          />
        </div>

        {/* Success Banner */}
        <div className="mt-8 flex items-center justify-between bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl px-5 py-4">
          <div>
            <h4 className="text-[#15803D] font-medium text-[15px]">
              All bookings confirmed
            </h4>
            <p className="text-[#64748B] text-[13px] mt-0.5">
              {bookingsCount} confirmation emails sent
            </p>
          </div>
          <div className="text-[22px] font-bold text-[#0F2757]">
            $
            {totalPayment.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
        </div>
      </div>

      <BookingDetailsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        booking={selectedBookingForDrawer}
      />
    </div>
  );
}

export default function CancellationPage() {
  const [cancellations, setCancellations] = useState<Cancellation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Sorting
  const [sortField, setSortField] = useState<keyof Cancellation | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(10);

  // View state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [detailCancellation, setDetailCancellation] =
    useState<Cancellation | null>(null);
  const [publishTarget, setPublishTarget] = useState<Cancellation | null>(null);
  const [isPublishingModal, setIsPublishingModal] = useState(false);

  // Sort function
  const handleSort = (field: keyof Cancellation) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  // Clear filters
  const handleClearAll = () => {
    setSearchQuery("");
    setSelectedStatus("All Status");
    setSortField(null);
    setSortOrder("asc");
    setCurrentPage(1);
  };

  useEffect(() => {
    if (isAddingNew || detailCancellation) return;

    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const response = await cancellationService.listCancelledFlights({
          page: currentPage,
          limit: resultsPerPage,
          status: UI_STATUS_TO_API_STATUS[selectedStatus],
          search: searchQuery.trim() || undefined,
        });

        if (isMounted) {
          const data: ListCancelledFlightsResponseDataDto | undefined =
            response?.data;
          const items = data?.cancelledFlights || [];
          setCancellations(items.map(mapApiCancelledFlight));
          setTotalCount(data?.pagination?.totalCount || 0);
        }
      } catch (error: any) {
        if (isMounted) {
          toast.error(error?.message || "Failed to load cancelled flights");
          setCancellations([]);
          setTotalCount(0);
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
  }, [
    searchQuery,
    selectedStatus,
    currentPage,
    resultsPerPage,
    isAddingNew,
    detailCancellation,
  ]);

  // Confirm Publish function (from modal)
  const confirmPublish = async (id: string) => {
    setIsPublishingModal(true);
    try {
      await cancellationService.publishFlight(Number(id));
      setCancellations((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, status: "Published", displayStatus: "Published" }
            : c,
        ),
      );
      toast.success("Cancelled flight published successfully");
      setPublishTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to publish flight");
    } finally {
      setIsPublishingModal(false);
    }
  };

  // Sorting Logic
  const sortedCancellations = useMemo(() => {
    if (!sortField) return cancellations;
    return [...cancellations].sort((a, b) => {
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
  }, [cancellations, sortField, sortOrder]);

  const totalPages = Math.ceil(totalCount / resultsPerPage) || 1;

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      {detailCancellation &&
        (detailCancellation.status === "Published" ||
          detailCancellation.displayStatus === "Published") ? (
        <PublishedDetailView
          cancellation={detailCancellation}
          onClose={() => setDetailCancellation(null)}
        />
      ) : detailCancellation &&
        detailCancellation.status !== "Published" &&
        detailCancellation.displayStatus !== "Published" ? (
        <CancellationWizard
          initialData={detailCancellation}
          onClose={() => {
            setDetailCancellation(null);
          }}
          onSave={() => {
            setDetailCancellation(null);
          }}
        />
      ) : isAddingNew ? (
        <CancellationWizard
          onClose={() => {
            setIsAddingNew(false);
            setSelectedStatus("All Status");
            setCurrentPage(1);
          }}
          onSave={() => {
            setIsAddingNew(false);
            setSelectedStatus("All Status");
            setCurrentPage(1);
          }}
        />
      ) : (
        <div className="space-y-7">
          {/* Header Block */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%]">
                Cancellation
              </h1>
              <p className="text-[14px] text-[#6B7280] mt-1">
                Manage flight cancellations and hotel allocations
              </p>
            </div>
            <button
              onClick={() => {
                setSelectedStatus("All Status");
                setSearchQuery("");
                setCurrentPage(1);
                setIsAddingNew(true);
              }}
              className="h-[50px] rounded-[10px] bg-[#0F2757] hover:bg-[#162259] px-4.5 py-[9px] text-[16px] font-medium font-figtree transition-colors duration-200 cursor-pointer text-white flex items-center justify-center gap-1.5 -translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              <span>Create Cancelled Flight</span>
            </button>
          </div>

          {/* Filters Card */}
          <FiltersCard
            searchQuery={searchQuery}
            setSearchQuery={(q) => {
              setSearchQuery(q);
              setCurrentPage(1);
            }}
            searchPlaceholder="Search flights..."
            onClearFilters={handleClearAll}
          >
            {/* Status selector */}
            <Dropdown
              value={selectedStatus}
              onChange={(val) => {
                setSelectedStatus(val);
                setCurrentPage(1);
              }}
              options={STATUS_OPTIONS}
              widthClass="w-44"
              triggerWidthClass="w-[180px]"
            />
          </FiltersCard>

          {/* Cancellations Table */}
          <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white mb-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[130px]">
                    <SortHeader
                      label="Flight"
                      field="flight"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[140px]">
                    <SortHeader
                      label="Route"
                      field="route"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[170px]">
                    <SortHeader
                      label="Cancellation Date"
                      field="cancellationDate"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[110px]">
                    <SortHeader
                      label="Bookings"
                      field="bookings"
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
                  <TableHead className="min-w-[130px]">
                    <SortHeader
                      label="Total Cost"
                      field="totalCost"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[115px]">
                    <SortHeader
                      label="Status"
                      field="status"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
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
                        <span>Loading cancellations...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : sortedCancellations.length === 0 ? (
                  <TableEmptyState
                    colSpan={8}
                    icon={Search}
                    title="No flights found"
                    message="Try adjusting your filters or search query."
                  />
                ) : (
                  sortedCancellations.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-[#1F2937]">
                        <TruncatedTooltip text={c.flight} side="top">
                          <div className="max-w-[120px] truncate cursor-default">
                            {c.flight}
                          </div>
                        </TruncatedTooltip>
                      </TableCell>
                      <TableCell className="text-[#6B7280]">
                        <TruncatedTooltip text={c.route.replace("➔", "→")} side="top">
                          <div className="max-w-[200px] truncate cursor-default">
                            {c.route.split("➔").map((part, i, arr) => (
                              <span key={i}>
                                {part}
                                {i < arr.length - 1 && (
                                  <span className="font-bold text-gray-900">→</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </TruncatedTooltip>
                      </TableCell>
                      <TableCell className="text-[#6B7280]">
                        {c.cancellationDate}
                      </TableCell>
                      <TableCell className="text-[#6B7280]">
                        {c.bookings}
                      </TableCell>
                      <TableCell className="text-[#6B7280]">
                        {c.passengers}
                      </TableCell>
                      <TableCell className="text-[#6B7280]">
                        ${c.totalCost.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={c.displayStatus} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-start gap-1 -translate-x-1">
                          {(c.status === "Paid" || c.displayStatus === "Paid") && (
                            <button
                              onClick={() => setPublishTarget(c)}
                              className="p-1 text-[#6B7280] hover:text-emerald-600 transition-colors cursor-pointer"
                              title="Publish"
                            >
                              <Send className="h-[20px] w-[20px]" />
                            </button>
                          )}
                          <button
                            onClick={() => setDetailCancellation(c)}
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

          {/* Pagination footer */}
          <Pagination
            totalResults={totalCount}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            resultsPerPage={resultsPerPage}
            setResultsPerPage={setResultsPerPage}
            totalPages={totalPages}
          />
        </div>
      )}

      {/* Publish Confirmation Modal */}
      {publishTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fadeIn">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setPublishTarget(null)}
          />
          <div
            className="relative bg-white flex flex-col justify-center items-start py-6 gap-5 z-10 animate-scaleIn border border-gray-100"
            style={{ width: 560, borderRadius: 16 }}
          >
            {/* Header */}
            <div
              className="flex flex-row justify-between items-center w-full"
              style={{
                padding: "0px 24px 20px",
                borderBottom: "1px solid #D1D5DB",
              }}
            >
              <h2
                className="text-[#1F2937] font-semibold text-[22px] font-figtree"
                style={{ lineHeight: "100%" }}
              >
                Publish Hotel Allocations
              </h2>
              <button
                onClick={() => setPublishTarget(null)}
                className="p-1.5 rounded-lg transition-colors cursor-pointer flex-shrink-0"
              >
                <X className="w-5 h-5 text-[#1F2937]" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 w-full text-left space-y-4">
              <p className="text-gray-500 text-[15px] leading-relaxed">
                This will finalize hotel bookings and send confirmation emails
                to all passengers.
              </p>

              <div className="w-full bg-[#F8F9FA] rounded-xl p-5 space-y-3 text-[15px]">
                <div className="flex justify-between items-center text-gray-800">
                  <span>Flight</span>
                  <span className="font-semibold text-gray-900">
                    {publishTarget.flight}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-800">
                  <span>Route</span>
                  <span className="font-semibold text-gray-900">
                    {publishTarget.route}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-800">
                  <span>Bookings</span>
                  <span className="font-semibold text-gray-900">
                    {publishTarget.bookings}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-800">
                  <span>Passengers</span>
                  <span className="font-semibold text-gray-900">
                    {publishTarget.passengers}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-800 pt-3 border-t border-gray-200 mt-1">
                  <span className="font-medium text-gray-900">Total Cost</span>
                  <span className="font-bold text-gray-900 text-[17px]">
                    ${publishTarget.totalCost.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="w-full bg-[#FFF7E8] border border-[#FBE0C3] p-4 rounded-xl text-sm text-[#F59E0B] text-left">
                <p>
                  <span className="font-bold">Note:</span> This action cannot be
                  undone. Passengers will receive their hotel booking
                  confirmations immediately.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 w-full mt-2">
              <button
                type="button"
                onClick={() => setPublishTarget(null)}
                disabled={isPublishingModal}
                className="flex-1 py-3 rounded-lg border border-[#D1D5DB] text-[#1F2937] transition-colors hover:bg-[#F9FAFB] cursor-pointer font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmPublish(publishTarget.id)}
                disabled={isPublishingModal}
                className="flex-1 py-3 rounded-lg text-white bg-[#0F2757] hover:bg-[#162259] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2 font-medium"
              >
                {isPublishingModal ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Publish & Notify</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
