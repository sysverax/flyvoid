"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
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
  Eye,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/src/components/ui/table";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { TruncatedTooltip } from "@/src/components/ui/TruncatedTooltip";
import { useAuth } from "@/src/hooks/useAuth";
import { Pagination } from "@/src/components/ui/pagination";
import { BookingDetailsDrawer } from "@/src/components/ui/BookingDetailsDrawer";
import { PLATFORM_FEE_PERCENT } from "@/src/lib/constants";
import {
  cancellationService,
  ReviewFlightResponse,
  HotelSummaryCancelledFlightSummaryDto,
  HotelBookingItemDTO,
  HotelBookingDetailDataDto,
} from "@/src/services/cancellation.service";

const ENUM_TO_TRAVEL_CLASS: Record<string, string> = {
  first_class: "First Class",
  business: "Business",
  premium_economy: "Premium Economy",
  economy: "Economy",
};

export interface CancellationSummaryInfo {
  id: string;
  flight?: string;
  route?: string;
  cancellationDate?: string;
  bookings?: number;
  passengers?: number;
  totalCost?: number;
  status?: string;
  displayStatus?: string;
  reason?: string;
}

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

interface PublishedDetailViewProps {
  flightId?: number | string;
  cancellation?: CancellationSummaryInfo | null;
  onClose?: () => void;
}

