"use client";

import { X, Star, Calendar, Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  cancellationService,
  HotelBookingDetailDataDto,
} from "@/src/services/cancellation.service";

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
  const [internalDetailData, setInternalDetailData] = useState<HotelBookingDetailDataDto | null>(null);

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
  const hotel = activeDetailData?.hotel;

  const displayBookingId =
    hotel?.bookingReference ||
    (activeDetailData?.id ? `HB-${String(activeDetailData.id).padStart(6, "0")}` : null) ||
    booking?.hotelBookingId ||
    "Not Available";

  const pnr = pBooking?.pnr || "Not Available";

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
  const notes = notesList.filter(Boolean).join(", ") || "Not Available";

  const hotelName = hotel?.hotelName || booking?.hotelName || "Not Available";

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
        : isBusiness
          ? 4
          : 3;

  const hotelAddress =
    booking?.hotelAddress ||
    booking?.address ||
    (hotel?.hotelCode
      ? `${hotel.hotelName || "Hotel"}, ${hotel.hotelCode}`
      : "Not Available");

  const checkInDate = hotel?.checkInDate || booking?.checkInDate || null;
  const checkOutDate = hotel?.checkOutDate || booking?.checkOutDate || null;

  const dateRangeText =
    checkInDate && checkOutDate
      ? `Check-in ${checkInDate} · Check-out ${checkOutDate}`
      : checkInDate
        ? `Check-in ${checkInDate}`
        : "Not Available";

  const rawAmenities =
    hotel?.amenities ||
    (hotel as any)?.facilities ||
    booking?.amenities ||
    (booking as any)?.facilities;

  const amenitiesList: string[] = Array.isArray(rawAmenities)
    ? rawAmenities.filter(Boolean).map(String)
    : typeof rawAmenities === "string"
      ? rawAmenities.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];

  const roomCount =
    hotel?.rooms && hotel.rooms.length > 0
      ? hotel.rooms.length
      : hotel?.totalRooms && Number(hotel.totalRooms) > 0
        ? Number(hotel.totalRooms)
        : booking?.totalRooms && Number(booking.totalRooms) > 0
          ? Number(booking.totalRooms)
          : totalPax > 0
            ? Math.ceil(totalPax / 2)
            : 1;

  const baseRate = isBusiness ? 160 : 120;
  const fallbackHotelCost = (Math.ceil((adults + children) / 2) || 1) * baseRate;
  const fallbackDiscount = fallbackHotelCost * 0.1;
  const fallbackTax = fallbackHotelCost * 0.08;

  const hotelCost =
    hotel?.sellingPrice !== undefined
      ? Number(hotel.sellingPrice)
      : hotel?.actualPrice !== undefined
        ? Number(hotel.actualPrice)
        : fallbackHotelCost;

  const discount =
    hotel?.discount !== undefined
      ? Number(hotel.discount)
      : fallbackDiscount;

  const tax =
    hotel?.tax !== undefined ? Number(hotel.tax) : fallbackTax;

  const hotelPayment = hotelCost - discount + tax;

  const platformFee =
    hotel?.platformFee !== undefined
      ? Number(hotel.platformFee)
      : hotelPayment * 0.05;

  const totalPrice =
    hotel?.totalPrice !== undefined
      ? Number(hotel.totalPrice)
      : hotelPayment + platformFee;

  const content = (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 z-[100] transition-opacity duration-300",
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-[500px] bg-white z-[110] shadow-2xl flex flex-col transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
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
        <div className="flex-1 overflow-y-auto px-6 py-7 space-y-8 scrollbar-hide text-left text-sm">

          {/* Booking Information */}
          <div>
                <h1 className="font-semibold text-base text-gray-900 mb-1 pb-2">Booking Information</h1>
            <div className="space-y-3">
              <div className="flex justify-between items-start gap-4">
                <span className="text-gray-500">Hotel Booking ID</span>
                <span className="font-medium text-gray-900 text-right">
                  {displayBookingId}
                </span>
              </div>
              <div className="flex justify-between items-start gap-4">
                <span className="text-gray-500">PNR</span>
                <span className="font-medium text-gray-900 uppercase text-right">
                  {pnr}
                </span>
              </div>
              <div className="flex justify-between items-start gap-4">
                <span className="text-gray-500">Contact</span>
                <div className="text-gray-900 text-right">
                  <div className="font-medium">{contactName || "Not Available"}</div>
                  <div className="text-gray-500 mt-0.5">{email || "Not Available"}</div>
                  <div className="text-gray-500 mt-0.5">{phone || "Not Available"}</div>
                </div>
              </div>
              <div className="flex justify-between items-start gap-4">
                <span className="text-gray-500">Passengers</span>
                <span className="font-medium text-gray-900 text-right">
                  {hasPax
                    ? `${totalPax} ${totalPax === 1 ? "Passenger" : "Passengers"} · ${adults} ${adults === 1 ? "Adult" : "Adults"}, ${children} ${children === 1 ? "Child" : "Children"}`
                    : "Not Available"}
                </span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-gray-500">Class</span>
                <span className="font-medium text-gray-900 capitalize bg-gray-100 px-2 py-0.5 rounded inline-flex w-fit">
                  {travelClass ? `${travelClass} class` : "Not Available"}
                </span>
              </div>
              <div className="flex justify-between items-start gap-4">
                <span className="text-gray-500">Special Notes</span>
                <span className="text-gray-900 text-right">{notes}</span>
              </div>
            </div>
          </div>

          {/* Hotel Information */}
          <div>
            <h3 className="font-semibold text-base text-gray-900 mb-1 pb-2">Hotel Information</h3>
            <div className="bg-[#F8FAFC] p-4 rounded-xl space-y-3 border border-gray-100">
              <div>
                <div className="font-semibold text-base text-gray-900">
                  {hotelName}
                </div>
                <div className="flex text-amber-400 mt-1">
                  {[...Array(starCount)].map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-current" />
                  ))}
                </div>
              </div>
              <div className="text-gray-600">
                {hotelAddress}
              </div>
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
                <span>
                  {dateRangeText}
                </span>
              </div>
              {amenitiesList.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {amenitiesList.map((amenity, idx) => {
                    const lower = amenity.toLowerCase();
                    const isShuttle =
                      lower.includes("shuttle") ||
                      lower.includes("transport") ||
                      lower.includes("airport");
                    return (
                      <span
                        key={idx}
                        className={cn(
                          "border px-2 py-1 rounded text-xs font-medium",
                          isShuttle
                            ? "bg-blue-50 text-blue-700 border-blue-100"
                            : "bg-emerald-50 text-emerald-700 border-emerald-100",
                        )}
                      >
                        {amenity}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Room Details */}
          <div>
            <h3 className="font-semibold text-base text-gray-900 mb-1 pb-2">Room Details</h3>
            <div className="space-y-4">
              {Array.from({ length: roomCount }).map((_, i) => {
                const roomData = hotel?.rooms?.[i];
                const roomName =
                  roomData?.roomName ||
                  booking?.roomName ||
                  booking?.roomType ||
                  (hotel?.rooms?.[0]?.roomName) ||
                  "Not Available";
                // const guestText = roomData
                //   ? `Up to ${(roomData.adults || 0) + (roomData.children || 0)} Guests${roomData.boardName ? ` · ${roomData.boardName}` : ""}`
                //   : "Up to 2 Guests";
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

                return (
                  <div key={i + 1} className="bg-white border border-gray-200 p-4 rounded-xl">
                    <div className="font-semibold text-gray-900">
                      Room {i + 1} — {roomName}
                    </div>
                    {/* <div className="text-xs text-gray-500 mt-0.5">{guestText}</div> */}
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex justify-between items-center text-gray-600">
                        <span>1 Room × ${rPrice.toFixed(2)}</span>
                        <span className="font-medium text-gray-900">${rPrice.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-gray-600">
                        <span>Platform Discount</span>
                        <span className="font-medium text-green-600">-${rDiscount.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between items-center text-gray-600">
                        <span>Hotel Tax</span>
                        <span className="font-medium text-gray-900">${rTax.toFixed(2)}</span>
                      </div>
                      <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between items-center font-semibold text-gray-900 text-sm">
                        <span>Room Total</span>
                        <span>${rTotal.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pricing Summary */}
          <div>
            <h3 className="font-semibold text-base text-gray-900 mb-1 pb-2">Pricing Summary</h3>
            <div className="bg-white border border-gray-200 p-5 rounded-xl space-y-3">
              <div className="flex justify-between items-center text-gray-600">
                <span>Hotel Cost</span>
                <span className="text-gray-900 font-medium">
                  ${hotelCost.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Platform Discount</span>
                <span className="font-medium text-green-600">
                  -${discount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Hotel Tax</span>
                <span className="text-gray-900 font-medium">
                  ${tax.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-900 font-semibold pt-2 border-t border-gray-100 mt-1 text-sm">
                <span>Hotel Payment</span>
                <span>
                  ${hotelPayment.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-500 text-sm pt-1">
                <span>Platform Fee (5% of hotel payment)</span>
                <span>
                  ${platformFee.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm font-semibold text-gray-900 pt-2 border-t border-gray-100 mt-1">
                <span>Total Payment</span>
                <span>
                  ${totalPrice.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );

  if (!mounted) return null;

  return createPortal(content, document.body);
}
