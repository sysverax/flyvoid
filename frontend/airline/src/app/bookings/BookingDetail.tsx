"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Printer,
  Download,
  Mail,
  MapPin,
  Phone,
  Star,
} from "lucide-react";
import { toast } from "react-toastify";
import { Booking } from "./page";

interface BookingDetailProps {
  booking: Booking;
  onClose: () => void;
}

export default function BookingDetail({ booking, onClose }: BookingDetailProps) {
  return (
    <div className="space-y-[19px] animate-fadeIn font-figtree">
      {/* Back button */}
      <button
        onClick={onClose}
        className="relative -top-1 flex items-center gap-1.5 text-[16px] text-[#6B7280] hover:text-[#1F2937] transition-colors duration-150 font-medium group cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        <span>Back to Bookings</span>
      </button>

      {/* Profile Header */}
      <div className="self-stretch flex justify-between items-center relative -top-1">
        <div className="flex flex-col justify-start items-start">
          <div className="flex justify-start items-center gap-2">
            <h1 className="text-gray-800 text-2xl font-semibold font-figtree">
              Booking {booking.id}
            </h1>
          </div>
          <div className="text-gray-500 text-sm font-normal font-figtree mt-1">
            Flight: {booking.flight}
          </div>
        </div>

        <div className="flex gap-3">
          <button 
            className="px-4 py-[13px] bg-white border border-gray-200 rounded-[10px] flex justify-center items-center gap-2 hover:bg-gray-50 transition-colors text-gray-700 text-base font-medium font-figtree cursor-pointer shrink-0"
            onClick={() => toast.success("Printing confirmation...")}
          >
            <Printer className="h-5 w-5" />
            <span>Print</span>
          </button>
          <button 
            className="px-4 py-[13px] bg-white border border-gray-200 rounded-[10px] flex justify-center items-center gap-2 hover:bg-gray-50 transition-colors text-gray-700 text-base font-medium font-figtree cursor-pointer shrink-0"
            onClick={() => toast.success("PDF downloaded")}
          >
            <Download className="h-5 w-5" />
            <span>Download PDF</span>
          </button>
          <button 
            className="px-4 py-[13px] bg-[#0F2757] rounded-[10px] flex justify-center items-center gap-2 overflow-hidden hover:bg-[#1A3B75] transition-colors text-white text-base font-medium font-figtree cursor-pointer shrink-0"
            onClick={() => toast.success("Email sent to " + booking.contactEmail)}
          >
            <Mail className="h-5 w-5" />
            <span>Resend Email</span>
          </button>
        </div>
      </div>

      {/* Confirmation Warning Banner */}
      <div className="self-stretch relative top-[9px] pb-4 px-6 pt-3 bg-emerald-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-emerald-200 flex justify-start items-center gap-2.5">
        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
        <span className="text-emerald-700 text-sm font-medium font-figtree">
          This booking is confirmed. Please present this confirmation at hotel check-in. A valid photo ID is required.
        </span>
      </div>

      {/* Row 1: Booking Information & Primary Guest */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 mt-3">
        {/* Booking Information Card */}
        <div className="self-stretch p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-6">
          <div className="self-stretch justify-start text-gray-800 text-xl font-semibold font-figtree -mt-1">
            Booking Information
          </div>
          <div className="self-stretch flex flex-col justify-start items-start gap-4">
            <div className="self-stretch flex justify-between items-center h-[22px] -mt-[2px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">Booking ID</div>
              <div className="text-gray-800 text-lg font-medium font-figtree">{booking.id}</div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">Flight Number</div>
              <div className="text-gray-800 text-lg font-medium font-figtree">{booking.flight}</div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">Departure Airport</div>
              <div className="text-gray-800 text-lg font-medium font-figtree">{booking.departure}</div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">Booking Date</div>
              <div className="text-gray-800 text-lg font-medium font-figtree">January 15, 2024 at 01:30 PM</div>
            </div>
          </div>
        </div>

        {/* Primary Guest Card */}
        <div className="self-stretch p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-6">
          <div className="self-stretch justify-start text-gray-800 text-xl font-semibold font-figtree -mt-1">
            Primary Guest / Contact
          </div>
          <div className="self-stretch flex flex-col justify-start items-start gap-4 -mt-0.5">
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">Full Name</div>
              <div className="text-gray-800 text-lg font-medium font-figtree">John Doe</div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">Email Address</div>
              <div className="text-gray-800 text-lg font-medium font-figtree">{booking.contactEmail}</div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">Phone Number</div>
              <div className="text-gray-800 text-lg font-medium font-figtree">+1 5551234567</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Hotel Details & Passenger Details */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Hotel Details Card */}
        <div className="self-stretch p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-6 -mt-[1px]">
          <div className="self-stretch justify-start text-gray-800 text-xl font-semibold font-figtree">
            Hotel Details
          </div>
          <div className="self-stretch flex flex-col justify-start items-start gap-4 -mt-0.5">
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">Hotel Name</div>
              <div className="text-gray-800 text-lg font-semibold font-figtree flex items-center gap-2">
                {booking.hotel}
                <div className="flex text-amber-400 h-4">
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                  <Star className="h-4 w-4 fill-current" />
                </div>
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center">
              <div className="text-gray-500 text-lg font-normal font-figtree">Address</div>
              <div className="text-gray-800 text-lg font-medium font-figtree text-right">
                5855 West Century Blvd<br/>Los Angeles, USA
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">Front Desk</div>
              <div className="text-gray-800 text-lg font-medium font-figtree">+1 310-641-5700</div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">Reservations</div>
              <div className="text-gray-800 text-lg font-medium font-figtree">+1 800-228-9290</div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">Rooms Booked</div>
              <div className="text-gray-800 text-lg font-medium font-figtree">{booking.rooms}</div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">Room Type</div>
              <div className="text-gray-800 text-lg font-medium font-figtree">Double Queen Room</div>
            </div>
          </div>
        </div>

        {/* Passenger Details Card */}
        <div className="self-stretch p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-6 -mt-[1px]">
          <div className="self-stretch justify-start text-gray-800 text-xl font-semibold font-figtree">
            Passenger Details
          </div>
          <div className="self-stretch flex flex-col justify-start items-start gap-4 -mt-0.5">
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">Total Passengers</div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">{booking.passengers}</div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">Passenger Breakdown</div>
              <div className="text-gray-800 text-lg font-medium font-figtree">2 Adults • 1 Child</div>
            </div>
            
            <div className="self-stretch border-t border-gray-100 my-2"></div>
            
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-800 text-lg font-medium font-figtree">1. John Doe</div>
              <div className="text-gray-500 text-lg font-normal font-figtree">Adult • Business</div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-800 text-lg font-medium font-figtree">2. Jane Doe</div>
              <div className="text-gray-500 text-lg font-normal font-figtree">Adult • Business</div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-800 text-lg font-medium font-figtree">3. Jimmy Doe</div>
              <div className="text-gray-500 text-lg font-normal font-figtree">Child • Business</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: Cost Breakdown */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="self-stretch p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-6">
          <div className="self-stretch justify-start text-gray-800 text-xl font-semibold font-figtree">
            Cost Breakdown
          </div>
          <div className="self-stretch flex flex-col justify-start items-start gap-4">
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Hotel Subtotal ({booking.rooms} rooms × $180.00)
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                ${(booking.rooms * 180).toFixed(2)}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Platform Fee (5%)
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                ${(booking.rooms * 180 * 0.05).toFixed(2)}
              </div>
            </div>
            <div className="self-stretch border-t border-gray-100 my-2"></div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-800 text-xl font-semibold font-figtree">
                Grand Total
              </div>
              <div className="text-emerald-600 text-xl font-bold font-figtree">
                ${(booking.rooms * 180 * 1.05).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
