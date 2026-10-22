"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  BedDouble,
  Building2,
  Check,
  Loader2,
  MapPin,
  Minus,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { cn } from "@/src/lib/utils";
import {
  cancellationService,
  HotelAllocationBookingResult,
  HotelRecommendation,
  HotelRecommendationsResponse,
  RoomOccupancy,
} from "@/src/services/cancellation.service";

interface FailedBookingHotelDrawerProps {
  isOpen: boolean;
  flightId: number | null;
  booking: HotelAllocationBookingResult | null;
  onClose: () => void;
  onBooked: () => Promise<void> | void;
}

const RADIUS_OPTIONS = [10, 20, 30, 40, 50];
// RateHawk takes at most 9 rooms in one order.
const MAX_ROOMS = 9;
const CUSTOM_SPLIT = "custom";

const splitKey = (rooms: RoomOccupancy[]) =>
  rooms.map((room) => `${room.adults}-${room.children}`).join(",");

const roomLabel = (room: RoomOccupancy) =>
  room.children > 0 ? `${room.adults}A+${room.children}C` : `${room.adults}A`;

const splitLabel = (rooms: RoomOccupancy[]) =>
  `${rooms.length} room${rooms.length > 1 ? "s" : ""}: ${rooms.map(roomLabel).join(" / ")}`;

const guestsLabel = (room: RoomOccupancy) =>
  `${room.adults} adult${room.adults > 1 ? "s" : ""}` +
  (room.children > 0
    ? ` + ${room.children} child${room.children > 1 ? "ren" : ""}`
    : "");

