"use client";

import { ArrowLeft, Edit3, AlertTriangle, PencilIcon } from "lucide-react";
import * as Tooltip from "@radix-ui/react-tooltip";
import React, { useState, useRef } from "react";
import { Airline } from "@/src/types/airlines";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { useAuth } from "@/src/hooks/useAuth";
import { TruncatedTooltip } from "@/src/components/ui/TruncatedTooltip";

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
  const { hasPermission } = useAuth();

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
            <TruncatedTooltip text={airline.airlineName}>
              <h1 className="text-gray-800 text-2xl font-semibold font-figtree max-w-[500px] truncate cursor-default">
                {airline.airlineName}
              </h1>
            </TruncatedTooltip>
            <StatusBadge status={airline.status} />
          </div>
          <div className="text-gray-500 text-sm font-normal font-figtree">
            IATA: {airline.airlineCode}
          </div>
        </div>

        {hasPermission("edit") && (
          <button
            onClick={onEditClick}
            className="px-4 py-[13px] bg-[#0F2757] rounded-[10px] flex justify-center items-center gap-2 overflow-hidden hover:bg-[#1A3B75] transition-colors text-white text-base font-medium font-figtree cursor-pointer shrink-0"
          >
            <div className="size-5 flex items-center justify-center shrink-0">
              <img src="/icons/edit1.svg" alt="Edit" className="h-5 w-5" />
            </div>
            <span>Edit Details</span>
          </button>
        )}
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
        <div className="h-[44px] mb-6 self-stretch relative top-[9px] px-6 bg-red-50 rounded-lg outline outline-1 outline-offset-[-1px] outline-red-200 flex justify-start items-center gap-2.5">
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
              <div className="text-gray-500 text-lg font-normal font-figtree shrink-0">
                Airline Name
              </div>
              <TruncatedTooltip text={airline.airlineName} side="top">
                <div className="text-gray-800 text-lg font-medium font-figtree text-right max-w-[280px] truncate cursor-default">
                  {airline.airlineName}
                </div>
              </TruncatedTooltip>
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
              <div className="text-gray-500 text-lg font-normal font-figtree shrink-0">
                Company Registration
              </div>
              <TruncatedTooltip text={airline.companyReg} side="top">
                <div className="text-gray-800 text-lg font-medium font-figtree text-right max-w-[280px] truncate cursor-default">
                  {airline.companyReg}
                </div>
              </TruncatedTooltip>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree shrink-0">
                Website
              </div>
              <TruncatedTooltip text={airline.website} side="top">
                <a
                  href={airline.website}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary hover:underline text-lg font-medium font-figtree text-right max-w-[280px] truncate"
                >
                  {airline.website}
                </a>
              </TruncatedTooltip>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree shrink-0">
                Contact Email
              </div>
              <TruncatedTooltip text={airline.contactEmail} side="top">
                <div className="text-gray-800 text-lg font-medium font-figtree text-right max-w-[280px] truncate cursor-default">
                  {airline.contactEmail}
                </div>
              </TruncatedTooltip>
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
              <div className="text-gray-500 text-lg font-normal font-figtree shrink-0">
                Address
              </div>
              <TruncatedTooltip text={airline.address} side="top">
                <div className="text-gray-800 text-lg font-medium font-figtree text-right max-w-[280px] truncate cursor-default">
                  {airline.address}
                </div>
              </TruncatedTooltip>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Onboarding Date
              </div>
              <div className="text-gray-800 text-lg font-medium font-figtree">
                {airline.onboardingDate}
              </div>
            </div>
          </div>
        </div>

        {/* Admin Details Card */}
        <div className="self-stretch p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-6 mt-3">
          <div className="self-stretch justify-start text-gray-800 text-xl font-semibold font-figtree -mt-1">
            Admin Details
          </div>
          <div className="self-stretch flex flex-col justify-start items-start gap-4 -mt-0.5">
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree shrink-0">
                First Name
              </div>
              <TruncatedTooltip text={airline.adminFirstName} side="top">
                <div className="text-gray-800 text-lg font-medium font-figtree text-right max-w-[200px] truncate cursor-default">
                  {airline.adminFirstName}
                </div>
              </TruncatedTooltip>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree shrink-0">
                Last Name
              </div>
              <TruncatedTooltip text={airline.adminLastName} side="top">
                <div className="text-gray-800 text-lg font-medium font-figtree text-right max-w-[200px] truncate cursor-default">
                  {airline.adminLastName}
                </div>
              </TruncatedTooltip>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree shrink-0">
                Email
              </div>
              <TruncatedTooltip text={airline.adminEmail} side="top">
                <div className="text-gray-800 text-lg font-medium font-figtree text-right max-w-[200px] truncate cursor-default">
                  {airline.adminEmail}
                </div>
              </TruncatedTooltip>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree shrink-0">
                Title
              </div>
              <TruncatedTooltip text={airline.adminJobTitle} side="top">
                <div className="text-gray-800 text-lg font-medium font-figtree text-right max-w-[200px] truncate cursor-default">
                  {airline.adminJobTitle}
                </div>
              </TruncatedTooltip>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree shrink-0">
                Last Login
              </div>
              <div className="text-gray-800 text-lg font-medium font-figtree text-right max-w-[200px] truncate cursor-default">
                {airline.adminLastLoginAt || "Never"}
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
                Ongoing Cancelled Flights
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                {(
                  airline.operationalMetrics?.totalOngoingCancelledFlights ?? 0
                ).toLocaleString()}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Total Cancelled Flights
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                {(
                  airline.operationalMetrics?.totalCancelledFlights ?? 0
                ).toLocaleString()}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Total Adults
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                {(
                  airline.operationalMetrics?.totalAdults ?? 0
                ).toLocaleString()}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Total Children
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                {(
                  airline.operationalMetrics?.totalChildren ?? 0
                ).toLocaleString()}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Total Bookings
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                {(
                  airline.operationalMetrics?.totalBookings ?? 0
                ).toLocaleString()}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Total Rooms
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                {(airline.operationalMetrics?.totalRooms ?? 0).toLocaleString()}
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
                Credit Limit
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                ${(airline.financialSummary?.creditLimit ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Balance
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                ${(airline.financialSummary?.balance ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Locked Amount
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                $
                {(airline.financialSummary?.lockedAmount ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Platform Fee Percentage
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                {airline.financialSummary?.platformFeePercentage ?? 0}%
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Total Actual Price
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                $
                {(
                  airline.financialSummary?.totalActualPrice ?? 0
                ).toLocaleString()}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Total Buying Price
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                $
                {(
                  airline.financialSummary?.totalBuyingPrice ?? 0
                ).toLocaleString()}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Total Selling Price
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                $
                {(
                  airline.financialSummary?.totalSellingPrice ?? 0
                ).toLocaleString()}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Total Discounts
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                $
                {(
                  airline.financialSummary?.totalDiscounts ?? 0
                ).toLocaleString()}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Total Hotel Taxes
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                $
                {(
                  airline.financialSummary?.totalHotelTaxes ?? 0
                ).toLocaleString()}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Total Platform Fee
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                $
                {(
                  airline.financialSummary?.totalPlatformFee ?? 0
                ).toLocaleString()}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Total Price
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                ${(airline.financialSummary?.totalPrice ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="self-stretch flex justify-between items-center h-[22px]">
              <div className="text-gray-500 text-lg font-normal font-figtree">
                Total Earnings
              </div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                $
                {(
                  airline.financialSummary?.totalEarnings ?? 0
                ).toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
