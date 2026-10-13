"use client";

import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { cn } from "@/src/lib/utils";
import { AdminBookingItem } from "@/src/app/bookings/page";

export interface BookingDetailData extends AdminBookingItem {
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

interface BookingDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: BookingDetailData | null;
}

export function BookingDetailModal({
  isOpen,
  onClose,
  booking,
}: BookingDetailModalProps) {
  const [activeTab, setActiveTab] = useState<"details" | "debug">("details");
  useLockBodyScroll(isOpen);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
    if (isOpen) {
      setActiveTab("details");
    }
  }, [isOpen]);

  if (!booking) return null;

  const fmt = (n?: number) => {
    if (n === undefined || n === null) return "$0.00";
    return `$${n.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  // Derive breakdown values if not explicitly provided
  const hotelCost =
    booking.hotelCost !== undefined
      ? booking.hotelCost
      : Math.round(booking.totalCost * 0.89);
  const hotelTax =
    booking.hotelTax !== undefined
      ? booking.hotelTax
      : Math.round(booking.totalCost * 0.11);
  const platformFee =
    booking.platformFee !== undefined
      ? booking.platformFee
      : Math.round(booking.earnings * 0.38);
  const hotelCommission =
    booking.hotelCommission !== undefined
      ? booking.hotelCommission
      : Math.round(booking.earnings * 0.62);
  const discount =
    booking.discount !== undefined
      ? booking.discount
      : Math.round(booking.earnings * 0.38);
  const flightId = booking.flightId ?? booking.airlineId ?? 1;
  const flightNumber =
    booking.flightNumber ??
    `SKY${1230 + (typeof booking.airlineId === "number" ? booking.airlineId : 4)}`;
  const arrival = booking.arrival ?? (booking.departure === "JFK" ? "LAX" : "JFK");
  const scheduled = booking.scheduled ?? "2/1/2025, 5:30:00 AM";

  const requestId =
    booking.requestId ?? "444dd18c-1e5c-4d3a-a2c5-36229b869e60";
  const vendorBookingStatus =
    booking.vendorBookingStatus ??
    (booking.status === "Pending"
      ? "ON_REQUEST"
      : booking.status === "Confirmed"
        ? "CONFIRMED"
        : booking.status === "Completed"
          ? "COMPLETED"
          : "CANCELLED");
  const vendorReference =
    booking.vendorReference ??
    `B00-${2663670 + Number(booking.id.replace(/\D/g, "") || 1)}`;
  const transferReference =
    booking.transferReference ?? "61945ffd-0051-4521-a66c-d2f2ce8f6925";
  const completedAt = booking.completedAt ?? "—";
  const failedAt = booking.failedAt ?? "—";
  const failureReason = booking.failureReason ?? "—";

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200",
        isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      )}
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 transition-opacity"
        onClick={onClose}
      />

      {/* Centered Modal Dialog */}
      <div
        className={cn(
          "relative z-10 w-full max-w-[640px] max-h-[90vh] overflow-hidden rounded-[20px] bg-[#F6F7F8] shadow-2xl border border-[#E2E8F0] flex flex-col my-auto transition-transform duration-200",
          isOpen ? "scale-100" : "scale-95"
        )}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-[20px] font-bold text-[#0F172A] tracking-tight">
                {booking.bookingId}
              </h2>
              <StatusBadge status={booking.status} />
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-[#64748B] hover:text-[#0F172A] transition-colors p-1 rounded-md cursor-pointer"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex rounded-[10px] bg-[#EEEFF1] p-1 gap-1">
            <button
              onClick={() => setActiveTab("details")}
              className={cn(
                "flex-1 py-2 text-center text-[14px] rounded-[8px] transition-all cursor-pointer font-medium",
                activeTab === "details"
                  ? "bg-[#F6F7F8] text-[#0F172A] shadow-sm font-semibold"
                  : "text-[#64748B] hover:text-[#0F172A]"
              )}
            >
              Details
            </button>
            <button
              onClick={() => setActiveTab("debug")}
              className={cn(
                "flex-1 py-2 text-center text-[14px] rounded-[8px] transition-all cursor-pointer font-medium",
                activeTab === "debug"
                  ? "bg-[#F6F7F8] text-[#0F172A] shadow-sm font-semibold"
                  : "text-[#64748B] hover:text-[#0F172A]"
              )}
            >
              Technical &amp; Debug
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-6 pb-6 space-y-4"
        >
          {activeTab === "details" ? (
            <>
              {/* Card 1: Booking */}
              <div className="rounded-[14px] border border-[#E2E8F0] bg-[#F6F7F8] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <h3 className="text-[17px] font-semibold text-[#0F172A] mb-3 font-figtree">
                  Booking
                </h3>
                <div className="flex flex-col">
                  <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                    <span className="text-[#64748B]">Airline</span>
                    <span className="font-semibold text-[#0F172A]">
                      {booking.airlineName} ({booking.airlineId})
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                    <span className="text-[#64748B]">Vendor</span>
                    <span className="font-semibold text-[#0F172A]">
                      {booking.vendor}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                    <span className="text-[#64748B]">Hotel</span>
                    <span className="font-semibold text-[#0F172A]">
                      {booking.hotel}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                    <span className="text-[#64748B]">Passengers / Rooms</span>
                    <span className="font-semibold text-[#0F172A]">
                      {booking.passengers} / {booking.rooms}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-[14px]">
                    <span className="text-[#64748B]">Status</span>
                    <StatusBadge status={booking.status} />
                  </div>
                </div>
              </div>

              {/* Card 2: Cost Breakdown */}
              <div className="rounded-[14px] border border-[#E2E8F0] bg-[#F6F7F8] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <h3 className="text-[17px] font-semibold text-[#0F172A] mb-3 font-figtree">
                  Cost Breakdown
                </h3>
                <div className="flex flex-col">
                  <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                    <span className="text-[#64748B]">Hotel Cost</span>
                    <span className="font-semibold text-[#0F172A]">
                      {fmt(hotelCost)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                    <span className="text-[#64748B]">Hotel Tax</span>
                    <span className="font-semibold text-[#0F172A]">
                      {fmt(hotelTax)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                    <span className="text-[#64748B]">Platform Fee</span>
                    <span className="font-semibold text-[#0F172A]">
                      {fmt(platformFee)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                    <span className="text-[#64748B]">Hotel Commission</span>
                    <span className="font-semibold text-[#0F172A]">
                      {fmt(hotelCommission)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                    <span className="text-[#64748B]">Discount</span>
                    <span className="font-semibold text-[#DC2626]">
                      - {fmt(discount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                    <span className="text-[#64748B]">Total Cost</span>
                    <span className="font-semibold text-[#0F172A]">
                      {fmt(booking.totalCost)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-[14px]">
                    <span className="text-[#64748B]">Earnings</span>
                    <span className="font-semibold text-[#16A34A]">
                      {fmt(booking.earnings)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 3: Flight Detail */}
              <div className="rounded-[14px] border border-[#E2E8F0] bg-[#F6F7F8] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
                <h3 className="text-[17px] font-semibold text-[#0F172A] mb-3 font-figtree">
                  Flight Detail
                </h3>
                <div className="flex flex-col">
                  <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                    <span className="text-[#64748B]">Flight ID</span>
                    <span className="text-[#0F172A]">{flightId}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                    <span className="text-[#64748B]">Flight Number</span>
                    <span className="text-[#0F172A]">{flightNumber}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                    <span className="text-[#64748B]">Departure</span>
                    <span className="text-[#0F172A]">{booking.departure}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                    <span className="text-[#64748B]">Arrival</span>
                    <span className="text-[#0F172A]">{arrival}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 text-[14px]">
                    <span className="text-[#64748B]">Scheduled</span>
                    <span className="text-[#0F172A]">{scheduled}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* Technical & Debug Tab */
            <div className="rounded-[14px] border border-[#E2E8F0] bg-[#F6F7F8] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
              <div className="flex flex-col">
                <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                  <span className="text-[#64748B]">Request ID</span>
                  <span className="font-mono text-[13px] text-[#0F172A] select-all">
                    {requestId}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                  <span className="text-[#64748B]">Vendor</span>
                  <span className="font-semibold text-[#0F172A]">
                    {booking.vendor}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                  <span className="text-[#64748B]">Vendor Booking Status</span>
                  <span className="text-[#0F172A]">{vendorBookingStatus}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                  <span className="text-[#64748B]">Vendor Reference</span>
                  <span className="text-[#0F172A]">{vendorReference}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                  <span className="text-[#64748B]">Transfer Reference</span>
                  <span className="font-mono text-[13px] text-[#0F172A] select-all">
                    {transferReference}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                  <span className="text-[#64748B]">Completed At</span>
                  <span className="text-[#0F172A]">{completedAt}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 text-[14px] border-b border-[#E5E7EB]">
                  <span className="text-[#64748B]">Failed At</span>
                  <span className="text-[#0F172A]">{failedAt}</span>
                </div>
                <div className="flex items-center justify-between py-2.5 text-[14px]">
                  <span className="text-[#64748B]">Failure Reason</span>
                  <span className="text-[#0F172A]">{failureReason}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
