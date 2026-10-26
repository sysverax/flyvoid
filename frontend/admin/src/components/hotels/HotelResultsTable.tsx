"use client";

import { Fragment, useState } from "react";
import { ChevronDown, Star } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";
import { cn } from "@/src/lib/utils";
import type {
  HotelAvailabilityHotel,
  HotelAvailabilityOption,
  HotelAvailabilityTax,
} from "@/src/services/hotel-availability.service";

const COLUMN_COUNT = 9;

export const formatMoney = (amount: number, currency: string | null) =>
  `${currency ?? ""} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();

/** "Nov 8, 2026" (deadline as the supplier gives it; usually the hotel's local time). */
const formatDeadline = (value: string) => {
  const date = new Date(value);
  return isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

function Stars({ count }: { count: number }) {
  if (!count) return <span className="text-[#9CA3AF]">—</span>;
  return (
    <span className="flex items-center gap-0.5" title={`${count} stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn("h-3.5 w-3.5", i < count ? "fill-amber-400 text-amber-400" : "text-[#D1D5DB]")}
        />
      ))}
    </span>
  );
}

function Cancellation({ freeUntil, penalty, currency }: { freeUntil: string | null; penalty?: number | null; currency?: string }) {
  if (!freeUntil) return <span className="text-[#B45309]">Non-refundable</span>;
  return (
    <span className="text-green-700">
      Free until {formatDeadline(freeUntil)}
      {penalty != null && currency && (
        <span className="block text-[12px] text-[#6B7280]">then {formatMoney(penalty, currency)}</span>
      )}
    </span>
  );
}

function Taxes({ option }: { option: HotelAvailabilityOption }) {
  const line = (taxes: HotelAvailabilityTax[]) =>
    taxes.map((tax) => formatMoney(tax.amount, tax.currency)).join(" + ");
  if (!option.taxesIncluded.length && !option.taxesAtProperty.length) {
    return <span className="text-[#9CA3AF]">—</span>;
  }
  return (
    <div className="space-y-0.5">
      {option.taxesIncluded.length > 0 && (
        <div className="text-[#6B7280]">Incl. {line(option.taxesIncluded)}</div>
      )}
      {option.taxesAtProperty.length > 0 && (
        <div
          className="text-[#B45309]"
          title={option.taxesAtProperty.map((tax) => `${tax.name}: ${formatMoney(tax.amount, tax.currency)}`).join("\n")}
        >
          + {line(option.taxesAtProperty)} at hotel
        </div>
      )}
    </div>
  );
}

function Features({ features }: { features: string[] }) {
  if (!features.length) return <span className="text-[#9CA3AF]">—</span>;
  const shown = features.slice(0, 3);
  const rest = features.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1" title={features.join(", ")}>
      {shown.map((feature) => (
        <span key={feature} className="rounded-full bg-[#F3F4F6] px-2 py-0.5 text-[12px] text-[#374151]">
          {feature}
        </span>
      ))}
      {rest > 0 && <span className="px-1 text-[12px] text-[#6B7280]">+{rest} more</span>}
    </div>
  );
}

