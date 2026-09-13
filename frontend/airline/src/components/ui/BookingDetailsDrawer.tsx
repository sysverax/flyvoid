"use client";

import {
  X,
  Star,
  Calendar,
  Loader2,
  Plane,
  User,
  Users,
  Building2,
  MapPin,
  Phone,
  BedDouble,
  Download,
  Globe,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  cancellationService,
  HotelBookingDetailDataDto,
} from "@/src/services/cancellation.service";

const PLATFORM_FEE_PERCENT = 10;

interface BookingDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  booking?: any;
  flightId?: number | string | null;
  hotelBookingId?: number | string | null;
  detailData?: HotelBookingDetailDataDto | null;
}

export function BookingDetailsDrawer({
  isOpen,
  onClose,
  booking,
  flightId,
  hotelBookingId,
  detailData: propDetailData,
}: BookingDetailsDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [internalDetailData, setInternalDetailData] =
    useState<HotelBookingDetailDataDto | null>(null);
  const [hotelImageError, setHotelImageError] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeDetailData = propDetailData || internalDetailData;

  const fetchDetail = useCallback(async () => {
    if (!flightId || !hotelBookingId) return;
    try {
      const res = await cancellationService.getHotelBookingDetail(
        flightId,
        hotelBookingId,
      );
      if (res?.data) {
        setInternalDetailData(res.data);
      }
    } catch (err: any) {
      console.error("Failed to load hotel booking detail:", err);
    }
  }, [flightId, hotelBookingId]);

  useEffect(() => {
    if (!isOpen) {
      setInternalDetailData(null);
      return;
    }

    if (!propDetailData && flightId && hotelBookingId) {
      fetchDetail();
    }
  }, [isOpen, flightId, hotelBookingId, propDetailData, fetchDetail]);

  const pBooking = activeDetailData?.booking || booking;
  const hotel = activeDetailData?.hotel || booking?.hotel;
  const displayBookingId = activeDetailData?.id
    ? `HB-${String(activeDetailData.id).padStart(3, "0")}`
    : "N/A";

  const pnr = pBooking?.pnr || "N/A";

  const firstName = pBooking?.firstName || "";
  const lastName = pBooking?.lastName || "";
  const contactName =
    firstName || lastName ? `${firstName} ${lastName}`.trim() : null;
  const email = pBooking?.email || null;
  const phone = pBooking?.phone || null;

  const hasPax =
    (pBooking?.adults !== undefined && pBooking?.adults !== null) ||
    (pBooking?.children !== undefined && pBooking?.children !== null);
  const adults =
    pBooking?.adults !== undefined && pBooking?.adults !== null
      ? Number(pBooking.adults)
      : 0;
  const children =
    pBooking?.children !== undefined && pBooking?.children !== null
      ? Number(pBooking.children)
      : 0;
  const totalPax = adults + children;

  const rawChildAges =
    (pBooking as any)?.childrenAges ||
    (pBooking as any)?.childAges ||
    (booking as any)?.childrenAges ||
    (booking as any)?.childAges ||
    hotel?.rooms?.flatMap((r: any) => r.childrenAges || []).filter(Boolean) ||
    [];

  const validChildAges: (number | string)[] = Array.isArray(rawChildAges)
    ? rawChildAges.filter(
        (a) =>
          a !== undefined &&
          a !== null &&
          String(a).trim() !== "" &&
          a !== "N/A",
      )
    : [];

  const travelClass = pBooking?.travelClass || null;
  const isBusiness =
    travelClass === "Business" || travelClass === "First Class";

  const notesList = [
    ...(Array.isArray(pBooking?.specialNotes)
      ? pBooking.specialNotes
      : pBooking?.specialNotes
        ? [pBooking.specialNotes]
        : []),
    ...(pBooking?.additionalNotes ? [pBooking.additionalNotes] : []),
    ...(pBooking?.notes ? [pBooking.notes] : []),
  ];
  const notes = notesList.filter(Boolean).join(", ") || "N/A";

  const hotelName = hotel?.hotelName || booking?.hotelName || "N/A";
  const hotelImageUrl = (hotel as any)?.imageUrl || null;

  useEffect(() => {
    setHotelImageError(false);
  }, [hotelImageUrl]);

  const categoryStr = hotel?.category || "";
  const categoryNumMatch = categoryStr.match(/\d+/);
  const parsedCategoryStars = categoryNumMatch
    ? parseInt(categoryNumMatch[0], 10)
    : null;
  const ratingVal = parseFloat(booking?.rating);
  const starCount =
    parsedCategoryStars && !isNaN(parsedCategoryStars)
      ? Math.min(5, Math.max(1, parsedCategoryStars))
      : !isNaN(ratingVal)
        ? Math.min(5, Math.max(1, Math.round(ratingVal)))
        : null;

  const hotelAddress =
    (hotel as any)?.address ||
    (hotel as any)?.hotelAddress ||
    (hotel as any)?.location ||
    booking?.hotelAddress ||
    booking?.address ||
    booking?.location ||
    "N/A";

  const addressParts =
    hotelAddress && hotelAddress !== "N/A"
      ? hotelAddress
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : ["N/A"];

  const hotelWebsite = hotel?.website?.trim() || null;

  const hotelPhones: Array<{ phoneNumber: string; phoneType: string }> =
    (hotel as any)?.contact?.phones || [];
  const phoneByType = (type: string) =>
    hotelPhones.find((p) => p.phoneType === type)?.phoneNumber;

  const frontDeskPhone =
    phoneByType("PHONEHOTEL") ||
    (hotel as any)?.frontDeskPhone ||
    (hotel as any)?.phone ||
    booking?.hotelPhone ||
    "N/A";

  const reservationsPhone =
    phoneByType("PHONEBOOKING") ||
    (hotel as any)?.reservationsPhone ||
    (hotel as any)?.reservationPhone ||
    "N/A";

  const checkInDate = hotel?.checkInDate || booking?.checkInDate || null;
  const checkOutDate = hotel?.checkOutDate || booking?.checkOutDate || null;

  const formatHotelDate = (d?: string | null): string => {
    if (!d) return "";
    try {
      if (/^\d{1,2}\s+[A-Za-z]{3}\s+\d{4}$/.test(d.trim())) return d.trim();
      const parsed = new Date(d);
      if (isNaN(parsed.getTime())) return d;
      return parsed.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return d;
    }
  };

  const formattedCheckIn = formatHotelDate(checkInDate);
  const formattedCheckOut = formatHotelDate(checkOutDate);
  const dateRangeText =
    formattedCheckIn && formattedCheckOut
      ? `Check-in ${formattedCheckIn} · Check-out ${formattedCheckOut}`
      : formattedCheckIn
        ? `Check-in ${formattedCheckIn}`
        : "N/A";

  const rawAmenities =
    hotel?.amenities ||
    (hotel as any)?.facilities ||
    booking?.amenities ||
    (booking as any)?.facilities;

  const amenitiesList: string[] = Array.isArray(rawAmenities)
    ? rawAmenities.filter(Boolean).map(String)
    : typeof rawAmenities === "string"
      ? rawAmenities
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean)
      : [];

  const displayRoomCount =
    hotel?.rooms && hotel.rooms.length > 0
      ? hotel.rooms.length
      : hotel?.totalRooms && Number(hotel.totalRooms) > 0
        ? Number(hotel.totalRooms)
        : booking?.totalRooms && Number(booking.totalRooms) > 0
          ? Number(booking.totalRooms)
          : null;

  const roomCount =
    displayRoomCount || (totalPax > 0 ? Math.ceil(totalPax / 2) : 1);

  const baseRate = isBusiness ? 160 : 120;
  const fallbackHotelCost =
    (Math.ceil((adults + children) / 2) || 1) * baseRate;
  const fallbackDiscount = fallbackHotelCost * 0.1;
  const fallbackTax = fallbackHotelCost * 0.08;

  const hotelCost =
    hotel?.sellingPrice !== undefined
      ? Number(hotel.sellingPrice)
      : hotel?.actualPrice !== undefined
        ? Number(hotel.actualPrice)
        : fallbackHotelCost;

  const discount =
    hotel?.discount !== undefined ? Number(hotel.discount) : fallbackDiscount;

  const tax = hotel?.tax !== undefined ? Number(hotel.tax) : fallbackTax;

  const hotelPayment = hotelCost - discount + tax;

  const platformFeePercentage =
    hotel?.platformFeePercentage !== undefined &&
    hotel?.platformFeePercentage !== null
      ? Number(hotel.platformFeePercentage)
      : PLATFORM_FEE_PERCENT;

  const platformFee =
    hotel?.platformFee !== undefined && hotel?.platformFee !== null
      ? Number(hotel.platformFee)
      : (hotelPayment * platformFeePercentage) / 100;

  const totalPrice =
    hotel?.totalPrice !== undefined && hotel?.totalPrice !== null
      ? Number(hotel.totalPrice)
      : hotelPayment + platformFee;

  const content = (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 z-[100] transition-opacity duration-300",
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none",
        )}
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-[500px] bg-white z-[110] shadow-2xl flex flex-col transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between pl-6 pr-4.5 py-5">
          <div>
            <h2 className="text-[24px] font-semibold text-[#1F2937] font-figtree">
              Hotel Booking Details
            </h2>
            <p className="text-sm text-[#6B7280] font-figtree -mt-0.5">
              {displayBookingId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-6 h-6 text-[#1F2937]" />
          </button>
        </div>

        <div className="w-full" style={{ padding: "0px 24px" }}>
          <div className="h-px bg-[#E5E7EB] w-full" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-hide text-left text-sm">
          {/* Booking Information */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Plane className="w-4 h-4 text-[#475569]" />
              <h3 className="font-semibold text-[14px] uppercase tracking-wider text-[#475569]">
                Booking Information
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-6 pt-1">
              <div>
                <div className="text-gray-500 text-sm mb-1">Booking ID</div>
                <div className="font-semibold text-gray-900 text-sm">
                  {displayBookingId}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-sm mb-1">Travel Class</div>
                <div className="font-medium text-gray-900">
                  <span
                    className={cn(
                      "rounded px-2.5 py-0.5 text-xs font-semibold inline-block capitalize",
                      isBusiness
                        ? "bg-purple-100 text-purple-800"
                        : "bg-gray-100 text-gray-700",
                    )}
                  >
                    {travelClass || "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-[#E5E7EB] w-full" />

          {/* Primary Guest / Contact */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-[#475569]" />
              <h3 className="font-semibold text-[14px] uppercase tracking-wider text-[#475569]">
                Primary Guest / Contact
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-1">
              <div>
                <div className="text-gray-500 text-sm mb-1">Full Name</div>
                <div className="font-medium text-gray-900 text-sm">
                  {contactName || "N/A"}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-sm mb-1">Email Address</div>
                <div className="font-medium text-gray-900 text-sm break-all">
                  {email || "N/A"}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-sm mb-1">Phone Number</div>
                <div className="font-medium text-gray-900 text-sm">
                  {phone || "N/A"}
                </div>
              </div>
            </div>
          </div>

          <div className="h-[0.8px] bg-[#E5E7EB] w-full" />

          {/* Passenger Details */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-[#475569]" />
              <h3 className="font-semibold text-[14px] uppercase tracking-wider text-[#475569]">
                Passenger Details
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-6 pt-1">
              <div>
                <div className="text-lg font-bold text-[#111827] leading-none">
                  {adults}
                </div>
                <div className="text-xs text-gray-500 mt-1">Adults</div>
              </div>
              <div>
                <div className="text-lg font-bold text-[#111827] leading-none">
                  {children}
                </div>
                <div className="text-xs text-gray-500 mt-1">Child</div>
              </div>
            </div>

            {validChildAges.length > 0 && (
              <>
                <div className="h-[0.8px] bg-[#E5E7EB] w-full my-2.5" />
                <div className="flex flex-wrap gap-2">
                  {validChildAges.map((age, idx) => (
                    <div
                      key={idx}
                      className="px-2.5 py-1 bg-white border border-gray-200 rounded-md text-xs text-gray-700 font-medium"
                    >
                      Child {idx + 1}: {age} yrs
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="h-px bg-[#E5E7EB] w-full" />

          {/* Hotel Booking Confirmation */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Building2 className="w-4 h-4 text-[#475569]" />
              <h3 className="font-semibold text-[14px] uppercase tracking-wider text-[#475569]">
                Hotel Booking Confirmation
              </h3>
            </div>
            <div className="bg-[#F8FAFC] rounded-xl border border-gray-100 overflow-hidden">
              {hotelImageUrl && !hotelImageError && (
                <img
                  src={hotelImageUrl}
                  alt={hotelName}
                  className="w-full h-40 object-cover"
                  onError={() => setHotelImageError(true)}
                />
              )}
              <div className="p-4.5 space-y-3.5">
                <div>
                  <div className="font-bold text-[17px] text-[#111827]">
                    {hotelName}
                  </div>
                  {starCount ? (
                    <div className="flex items-center gap-1 text-amber-400 mt-1">
                      {[...Array(starCount)].map((_, i) => (
                        <Star key={i} className="h-3.5 w-3.5 fill-current" />
                      ))}
                      <span className="text-gray-500 text-xs ml-1 font-normal">
                        ({starCount} Star Hotel)
                      </span>
                    </div>
                  ) : (
                    <div className="text-gray-500 text-xs mt-1">N/A</div>
                  )}
                </div>

                <div className="flex items-start gap-2.5 text-gray-600 text-sm">
                  <MapPin className="w-4 h-4 shrink-0 text-gray-400 mt-0.5" />
                  <div className="leading-snug text-gray-700">
                    <div>{addressParts[0]}</div>
                    {addressParts.length > 1 && (
                      <div className="text-gray-500">
                        {addressParts.slice(1).join(", ")}
                      </div>
                    )}
                  </div>
                </div>

                {hotelWebsite && (
                  <div className="flex items-center gap-2.5 text-gray-600 text-sm">
                    <Globe className="w-4 h-4 shrink-0 text-gray-400" />
                    <a
                      href={
                        hotelWebsite.startsWith("http")
                          ? hotelWebsite
                          : `https://${hotelWebsite}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2563EB] hover:text-[#1D4ED8] font-semibold underline inline-flex items-center gap-1"
                    >
                      <span>Visit hotel website</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                )}

                <div className="flex items-center gap-2.5 text-gray-600 text-sm">
                  <Calendar className="w-4 h-4 shrink-0 text-gray-400" />
                  <span>{dateRangeText}</span>
                </div>

                <div className="h-px bg-gray-200/80 w-full" />

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 shrink-0 text-gray-400 mt-1" />
                    <div>
                      <div className="text-[13px] text-gray-500">
                        Front Desk
                      </div>
                      <div className="font-semibold text-gray-900 text-[15px] mt-0.5">
                        {frontDeskPhone}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Phone className="w-4 h-4 shrink-0 text-gray-400 mt-1" />
                    <div>
                      <div className="text-[13px] text-gray-500">
                        Reservations
                      </div>
                      <div className="font-semibold text-gray-900 text-[15px] mt-0.5">
                        {reservationsPhone}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-gray-200/80 w-full" />

                <div>
                  <div className="text-[13px] text-gray-500">
                    Number of Rooms
                  </div>
                  <div className="text-lg text-gray-900 leading-tight mt-1">
                    {displayRoomCount !== null ? displayRoomCount : "N/A"}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-[#E5E7EB] w-full" />

          {/* Room Details */}
          <div>
            <h3 className="font-semibold text-[14px] uppercase tracking-wider text-[#475569] mb-3">
              Room Details
            </h3>
            <div className="space-y-4">
              {Array.from({ length: roomCount }).map((_, i) => {
                const roomData = hotel?.rooms?.[i];
                const roomName =
                  roomData?.roomName ||
                  booking?.roomName ||
                  booking?.roomType ||
                  hotel?.rooms?.[0]?.roomName ||
                  "N/A";
                const guestCount = roomData
                  ? (roomData.adults || 0) + (roomData.children || 0) || 2
                  : 2;
                const guestText = `Up to ${guestCount} Guests`;
                const rPrice =
                  roomData?.price !== undefined
                    ? Number(roomData.price)
                    : baseRate;
                const rDiscount =
                  hotel?.discount !== undefined && roomCount > 0
                    ? Number(hotel.discount) / roomCount
                    : rPrice * 0.1;
                const rTax =
                  hotel?.tax !== undefined && roomCount > 0
                    ? Number(hotel.tax) / roomCount
                    : rPrice * 0.08;
                const rTotal = rPrice - rDiscount + rTax;

                const roomAdults = roomData?.adults ?? adults;
                const roomChildren = roomData?.children ?? children;

                return (
                  <div
                    key={i + 1}
                    className="bg-white border border-gray-200 p-4.5 rounded-xl"
                  >
                    <div className="flex items-center gap-2 font-semibold text-[#1F2937] text-[15px]">
                      <BedDouble className="w-4 h-4 text-[#475569] shrink-0" />
                      <span>
                        Room {i + 1} — {roomName}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-2.5">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-full text-xs text-gray-700 font-normal">
                        <Users className="w-3.5 h-3.5 text-gray-500" />
                        <span>
                          {roomAdults} {roomAdults === 1 ? "Adult" : "Adults"}
                        </span>
                      </div>
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white border border-gray-200 rounded-full text-xs text-gray-700 font-normal">
                        <span>
                          {roomChildren}{" "}
                          {roomChildren === 1 ? "Child" : "Children"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between items-center text-gray-500">
                        <span>1 Room × ${rPrice.toFixed(2)}</span>
                        <span className="text-gray-900 font-normal">
                          ${rPrice.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-gray-500">
                        <span>Platform Discount</span>
                        <span className="text-emerald-600 font-normal">
                          -${rDiscount.toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-gray-500">
                        <span>Hotel Tax</span>
                        <span className="text-gray-900 font-normal">
                          ${rTax.toFixed(2)}
                        </span>
                      </div>
                      <div className="pt-2.5 mt-2.5 border-t border-gray-200/80 flex justify-between items-center">
                        <span className="font-bold text-gray-900 text-sm">
                          Room Total
                        </span>
                        <span className="font-bold text-gray-900 text-sm">
                          ${rTotal.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="h-px bg-[#E5E7EB] w-full" />

          {/* Cost Breakdown */}
          <div>
            <h3 className="font-semibold text-[14px] uppercase tracking-wider text-[#475569] mb-3">
              Cost Breakdown
            </h3>
            <div className="bg-white border border-gray-200 p-5 rounded-xl space-y-3">
              <div className="flex justify-between items-center text-gray-600 text-sm">
                <span>Hotel Cost</span>
                <span className="text-gray-900 font-medium">
                  ${hotelCost.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-600 text-sm">
                <span>Platform Discount</span>
                <span className="font-medium text-green-600">
                  -${discount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-600 text-sm">
                <span>Hotel Tax</span>
                <span className="text-gray-900 font-medium">
                  ${tax.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-900 font-semibold pt-2.5 border-t border-gray-100 text-sm">
                <span>Hotel Payment</span>
                <span>${hotelPayment.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-500 text-sm pt-0.5">
                <span>
                  Platform Fee ({platformFeePercentage}% of hotel payment)
                </span>
                <span>
                  {typeof platformFee === "number"
                    ? `$${platformFee.toFixed(2)}`
                    : platformFee}
                </span>
              </div>
              <div className="flex justify-between items-center text-[15px] font-bold text-gray-900 pt-3 border-t border-gray-100 mt-1">
                <span>Total Payment</span>
                <span className="text-[18px] font-bold text-emerald-600">
                  {typeof totalPrice === "number"
                    ? `$${totalPrice.toFixed(2)}`
                    : totalPrice}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer with Download PDF button */}
        <div className="p-4 border-t border-gray-200 bg-white">
          <button
            type="button"
            onClick={() => {
              window.print();
            }}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#0F2757] hover:bg-[#162259] text-white text-sm font-semibold rounded-xl shadow-sm transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>Download PDF</span>
          </button>
        </div>
      </div>
    </>
  );

  if (!mounted) return null;

  return createPortal(content, document.body);
}