export default function PublishedDetailView({
  flightId: propFlightId,
  cancellation,
  onClose,
}: PublishedDetailViewProps) {
  const router = useRouter();
  const { hasPermission } = useAuth();
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
  const [selectedDrawerHotelBookingId, setSelectedDrawerHotelBookingId] =
    useState<number | string | null>(null);
  const [selectedDrawerDetailData, setSelectedDrawerDetailData] =
    useState<HotelBookingDetailDataDto | null>(null);
  const [loadingEyeBookingId, setLoadingEyeBookingId] = useState<
    number | string | null
  >(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isExportingReport, setIsExportingReport] = useState(false);

  const effectiveFlightId = Number(propFlightId || cancellation?.id);

  const handleBack = () => {
    if (onClose) {
      onClose();
    } else {
      router.push("/cancelled-flight");
    }
  };

  const handleExportReport = async () => {
    if (!effectiveFlightId || isExportingReport) return;
    setIsExportingReport(true);
    try {
      await cancellationService.exportFlightReport(effectiveFlightId);
    } catch (err: any) {
      console.error("Failed to export flight report:", err);
      toast.error(err?.message || "Failed to export flight report.");
    } finally {
      setIsExportingReport(false);
    }
  };

  // 1. Fetch Review Flight API
  useEffect(() => {
    if (!effectiveFlightId) return;
    let isMounted = true;

    const fetchReview = async () => {
      setIsLoadingReview(true);
      try {
        const res = await cancellationService.reviewFlight(effectiveFlightId);
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
  }, [effectiveFlightId]);

  // 2. Fetch Hotel Summary API
  useEffect(() => {
    if (!effectiveFlightId) return;
    let isMounted = true;

    const fetchSummary = async () => {
      setIsLoadingHotelSummary(true);
      try {
        const res = await cancellationService.getHotelSummary(effectiveFlightId);
        const summary =
          res?.data?.summary || (res?.data as any) || (res as any)?.summary;
        if (isMounted && summary) {
          setHotelSummary({
            totalBookings: Number(summary.totalBookings ?? 0),
            totalAdults: Number(summary.totalAdults ?? 0),
            totalChildren: Number(summary.totalChildren ?? 0),
            totalRooms: Number(summary.totalRooms ?? 0),
            totalHotelCost: Number(summary.totalHotelCost ?? 0),
            totalDiscount: Number(summary.totalDiscount ?? 0),
            totalHotelTax: Number(summary.totalHotelTax ?? 0),
            totalPlatformFee: Number(summary.totalPlatformFee ?? 0),
            totalPayable: Number(summary.totalPayable ?? 0),
          });
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
  }, [effectiveFlightId]);

  // 3. Fetch List All Hotel Bookings API
  useEffect(() => {
    if (!effectiveFlightId) return;
    let isMounted = true;

    const fetchBookings = async () => {
      setIsLoadingHotelBookings(true);
      try {
        const res = await cancellationService.listHotelBookings(effectiveFlightId, {
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
  }, [effectiveFlightId, currentPage, resultsPerPage]);

  // Flight summary card details
  const flightNumber = reviewData?.flight?.flightNumber || cancellation?.flight || "N/A";
  const routeDisplay =
    reviewData?.flight?.route?.departureAirport?.code &&
      reviewData?.flight?.route?.arrivalAirport?.code
      ? `${reviewData.flight.route.departureAirport.code} → ${reviewData.flight.route.arrivalAirport.code}`
      : (cancellation?.route || "—").replace("➔", "→");

  const cancellationDateDisplay = reviewData?.flight?.cancellationDate
    ? formatDateString(reviewData.flight.cancellationDate)
    : cancellation?.cancellationDate || "—";

  const bookingsCount =
    hotelSummary?.totalBookings ??
    reviewData?.summary?.totalBookings ??
    cancellation?.bookings ??
    0;

  const passengersCount = hotelSummary
    ? (hotelSummary.totalAdults || 0) + (hotelSummary.totalChildren || 0)
    : reviewData?.summary
      ? (reviewData.summary.totalAdults || 0) +
      (reviewData.summary.totalChildren || 0)
      : cancellation?.passengers ?? 0;

  const reasonDisplay = reviewData?.flight?.cancellationReason
    ? reviewData.flight.cancellationReason.replace(/_/g, " ")
    : cancellation?.reason && cancellation.reason !== "Not specified"
      ? cancellation.reason
      : "";

  // Financial calculations from hotel summary
  const totalRoomsBooked = hotelSummary?.totalRooms ?? 0;
  const totalHotelCost = hotelSummary?.totalHotelCost ?? 0;
  const platformDiscount = hotelSummary?.totalDiscount ?? 0;
  const hotelTax = hotelSummary?.totalHotelTax ?? 0;
  const platformFee = hotelSummary?.totalPlatformFee ?? 0;
  const totalPayment = hotelSummary?.totalPayable ?? 0;

  const totalResults =
    totalHotelBookings > 0
      ? totalHotelBookings
      : bookingsCount > 0
        ? bookingsCount
        : 1;

  const totalPages = Math.ceil(totalResults / resultsPerPage) || 1;
  const displayStatus = cancellation?.displayStatus || reviewData?.flight?.status || "Published";

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center w-full mt-2">
        <button
          onClick={handleBack}
          className="relative -top-1 flex items-center gap-1.5 text-[16px] text-[#6B7280] hover:text-[#1F2937] transition-colors duration-150 font-medium group cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Cancelled Flights</span>
        </button>
        <StatusBadge
          status={displayStatus}
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
          {reasonDisplay || "N/A"}
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
          {hasPermission("export") && (
            <button
              onClick={handleExportReport}
              disabled={isExportingReport}
              className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-[#374151] px-4 py-2.5 rounded-lg font-medium transition-colors cursor-pointer text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isExportingReport ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {isExportingReport ? "Exporting..." : "Export Report"}
            </button>
          )}
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
                Platform Fee ({PLATFORM_FEE_PERCENT}%)
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
                  const hotelBookingId = String(hb.id);
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
                          disabled={loadingEyeBookingId === hb.id}
                          onClick={async () => {
                            const pb = hb.passengerBooking;
                            const hotelBookingIdStr = String(hb.id);
                            setSelectedBookingForDrawer({
                              ...pb,
                              hotelBookingId: hotelBookingIdStr,
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
                            setSelectedDrawerHotelBookingId(hb.id);

                            if (!effectiveFlightId || !hb.id) {
                              setSelectedDrawerDetailData(null);
                              setIsDrawerOpen(true);
                              return;
                            }

                            setLoadingEyeBookingId(hb.id);
                            try {
                              const res = await cancellationService.getHotelBookingDetail(
                                effectiveFlightId,
                                hb.id,
                              );
                              if (res?.data) {
                                setSelectedDrawerDetailData(res.data);
                              } else {
                                setSelectedDrawerDetailData(null);
                              }
                            } catch (err: any) {
                              console.error(
                                "Failed to fetch hotel booking details:",
                                err,
                              );
                              setSelectedDrawerDetailData(null);
                            } finally {
                              setLoadingEyeBookingId(null);
                              setIsDrawerOpen(true);
                            }
                          }}
                          className="p-1.5 text-gray-400 hover:text-[#0F2757] hover:bg-gray-100 rounded transition-colors cursor-pointer disabled:opacity-80"
                          title="View details"
                        >
                          {loadingEyeBookingId === hb.id ? (
                            <Loader2 className="h-4 w-4 animate-spin text-[#0F2757]" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
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
        onClose={() => {
          setIsDrawerOpen(false);
          setSelectedDrawerHotelBookingId(null);
          setSelectedDrawerDetailData(null);
        }}
        booking={selectedBookingForDrawer}
        flightId={effectiveFlightId}
        hotelBookingId={selectedDrawerHotelBookingId}
        detailData={selectedDrawerDetailData}
        downloadType="download"
      />
    </div>
  );
}
