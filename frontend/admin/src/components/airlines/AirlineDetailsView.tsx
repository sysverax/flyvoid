"use client";

import { ArrowLeft, Edit3, AlertTriangle, PencilIcon } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { Airline } from "@/src/types/airlines";
import { StatusBadge } from "@/src/components/ui/StatusBadge";

interface AirlineDetailsViewProps {
  airline: Airline;
  onBack: () => void;
  onEditClick: () => void;
}

export function AirlineDetailsView({
  airline,
  onBack,
  onEditClick,
}: AirlineDetailsViewProps) {
  return (
    <div className="space-y-[19px]">
      {/* Back button */}
      <button
        onClick={onBack}
        className="relative -top-1 flex items-center gap-1.5 text-[16px] text-[#6B7280] hover:text-[#1F2937] transition-colors duration-150 font-medium group cursor-pointer"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        <span>Back to Airlines</span>
      </button>

      {/* Profile Header */}
      <div className="self-stretch flex justify-between items-center relative -top-1">
        <div className="flex flex-col justify-start items-start">
          <div className="flex justify-start items-center gap-2">
            <h1 className="text-gray-800 text-2xl font-semibold font-figtree">
              {airline.airlineName}
            </h1>
            <StatusBadge status={airline.status} />
          </div>
          <div className="text-gray-500 text-sm font-normal font-figtree">
            IATA: {airline.airlineCode}
          </div>
        </div>

        <button
          onClick={onEditClick}
          className="px-4 py-[13px] bg-[#0F2757] rounded-[10px] flex justify-center items-center gap-2 overflow-hidden hover:bg-[#1A3B75] transition-colors text-white text-base font-medium font-figtree cursor-pointer shrink-0"
        >
          <div className="size-5 flex items-center justify-center shrink-0">
            <img src="/icons/edit1.svg" alt="Edit" className="h-5 w-5" />
          </div>
          <span>Edit Details</span>
        </button>
      </div>

      {/* Disabled Warning Banner */}
      {airline.status === "Disabled" && (
        <div className="self-stretch relative top-[9px] pb-4 px-6 pt-3 bg-orange-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-orange-200 flex justify-start items-center gap-2.5">
          <AlertTriangle className="h-5 w-5 text-orange-500 shrink-0" />
          <span className="text-orange-500 text-sm font-normal font-figtree">
            This airline is currently disabled. Operations are paused until
            re-enabled.
          </span>
        </div>
      )}

      {/* Suspended Warning Banner */}
      {airline.status === "Suspended" && (
        <div className="self-stretch relative top-[9px] pb-4 px-6 pt-3 bg-red-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-red-200 flex justify-start items-center gap-2.5">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <span className="text-red-500 text-sm font-normal font-figtree">
            This airline is suspended. Manual review required to reactivate.
          </span>
        </div>
      )}

      {/* Row 1: Airline Details & Admin Details (matching height) */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Airline Details Card */}
        <div className="self-stretch p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-6 mt-3">
          <div className="self-stretch justify-start text-gray-800 text-xl font-semibold font-figtree -mt-1">
            Airline Details
          </div>
          <div className="self-stretch flex flex-col justify-start items-start gap-4">
            <div className="self-stretch flex justify-between items-center h-[22px] -mt-[2px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Airline Name
              </div>
              <div className="text-gray-800 text-lg font-medium font-figtree">
                {airline.airlineName}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Airline
              </div>
              <div className="text-gray-800 text-lg font-medium font-figtree">
                Code: {airline.airlineCode}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Country
              </div>
              <div className="text-gray-800 text-lg font-medium font-figtree">
                {airline.country}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Company Registration
              </div>
              <div className="text-gray-800 text-lg font-medium font-figtree">
                {airline.companyReg}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Website
              </div>
              <a
                href={airline.website}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline text-lg font-medium font-figtree"
              >
                {airline.website}
              </a>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Contact Email
              </div>
              <div className="text-gray-800 text-lg font-medium font-figtree">
                {airline.contactEmail}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Contact Phone
              </div>
              <div className="text-gray-800 text-lg font-medium font-figtree">
                {airline.contactPhone}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Timezone
              </div>
              <div className="text-gray-800 text-lg font-medium font-figtree">
                {airline.timezone}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Currency
              </div>
              <div className="text-gray-800 text-lg font-medium font-figtree">
                {airline.currency}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Address
              </div>
              <div className="text-gray-800 text-lg font-medium font-figtree text-right max-w-[280px]">
                {airline.address}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Onboarding Date
              </div>
              <div className="text-gray-800 text-lg font-medium font-figtree">
                {airline.onboardingDate}
              </div>
            </div>
            {airline.status === "Active" && (
              <div className="self-stretch flex justify-between items-center h-[22px]">
                <div className="text-gray-500 text-lg font-normal font-figtree">
                  Assigned Airports
                </div>
                <div className="w-72 text-gray-800 text-lg font-medium font-figtree line-clamp-1 text-right">
                  {airline.assignedAirports ||
                    "Pacific Airport, Heathrow Airport, Tokyo Haneda Airport, Los Angeles International Airport, Heathrow Airport, Dubai International Airport, Heathrow Airport, Los Angeles International Airport"}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Admin Details Card */}
        <div className="self-stretch p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-6 mt-3">
          <div className="self-stretch justify-start text-gray-800 text-xl font-semibold font-figtree -mt-1">
            Admin Details
          </div>
          <div className="self-stretch flex flex-col justify-start items-start gap-4 -mt-0.5">
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Admin First Name
              </div>
              <div className="text-gray-800 text-lg font-medium font-figtree">
                {airline.adminFirstName}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Admin Last Name
              </div>
              <div className="text-gray-800 text-lg font-medium font-figtree">
                {airline.adminLastName}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Admin Email
              </div>
              <div className="text-gray-800 text-lg font-medium font-figtree">
                {airline.adminEmail}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Job Title
              </div>
              <div className="text-gray-800 text-lg font-medium font-figtree">
                {airline.adminJobTitle}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Credit Limit
              </div>
              <div className="text-gray-800 text-lg font-medium font-figtree">
                ${airline.creditLimit.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 2: Operational Metrics & Financial Summary */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Operational Metrics Card */}
        <div className="self-stretch p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-6 -mt-[1px]">
          <div className="self-stretch justify-start text-gray-800 text-xl font-semibold font-figtree">
            Operational Metrics
          </div>
          <div className="self-stretch flex flex-col justify-start items-start gap-4 -mt-0.5">
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Total Cancelled Flights
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                {airline.totalCancelledFlights}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Total Passengers
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                {airline.totalPassengersMetric.toLocaleString()}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Avg Cost per Passenger
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                ${airline.avgCostPerPassenger}
              </div>
            </div>
          </div>
        </div>

        {/* Financial Summary Card */}
        <div className="self-stretch p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-6 -mt-0.5">
          <div className="self-stretch justify-start text-gray-800 text-xl font-semibold font-figtree -mt-[1px]">
            Financial Summary
          </div>
          <div className="self-stretch flex flex-col justify-start items-start gap-4">
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Total Spend
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                ${airline.totalSpendMetric.toLocaleString()}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Platform Fees
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                ${airline.platformFeesMetric.toLocaleString()}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Allowance Balance
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                ${airline.allowanceBalanceMetric.toLocaleString()}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Stripe Connection
              </div>
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold",
                  airline.stripeConnection === "Connected" &&
                    "bg-emerald-50 text-emerald-700",
                  airline.stripeConnection === "Pending" &&
                    "bg-amber-50 text-amber-700",
                  airline.stripeConnection === "Failed" &&
                    "bg-rose-50 text-rose-700",
                )}
              >
                {airline.stripeConnection}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Risk Indicators Card */}
      <div className="self-stretch p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-6">
        <div className="self-stretch justify-start text-gray-800 text-xl font-semibold font-figtree">
          Risk Indicators
        </div>
        <div className="self-stretch flex flex-col justify-start items-start gap-4">
          <div className="self-stretch flex justify-between items-center h-[22px]">
            <div className="text-gray-500 text-lg font-normal font-figtree">
              Failed Payments
            </div>
            <div className="text-gray-800 text-lg font-semibold font-figtree">
              {airline.failedPaymentsCount}
            </div>
          </div>
          <div className="self-stretch flex justify-between items-center h-[22px]">
            <div className="text-gray-500 text-lg font-normal font-figtree">
              Allocation Failures
            </div>
            <div className="text-gray-800 text-lg font-semibold font-figtree">
              {airline.allocationFailuresCount}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
