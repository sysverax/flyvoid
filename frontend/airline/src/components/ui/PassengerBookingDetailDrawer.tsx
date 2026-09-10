"use client";

import { X, User, Users, Armchair, FileText } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export interface PassengerBookingDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  booking?: any | null;
}

export function PassengerBookingDetailDrawer({
  isOpen,
  onClose,
  booking,
}: PassengerBookingDetailDrawerProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const pnr = booking?.pnr || "Not Available";
  const firstName = booking?.firstName || "";
  const lastName = booking?.lastName || "";
  const contactName =
    firstName || lastName ? `${firstName} ${lastName}`.trim() : null;
  const email = booking?.email || null;
  const phone = booking?.phone || null;
  const adults =
    booking?.adults !== undefined && booking?.adults !== null
      ? Number(booking.adults)
      : 0;
  const children =
    booking?.children !== undefined && booking?.children !== null
      ? Number(booking.children)
      : 0;
  const travelClass = booking?.travelClass || null;
  const isBusiness =
    travelClass === "Business" || travelClass === "First Class";

  const rawNotes: string[] = [
    ...(Array.isArray(booking?.tags) ? booking.tags : []),
    ...(Array.isArray(booking?.specialNotes) ? booking.specialNotes : []),
    ...(booking?.additionalNotes ? [booking.additionalNotes] : []),
    ...(booking?.notes ? [booking.notes] : []),
  ].filter(Boolean);

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
              Booking Details
            </h2>
            <p className="text-sm text-[#6B7280] font-figtree -mt-0.5">
              {pnr}
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
          {/* Contact */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-[#475569]" />
              <h3 className="font-semibold text-[14px] uppercase tracking-wider text-[#475569]">
                Contact
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 pt-1">
              <div>
                <div className="text-gray-500 text-sm mb-1">Full Name</div>
                <div className="font-medium text-gray-900 text-sm">
                  {contactName || "Not Available"}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-sm mb-1">Email Address</div>
                <div className="font-medium text-gray-900 text-sm break-all">
                  {email || "Not Available"}
                </div>
              </div>
              <div>
                <div className="text-gray-500 text-sm mb-1">Phone Number</div>
                <div className="font-medium text-gray-900 text-sm">
                  {phone || "Not Available"}
                </div>
              </div>
            </div>
          </div>

          <div className="h-px bg-[#E5E7EB] w-full" />

          {/* Passengers */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-[#475569]" />
              <h3 className="font-semibold text-[14px] uppercase tracking-wider text-[#475569]">
                Passengers
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-6 pt-1">
              <div>
                <div className="font-medium text-gray-900 text-[15px]">
                  {adults}
                </div>
                <div className="text-gray-500 text-sm mt-0.5">Adults</div>
              </div>
              <div>
                <div className="font-medium text-gray-900 text-[15px]">
                  {children}
                </div>
                <div className="text-gray-500 text-sm mt-0.5">Child</div>
              </div>
            </div>
          </div>

          <div className="h-px bg-[#E5E7EB] w-full" />

          {/* Travel Class */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Armchair className="w-4 h-4 text-[#475569]" />
              <h3 className="font-semibold text-[14px] uppercase tracking-wider text-[#475569]">
                Travel Class
              </h3>
            </div>
            <div className="pt-1">
              <span
                className={cn(
                  "rounded px-2.5 py-0.5 text-xs font-semibold inline-block capitalize",
                  isBusiness
                    ? "bg-purple-100 text-purple-800"
                    : "bg-gray-100 text-gray-700",
                )}
              >
                {travelClass || "Not Available"}
              </span>
            </div>
          </div>

          <div className="h-px bg-[#E5E7EB] w-full" />

          {/* Special Notes */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-[#475569]" />
              <h3 className="font-semibold text-[14px] uppercase tracking-wider text-[#475569]">
                Special Notes
              </h3>
            </div>
            <div className="space-y-2 pt-1">
              {rawNotes.length > 0 ? (
                rawNotes.map((note, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 text-sm text-[#1F2937]"
                  >
                    <FileText className="w-4 h-4 text-[#475569] shrink-0 mt-0.5" />
                    <span>{note}</span>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-sm">
                  Not Available
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (!mounted) return null;
  return createPortal(content, document.body);
}
