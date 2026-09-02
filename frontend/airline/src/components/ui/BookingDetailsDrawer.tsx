"use client";

import { X, Star, Calendar } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface BookingDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  booking?: any;
}

export function BookingDetailsDrawer({
  isOpen,
  onClose,
  booking
}: BookingDetailsDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
              HB-000234
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
                <span className="font-medium text-gray-900 text-right">HB-000234</span>
              </div>
              <div className="flex justify-between items-start gap-4">
                <span className="text-gray-500">PNR</span>
                <span className="font-medium text-gray-900 uppercase text-right">{booking?.pnr || "ANIM DOLOR CUM ADIPI"}</span>
              </div>
              <div className="flex justify-between items-start gap-4">
                <span className="text-gray-500">Contact</span>
                <div className="text-gray-900 text-right">
                  <div className="font-medium">{booking?.firstName || "Hedwig"} {booking?.lastName || "Preston"}</div>
                  <div className="text-gray-500 mt-0.5">{booking?.email || "gypobyj@mailinator.com"}</div>
                  <div className="text-gray-500 mt-0.5">{booking?.phone || "+1 (255) 751-1596"}</div>
                </div>
              </div>
              <div className="flex justify-between items-start gap-4">
                <span className="text-gray-500">Passengers</span>
                <span className="font-medium text-gray-900 text-right">
                  {(booking?.adults || 0) + (booking?.children || 0) || 9} Passengers · {booking?.adults || 4} Adults, {booking?.children || 5} Children
                </span>
              </div>
              <div className="flex justify-between items-center gap-4">
                <span className="text-gray-500">Class</span>
                <span className="font-medium text-gray-900 capitalize bg-gray-100 px-2 py-0.5 rounded inline-flex w-fit">{booking?.travelClass || "economy"} class</span>
              </div>
              <div className="flex justify-between items-start gap-4">
                <span className="text-gray-500">Special Notes</span>
                <span className="text-gray-900 text-right">{booking?.notes || "Odit velit incidunt"}</span>
              </div>
            </div>
          </div>

          {/* Hotel Information */}
          <div>
            <h3 className="font-semibold text-base text-gray-900 mb-1 pb-2">Hotel Information</h3>
            <div className="bg-[#F8FAFC] p-4 rounded-xl space-y-3 border border-gray-100">
              <div>
                <div className="font-sem text-base text-gray-900">
                  {booking?.travelClass === "Business" || booking?.travelClass === "First Class" ? "Hyatt Regency LAX" : "Holiday Inn Express LAX"}
                </div>
                <div className="flex text-amber-400 mt-1">
                  {[...Array(booking?.travelClass === "Business" || booking?.travelClass === "First Class" ? 4 : 3)].map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-current" />
                  ))}
                </div>
              </div>
              <div className="text-gray-600">8620 Airport Blvd, Los Angeles</div>
              <div className="flex items-center gap-2 text-gray-600">
                <Calendar className="h-4 w-4 shrink-0 text-gray-400" />
                <span>Check-in 27 Jun 2009 · Check-out 02 Mar 2021</span>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded text-xs font-medium">Free WiFi</span>
                <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-1 rounded text-xs font-medium">Free Breakfast</span>
                <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2 py-1 rounded text-xs font-medium">Airport Shuttle</span>
              </div>
            </div>
          </div>

          {/* Room Details */}
          <div>
            <h3 className="font-semibold text-base text-gray-900 mb-1 pb-2">Room Details</h3>
            <div className="space-y-4">
              {Array.from({ length: Math.ceil(((booking?.adults || 0) + (booking?.children || 0)) / 2) || 1 }).map((_, i) => (
                <div key={i + 1} className="bg-white border border-gray-200 p-4 rounded-xl">
                  <div className="font-semibold text-gray-900">Room {i + 1} — Standard Twin Room</div>
                  <div className="text-xs text-gray-500 mt-0.5">Up to 2 Guests</div>
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex justify-between items-center text-gray-600">
                      <span>1 Room × ${(booking?.travelClass === "Business" || booking?.travelClass === "First Class" ? 160 : 120).toFixed(2)}</span>
                      <span className="font-medium text-gray-900">${(booking?.travelClass === "Business" || booking?.travelClass === "First Class" ? 160 : 120).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600">
                      <span>Platform Discount</span>
                      <span className="font-medium text-green-600">-${((booking?.travelClass === "Business" || booking?.travelClass === "First Class" ? 160 : 120) * 0.1).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-center text-gray-600">
                      <span>Hotel Tax</span>
                      <span className="font-medium text-gray-900">${((booking?.travelClass === "Business" || booking?.travelClass === "First Class" ? 160 : 120) * 0.08).toFixed(2)}</span>
                    </div>
                    <div className="pt-2 mt-2 border-t border-gray-100 flex justify-between items-center font-semibold text-gray-900 text-sm">
                      <span>Room Total</span>
                      <span>${((booking?.travelClass === "Business" || booking?.travelClass === "First Class" ? 160 : 120) * 0.98).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Summary */}
          <div>
            <h3 className="font-semibold text-base text-gray-900 mb-1 pb-2">Pricing Summary</h3>
            <div className="bg-white border border-gray-200 p-5 rounded-xl space-y-3">
              <div className="flex justify-between items-center text-gray-600">
                <span>Hotel Cost</span>
                <span className="text-gray-900 font-medium">
                  ${((Math.ceil(((booking?.adults || 0) + (booking?.children || 0)) / 2) || 1) * (booking?.travelClass === "Business" || booking?.travelClass === "First Class" ? 160 : 120)).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Platform Discount</span>
                <span className="font-medium text-green-600">
                  -${((Math.ceil(((booking?.adults || 0) + (booking?.children || 0)) / 2) || 1) * (booking?.travelClass === "Business" || booking?.travelClass === "First Class" ? 160 : 120) * 0.1).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Hotel Tax</span>
                <span className="text-gray-900 font-medium">
                  ${((Math.ceil(((booking?.adults || 0) + (booking?.children || 0)) / 2) || 1) * (booking?.travelClass === "Business" || booking?.travelClass === "First Class" ? 160 : 120) * 0.08).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-900 font-semibold pt-2 border-t border-gray-100 mt-1 text-sm">
                <span>Hotel Payment</span>
                <span>
                  ${((Math.ceil(((booking?.adults || 0) + (booking?.children || 0)) / 2) || 1) * (booking?.travelClass === "Business" || booking?.travelClass === "First Class" ? 160 : 120) * 0.98).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-500 text-sm pt-1">
                <span>Platform Fee (5% of hotel payment)</span>
                <span>
                  ${(((Math.ceil(((booking?.adults || 0) + (booking?.children || 0)) / 2) || 1) * (booking?.travelClass === "Business" || booking?.travelClass === "First Class" ? 160 : 120) * 0.98) * 0.05).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center text-sm font-semibold text-gray-900 pt-2 border-t border-gray-100 mt-1">
                <span>Total Payment</span>
                <span>
                  ${(((Math.ceil(((booking?.adults || 0) + (booking?.children || 0)) / 2) || 1) * (booking?.travelClass === "Business" || booking?.travelClass === "First Class" ? 160 : 120) * 0.98) * 1.05).toFixed(2)}
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