function OptionsTable({ hotel }: { hotel: HotelAvailabilityHotel }) {
  const head = "px-3 py-2 text-left text-[13px] font-medium text-[#6B7280] whitespace-nowrap";
  const cell = "px-3 py-2.5 align-top text-[14px]";
  return (
    <div className="overflow-x-auto rounded-[8px] border border-[#E5E7EB] bg-white">
      <table className="w-full">
        <thead className="bg-[#F9FAFB]">
          <tr>
            <th className={head}>Room type</th>
            <th className={head}>Meal plan</th>
            <th className={head}>Max guests</th>
            <th className={head}>Price / night</th>
            <th className={head}>Total stay</th>
            <th className={head}>Taxes / fees</th>
            <th className={head}>Cancellation</th>
            <th className={head}>Available</th>
            <th className={head}>Features</th>
          </tr>
        </thead>
        <tbody>
          {hotel.options.map((option, index) => (
            <tr key={index} className="border-t border-[#F3F4F6]">
              <td className={cn(cell, "font-medium text-[#1F2937] min-w-[160px]")}>{option.roomType}</td>
              <td className={cn(cell, "text-[#374151] whitespace-nowrap")}>{option.mealPlan}</td>
              <td className={cn(cell, "text-[#374151]")}>{option.maxGuests ?? "—"}</td>
              <td className={cn(cell, "font-medium text-[#1F2937] whitespace-nowrap tabular-nums")}>
                {formatMoney(option.pricePerNight, option.currency)}
              </td>
              <td className={cn(cell, "text-[#374151] whitespace-nowrap tabular-nums")}>
                {formatMoney(option.totalPrice, option.currency)}
              </td>
              <td className={cn(cell, "whitespace-nowrap")}>
                <Taxes option={option} />
              </td>
              <td className={cn(cell, "whitespace-nowrap")}>
                <Cancellation
                  freeUntil={option.cancellation.freeUntil}
                  penalty={option.cancellation.penaltyAmount}
                  currency={option.currency}
                />
              </td>
              <td className={cn(cell, "text-[#374151]")}>{option.roomsAvailable ?? "—"}</td>
              <td className={cn(cell, "min-w-[180px]")}>
                <Features features={option.features} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface HotelResultsTableProps {
  hotels: HotelAvailabilityHotel[];
  nights: number;
  emptyState: React.ReactNode;
}

/** One row per hotel; a row expands to its room options. Prices are supplier prices. */
export function HotelResultsTable({ hotels, nights, emptyState }: HotelResultsTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (code: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });

  return (
    <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[100px]">HID</TableHead>
            <TableHead className="min-w-[240px]">Hotel</TableHead>
            <TableHead className="min-w-[110px]">Stars</TableHead>
            <TableHead className="min-w-[100px]">Distance</TableHead>
            <TableHead className="min-w-[140px]">From (per night)</TableHead>
            <TableHead className="min-w-[140px]">Total stay</TableHead>
            <TableHead className="min-w-[170px]">Free cancellation</TableHead>
            <TableHead className="min-w-[120px]">Rooms</TableHead>
            <TableHead className="w-[48px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {hotels.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="py-0">
                {emptyState}
              </TableCell>
            </TableRow>
          ) : (
            hotels.map((hotel) => {
              const isOpen = expanded.has(hotel.hotelCode);
              return (
                <Fragment key={hotel.hotelCode}>
                  <TableRow
                    onClick={() => toggle(hotel.hotelCode)}
                    className={cn("cursor-pointer", isOpen && "bg-[#F9FAFB]")}
                  >
                    <TableCell className="text-[#6B7280] tabular-nums">{hotel.hid ?? hotel.hotelCode}</TableCell>
                    <TableCell>
                      <div className="font-medium text-[#1F2937]">{hotel.name}</div>
                      {hotel.address && (
                        <div className="max-w-[320px] truncate text-[13px] text-[#6B7280]" title={hotel.address}>
                          {hotel.address}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Stars count={hotel.stars} />
                    </TableCell>
                    <TableCell className="text-[#374151] whitespace-nowrap">
                      {hotel.distanceKm != null ? `${hotel.distanceKm} km` : "—"}
                    </TableCell>
                    <TableCell className="font-medium text-[#1F2937] whitespace-nowrap tabular-nums">
                      {formatMoney(hotel.lowestPricePerNight, hotel.currency)}
                    </TableCell>
                    <TableCell className="text-[#374151] whitespace-nowrap tabular-nums">
                      {formatMoney(hotel.lowestTotalPrice, hotel.currency)}
                      <span className="block text-[12px] text-[#6B7280]">
                        {nights} night{nights === 1 ? "" : "s"}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <Cancellation freeUntil={hotel.freeCancellationUntil} />
                    </TableCell>
                    <TableCell className="text-[#374151] whitespace-nowrap">
                      {hotel.options.length} option{hotel.options.length === 1 ? "" : "s"}
                    </TableCell>
                    <TableCell>
                      <ChevronDown
                        className={cn("h-5 w-5 text-[#6B7280] transition-transform", isOpen && "rotate-180")}
                        aria-label={isOpen ? "Hide room options" : "Show room options"}
                      />
                    </TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="bg-[#F9FAFB] hover:bg-[#F9FAFB]">
                      <TableCell colSpan={COLUMN_COUNT} className="px-4 pb-4 pt-0">
                        <OptionsTable hotel={hotel} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );
}