export function FailedBookingHotelDrawer({
  isOpen,
  flightId,
  booking,
  onClose,
  onBooked,
}: FailedBookingHotelDrawerProps) {
  const [mounted, setMounted] = useState(false);
  const [data, setData] = useState<HotelRecommendationsResponse | null>(null);
  const [selectedHotel, setSelectedHotel] = useState<HotelRecommendation | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [radius, setRadius] = useState(RADIUS_OPTIONS[0]);
  // null: the recommended split, chosen by the server.
  const [rooms, setRooms] = useState<RoomOccupancy[] | null>(null);
  const [customRooms, setCustomRooms] = useState<RoomOccupancy[] | null>(null);
  const [party, setParty] = useState<RoomOccupancy | null>(null);
  const [splitOptions, setSplitOptions] = useState<
    HotelRecommendationsResponse["splitOptions"]
  >([]);

  useEffect(() => setMounted(true), []);

  const loadRecommendations = async (
    criteria: { radius: number; rooms: RoomOccupancy[] | null } = {
      radius,
      rooms,
    },
  ) => {
    if (!flightId || !booking) return;
    setIsLoading(true);
    setError(null);
    setData(null);
    setSelectedHotel(null);
    try {
      const response = await cancellationService.getHotelRecommendations(
        flightId,
        booking.bookingId,
        { radius: criteria.radius, rooms: criteria.rooms ?? undefined },
      );
      setData(response.data);
      setRooms(response.data.rooms);
      setParty({
        adults: response.data.adults,
        children: response.data.children,
      });
      setSplitOptions(response.data.splitOptions);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load hotel options",
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && flightId && booking) {
      setCustomRooms(null);
      void loadRecommendations({ radius, rooms: null });
    }
  }, [isOpen, flightId, booking?.bookingId]);

  const handleBook = async () => {
    if (!flightId || !booking || !selectedHotel) return;
    setIsBooking(true);
    try {
      await cancellationService.bookRecommendedHotel(
        flightId,
        booking.bookingId,
        selectedHotel,
      );
      toast.success(
        `Booking ${selectedHotel.hotelName} for ${booking.pnr}. You can close this; the status updates when the supplier confirms.`,
      );
      await onBooked();
      onClose();
    } catch (bookingError) {
      toast.error(
        bookingError instanceof Error
          ? bookingError.message
          : "Failed to book the selected hotel",
      );
    } finally {
      setIsBooking(false);
    }
  };

  const unit = data?.radiusUnit ?? "km";
  const radiusOptions = RADIUS_OPTIONS.filter(
    (value) => value <= (data?.maxRadius ?? RADIUS_OPTIONS.at(-1)!),
  );

  const placedAdults = (customRooms ?? []).reduce(
    (sum, room) => sum + room.adults,
    0,
  );
  const placedChildren = (customRooms ?? []).reduce(
    (sum, room) => sum + room.children,
    0,
  );
  const customValid =
    !!customRooms &&
    !!party &&
    customRooms.length > 0 &&
    customRooms.length <= MAX_ROOMS &&
    customRooms.every((room) => room.adults >= 1) &&
    placedAdults === party.adults &&
    placedChildren === party.children;

  const updateCustomRoom = (index: number, change: Partial<RoomOccupancy>) =>
    setCustomRooms((current) =>
      (current ?? []).map((room, i) =>
        i === index ? { ...room, ...change } : room,
      ),
    );

  if (!mounted) return null;

  return createPortal(
    <>
      <div
        className={cn(
          "fixed inset-0 z-[100] bg-black/40 transition-opacity duration-300",
          isOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={isBooking ? undefined : onClose}
      />
      <aside
        className={cn(
          "fixed right-0 top-0 z-[110] flex h-full w-full max-w-[540px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="border-b border-gray-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#0F2757]" />
                <h2 className="text-xl font-semibold text-gray-900">
                  Find a hotel for PNR {booking?.pnr}
                </h2>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                {data
                  ? `${guestsLabel(data)} · all rooms are booked together at one hotel.`
                  : "Adjust the search criteria and select a hotel."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isBooking}
              className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed"
              aria-label="Close hotel selection"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {booking?.reason && (
            <div className="mt-4 flex gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-xs text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{booking.reason}</span>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <section className="mb-5 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
            <div className="mb-3 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[#0F2757]" />
              <h3 className="text-sm font-semibold text-gray-900">
                Search criteria
              </h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-600">
                  Distance from airport
                </span>
                <select
                  value={radius}
                  onChange={(event) => setRadius(Number(event.target.value))}
                  disabled={isLoading || isBooking}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-[#0F2757] focus:ring-1 focus:ring-[#0F2757] disabled:bg-gray-100"
                >
                  {radiusOptions.map((value) => (
                    <option key={value} value={value}>
                      Within {value} {unit}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-gray-600">
                  Room arrangement
                </span>
                <select
                  value={
                    customRooms ? CUSTOM_SPLIT : rooms ? splitKey(rooms) : ""
                  }
                  onChange={(event) => {
                    if (event.target.value === CUSTOM_SPLIT) {
                      setCustomRooms(
                        (rooms ?? splitOptions[0]?.rooms ?? []).map((room) => ({
                          ...room,
                        })),
                      );
                      return;
                    }
                    setCustomRooms(null);
                    setRooms(
                      splitOptions.find(
                        (option) =>
                          splitKey(option.rooms) === event.target.value,
                      )?.rooms ?? null,
                    );
                  }}
                  disabled={isLoading || isBooking || splitOptions.length === 0}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none focus:border-[#0F2757] focus:ring-1 focus:ring-[#0F2757] disabled:bg-gray-100"
                >
                  {splitOptions.length === 0 && (
                    <option value="">Recommended split</option>
                  )}
                  {splitOptions.map((option) => (
                    <option
                      key={splitKey(option.rooms)}
                      value={splitKey(option.rooms)}
                    >
                      {splitLabel(option.rooms)}
                      {option.recommended ? " (recommended)" : ""}
                    </option>
                  ))}
                  {splitOptions.length > 0 && (
                    <option value={CUSTOM_SPLIT}>Custom…</option>
                  )}
                </select>
              </label>
            </div>
            {customRooms && party && (
              <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
                <div className="space-y-2">
                  {customRooms.map((room, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between gap-2 text-xs text-gray-700"
                    >
                      <span className="w-14 font-medium">Room {index + 1}</span>
                      <RoomStepper
                        label="Adults"
                        value={room.adults}
                        min={1}
                        disabled={isLoading || isBooking}
                        onChange={(adults) => updateCustomRoom(index, { adults })}
                      />
                      <RoomStepper
                        label="Children"
                        value={room.children}
                        min={0}
                        disabled={isLoading || isBooking}
                        onChange={(children) =>
                          updateCustomRoom(index, { children })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCustomRooms((current) =>
                            (current ?? []).filter((_, i) => i !== index),
                          )
                        }
                        disabled={
                          customRooms.length === 1 || isLoading || isBooking
                        }
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Remove room ${index + 1}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setCustomRooms((current) => [
                        ...(current ?? []),
                        { adults: 1, children: 0 },
                      ])
                    }
                    disabled={
                      customRooms.length >= MAX_ROOMS || isLoading || isBooking
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#0F2757] hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add room
                  </button>
                  <span
                    className={cn(
                      "text-[11px]",
                      customValid ? "text-green-700" : "text-red-600",
                    )}
                  >
                    {placedAdults} of {party.adults} adults
                    {party.children > 0 &&
                      `, ${placedChildren} of ${party.children} children`}{" "}
                    placed
                    {customRooms.some((room) => room.adults < 1) &&
                      " · each room needs an adult"}
                  </span>
                </div>
              </div>
            )}
            <p className="mt-2 text-[11px] text-gray-500">
              A = adults, C = children per room.
            </p>
            <button
              type="button"
              onClick={() =>
                loadRecommendations({ radius, rooms: customRooms ?? rooms })
              }
              disabled={isLoading || isBooking || (!!customRooms && !customValid)}
              className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0F2757] px-4 text-sm font-medium text-white hover:bg-[#162259] disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {isLoading ? "Searching hotels" : "Search hotels"}
            </button>
          </section>

          {isLoading && (
            <div className="flex min-h-60 flex-col items-center justify-center gap-3 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#0F2757]" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Finding available hotels
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Checking live rates for every room of this PNR.
                </p>
              </div>
            </div>
          )}

          {!isLoading && error && (
            <div className="flex min-h-60 flex-col items-center justify-center text-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="mt-3 text-sm font-medium text-gray-900">
                Hotels could not be loaded
              </p>
              <p className="mt-1 max-w-sm text-xs text-gray-500">{error}</p>
              <button
                type="button"
                onClick={() =>
                  loadRecommendations({ radius, rooms: customRooms ?? rooms })
                }
                className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <RefreshCw className="h-4 w-4" /> Retry search
              </button>
            </div>
          )}

          {!isLoading && !error && data?.options.length === 0 && (
            <div className="flex min-h-60 flex-col items-center justify-center text-center">
              <Building2 className="h-8 w-8 text-gray-400" />
              <p className="mt-3 text-sm font-medium text-gray-900">
                No hotels available
              </p>
              <p className="mt-1 max-w-sm text-xs text-gray-500">
                No hotel within {data.radius} {unit} has{" "}
                {splitLabel(data.rooms)} free. Try a wider distance or
                another room arrangement.
              </p>
            </div>
          )}

          {!isLoading && data && data.options.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                {data.options.length} hotels for {splitLabel(data.rooms)}
              </p>
              {data.options.map((hotel) => {
                const isSelected =
                  selectedHotel?.hotelCode === hotel.hotelCode;
                return (
                  <button
                    key={hotel.hotelCode}
                    type="button"
                    onClick={() => setSelectedHotel(hotel)}
                    disabled={isBooking}
                    className={cn(
                      "w-full rounded-xl border p-4 text-left transition-colors",
                      isSelected
                        ? "border-[#0F2757] bg-[#0F2757]/[0.03] ring-1 ring-[#0F2757]"
                        : "border-gray-200 hover:border-gray-300",
                      isBooking && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="truncate text-sm font-semibold text-gray-900">
                            {hotel.hotelName}
                          </h3>
                          {isSelected && (
                            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#0F2757] text-white">
                              <Check className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-xs text-amber-500">
                          <Star className="h-3.5 w-3.5 fill-current" />
                          <span className="font-medium">
                            {hotel.stars || "Unrated"}
                          </span>
                          {!hotel.meetsMinimum && (
                            <span className="ml-1 text-gray-500">
                              · below the {data.minStars}★ minimum for this class
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm font-semibold text-gray-900">
                          {hotel.currency}{" "}
                          {hotel.totalPrice.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          total for {hotel.rooms.length} room
                          {hotel.rooms.length > 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-start gap-1.5 text-xs text-gray-500">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{hotel.address || "Address unavailable"}</span>
                    </div>
                    <ul className="mt-3 space-y-1.5 border-t border-gray-100 pt-3">
                      {hotel.rooms.map((room, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-1.5 text-xs text-gray-600"
                        >
                          <BedDouble className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-400" />
                          <span>
                            Room {index + 1} · {guestsLabel(room)} ·{" "}
                            {room.roomName} · {room.boardName}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <footer className="border-t border-gray-200 bg-white px-6 py-4">
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isBooking}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleBook}
              disabled={!selectedHotel || isBooking}
              className="inline-flex min-w-36 items-center justify-center gap-2 rounded-lg bg-[#0F2757] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#162259] disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isBooking && <Loader2 className="h-4 w-4 animate-spin" />}
              {isBooking ? "Starting booking" : "Book selected hotel"}
            </button>
          </div>
        </footer>
      </aside>
    </>,
    document.body,
  );
}

function RoomStepper({
  label,
  value,
  min,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-gray-500">{label}</span>
      <button
        type="button"
        onClick={() => onChange(value - 1)}
        disabled={disabled || value <= min}
        className="flex size-6 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={`Fewer ${label.toLowerCase()}`}
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="w-4 text-center font-semibold text-gray-900">
        {value}
      </span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={disabled}
        className="flex size-6 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={`More ${label.toLowerCase()}`}
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}
