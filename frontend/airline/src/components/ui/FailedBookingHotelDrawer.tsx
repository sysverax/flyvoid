"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  AlertCircle,
  ArrowLeft,
  BedDouble,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Globe,
  ImageOff,
  Info,
  Mail,
  Pencil,
  Phone,
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
  ApiRequestError,
  cancellationService,
  HotelAllocationBookingResult,
  HotelDetails,
  HotelRecommendation,
  HotelRecommendationsResponse,
  RoomOccupancy,
} from "@/src/services/cancellation.service";

interface FailedBookingHotelDrawerProps {
  isOpen: boolean;
  flightId: number | null;
  booking: HotelAllocationBookingResult | null;
  /** Every PNR needing a manual hotel, in table order, for Prev / Next. */
  queue?: HotelAllocationBookingResult[];
  /** Switch the drawer to another PNR of the queue. */
  onNavigate?: (booking: HotelAllocationBookingResult) => void;
  onClose: () => void;
  onBooked: () => Promise<void> | void;
}

const RADIUS_OPTIONS = [10, 20, 30, 40, 50];
// Used until the server sends its limits (same values).
const DEFAULT_LIMITS = {
  maxRooms: 9,
  maxAdultsPerRoom: 6,
  maxChildrenPerRoom: 4,
};

const plural = (count: number, one: string, many: string) =>
  `${count} ${count === 1 ? one : many}`;

const splitKey = (rooms: RoomOccupancy[]) =>
  rooms.map((room) => `${room.adults}-${room.children}`).join(",");

const guestsLabel = (room: RoomOccupancy) =>
  plural(room.adults, "adult", "adults") +
  (room.children > 0 ? ` · ${plural(room.children, "child", "children")}` : "");

/** "2 rooms: 2 adults · 1 child / 1 adult" */
const splitLabel = (rooms: RoomOccupancy[]) =>
  `${plural(rooms.length, "room", "rooms")}: ${rooms.map(guestsLabel).join(" / ")}`;

/** "Nov 2" from YYYY-MM-DD, without timezone shifts. */
const shortDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

const nightsBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
      86_400_000,
  );

/** "Nov 25, 2026" for a supplier deadline (shown as the supplier gives it). */
const deadlineLabel = (value: string) => {
  const date = new Date(value);
  return isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
};

const money = (amount: number, currency: string | null) =>
  `${currency ?? ""} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.trim();

/** "3 rooms · Superior Triple · Room only", or "3 rooms · 2 room types" when they differ. */
const roomsSummary = (hotel: HotelRecommendation) => {
  const types = new Set(hotel.rooms.map((room) => `${room.roomName}|${room.boardName}`));
  const count = plural(hotel.rooms.length, "room", "rooms");
  if (types.size === 1) {
    return `${count} · ${hotel.rooms[0].roomName} · ${hotel.rooms[0].boardName}`;
  }
  return `${count} · ${types.size} room types`;
};

type SortKey = "recommended" | "price" | "distance" | "stars";
const SORT_OPTIONS: Array<{ value: SortKey; label: string }> = [
  { value: "recommended", label: "Recommended" },
  { value: "price", label: "Lowest price" },
  { value: "distance", label: "Nearest" },
  { value: "stars", label: "Most stars" },
];

/** Why automatic booking failed, in plain words, with the next step. */
function failureMessage(
  booking: HotelAllocationBookingResult,
  data: HotelRecommendationsResponse | null,
): string {
  const party = `${plural(booking.adults, "adult", "adults")} + ${plural(booking.children, "child", "children")}`;
  switch (booking.reasonCode) {
    case "NO_ROOM_SPLIT":
      return data && !data.arrangementPossible
        ? `${party} can't be placed: every room needs an adult and holds at most ${data.roomLimits.maxChildrenPerRoom} children. This PNR has to be handled outside FlyVoid.`
        : `There's no standard room arrangement for ${party}. Set the rooms yourself below, then search.`;
    case "NO_AVAILABILITY":
      return `Automatic booking found no hotel with rooms left for this arrangement${data ? ` (searched up to ${data.maxRadius} ${data.radiusUnit})` : ""}. Try another room arrangement or distance.`;
    case "BOOKING_REJECTED":
      return "The supplier refused every hotel automatic booking tried. Pick another hotel below.";
    case "INVALID_PASSENGERS":
      return "This PNR's passenger data can't be allocated. Check the passenger details.";
    default:
      return booking.reason ?? "Automatic booking could not book a hotel for this PNR.";
  }
}

export function FailedBookingHotelDrawer({
  isOpen,
  flightId,
  booking,
  queue = [],
  onNavigate,
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
  const [error, setError] = useState<{ message: string; retryable: boolean } | null>(
    null,
  );
  const [radius, setRadius] = useState(RADIUS_OPTIONS[0]);
  // null: the recommended split, chosen by the server.
  const [rooms, setRooms] = useState<RoomOccupancy[] | null>(null);
  const [customRooms, setCustomRooms] = useState<RoomOccupancy[] | null>(null);
  const [splitOptions, setSplitOptions] = useState<
    HotelRecommendationsResponse["splitOptions"]
  >([]);
  /** True once a search ran for the current criteria (rooms were sent or recommended). */
  const [searched, setSearched] = useState(false);
  /** The search form; collapsed to a one-line summary once hotels are shown. */
  const [criteriaOpen, setCriteriaOpen] = useState(true);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("recommended");
  const [onlyMeetsMinimum, setOnlyMeetsMinimum] = useState(false);
  /** Hotel shown in the detail view (over the list). */
  const [detailHotel, setDetailHotel] = useState<HotelRecommendation | null>(null);
  const [details, setDetails] = useState<HotelDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const loadRecommendations = async (criteria: {
    radius: number;
    rooms: RoomOccupancy[] | null;
  }) => {
    if (!flightId || !booking) return;
    setIsLoading(true);
    setError(null);
    setSelectedHotel(null);
    try {
      const response = await cancellationService.getHotelRecommendations(
        flightId,
        booking.bookingId,
        { radius: criteria.radius, rooms: criteria.rooms ?? undefined },
      );
      const result = response.data;
      setData(result);
      setRadius(result.radius);
      setSplitOptions(result.splitOptions);
      setSearched(result.rooms !== null);
      setDetailHotel(null);
      // Results take the space; the form shrinks to a summary line.
      setCriteriaOpen(!(result.rooms && result.options.length > 0));
      if (result.rooms) {
        setRooms(result.rooms);
      } else {
        // No standard arrangement: start from the whole party in one room,
        // unless no arrangement can place it at all.
        setRooms(null);
        setCustomRooms((current) =>
          current ??
          (result.arrangementPossible
            ? [{ adults: result.adults, children: result.children }]
            : null),
        );
      }
    } catch (loadError) {
      const status =
        loadError instanceof ApiRequestError ? loadError.status : undefined;
      setError({
        message:
          loadError instanceof Error
            ? loadError.message
            : "Failed to load hotel options",
        // A 4xx is about the request itself; retrying the same one won't help.
        retryable: status === undefined || status >= 500,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && flightId && booking) {
      setData(null);
      setRooms(null);
      setCustomRooms(null);
      setSplitOptions([]);
      setSearched(false);
      setCriteriaOpen(true);
      setReasonOpen(false);
      setSortBy("recommended");
      setOnlyMeetsMinimum(false);
      setDetailHotel(null);
      setRadius(RADIUS_OPTIONS[0]);
      void loadRecommendations({ radius: RADIUS_OPTIONS[0], rooms: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, flightId, booking?.bookingId]);

  const position = booking
    ? queue.findIndex((item) => item.bookingId === booking.bookingId)
    : -1;
  const previous = position > 0 ? queue[position - 1] : null;
  const next =
    position >= 0 && position < queue.length - 1 ? queue[position + 1] : null;

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
        `Booking ${selectedHotel.hotelName} for ${booking.pnr}. The status updates when the supplier confirms.`,
      );
      await onBooked();
      // Carry on with the next PNR needing a hotel.
      if (next && onNavigate) onNavigate(next);
      else onClose();
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

  const limits = data?.roomLimits ?? DEFAULT_LIMITS;
  const unit = data?.radiusUnit ?? "km";
  const radiusOptions = RADIUS_OPTIONS.filter(
    (value) => value <= (data?.maxRadius ?? RADIUS_OPTIONS.at(-1)!),
  );
  const nextRadius = radiusOptions.find((value) => value > radius);
  const adults = data?.adults ?? booking?.adults ?? 0;
  const children = data?.children ?? booking?.children ?? 0;
  const arrangementPossible = data?.arrangementPossible ?? true;

  const placedAdults = (customRooms ?? []).reduce(
    (sum, room) => sum + room.adults,
    0,
  );
  const placedChildren = (customRooms ?? []).reduce(
    (sum, room) => sum + room.children,
    0,
  );
  const customProblem = !customRooms
    ? null
    : customRooms.some((room) => room.adults < 1)
      ? "Every room needs an adult."
      : customRooms.some((room) => room.children > limits.maxChildrenPerRoom)
        ? `A room holds at most ${limits.maxChildrenPerRoom} children.`
        : customRooms.some((room) => room.adults > limits.maxAdultsPerRoom)
          ? `A room holds at most ${limits.maxAdultsPerRoom} adults.`
          : placedAdults !== adults || placedChildren !== children
            ? `Place everyone: ${placedAdults} of ${adults} adults${children > 0 ? `, ${placedChildren} of ${children} children` : ""} placed.`
            : null;
  const criteriaRooms = customRooms ?? rooms;
  const canSearch =
    arrangementPossible &&
    !isLoading &&
    !isBooking &&
    (customRooms ? !customProblem : true);

  const updateCustomRoom = (index: number, change: Partial<RoomOccupancy>) =>
    setCustomRooms((current) =>
      (current ?? []).map((room, i) =>
        i === index ? { ...room, ...change } : room,
      ),
    );

  const chooseSplit = (option: RoomOccupancy[]) => {
    setCustomRooms(null);
    setRooms(option);
  };
  const startCustom = () =>
    setCustomRooms(
      (rooms ?? splitOptions[0]?.rooms ?? [{ adults, children }]).map(
        (room) => ({ ...room }),
      ),
    );

  const tryAnotherArrangement = () => {
    const current = splitKey(criteriaRooms ?? []);
    const other = splitOptions.find(
      (option) => splitKey(option.rooms) !== current,
    );
    if (other && !customRooms) {
      chooseSplit(other.rooms);
      void loadRecommendations({ radius, rooms: other.rooms });
    } else {
      startCustom();
    }
  };

  const openDetails = async (hotel: HotelRecommendation) => {
    if (!flightId) return;
    setDetailHotel(hotel);
    setDetails(null);
    setDetailsError(null);
    setDetailsLoading(true);
    try {
      setDetails(await cancellationService.getHotelDetails(flightId, hotel.hotelCode));
    } catch (detailError) {
      setDetailsError(
        detailError instanceof Error ? detailError.message : "Failed to load hotel details",
      );
    } finally {
      setDetailsLoading(false);
    }
  };

  const hasResults = !!data && searched && data.options.length > 0;
  const visibleHotels = (data?.options ?? [])
    .filter((hotel) => !onlyMeetsMinimum || hotel.meetsMinimum)
    .slice()
    .sort((a, b) => {
      if (sortBy === "price") return a.totalPrice - b.totalPrice;
      if (sortBy === "distance") {
        return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || a.totalPrice - b.totalPrice;
      }
      if (sortBy === "stars") return b.stars - a.stars || a.totalPrice - b.totalPrice;
      return 0; // server order: meets minimum, preferred stars, stars, price
    });

  if (!mounted) return null;

  const selectedPrice = selectedHotel
    ? `${selectedHotel.currency} ${selectedHotel.totalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : null;

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
          "fixed right-0 top-0 z-[110] flex h-full w-full max-w-[560px] flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="border-b border-gray-200 px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 shrink-0 text-[#0F2757]" />
                <h2 className="truncate text-xl font-semibold text-gray-900">
                  Find a hotel · PNR {booking?.pnr}
                </h2>
              </div>
              {booking && (
                <p className="mt-1.5 text-sm text-gray-600">
                  <span className="capitalize">
                    {(data?.travelClass ?? booking.travelClass)
                      .replace(/_/g, " ")
                      .toLowerCase()}
                  </span>
                  {" · "}
                  {plural(adults, "adult", "adults")}
                  {children > 0 && `, ${plural(children, "child", "children")}`}
                  {data && (
                    <>
                      {" · "}
                      {shortDate(data.checkInDate)} – {shortDate(data.checkOutDate)} (
                      {plural(
                        nightsBetween(data.checkInDate, data.checkOutDate),
                        "night",
                        "nights",
                      )}
                      ) · min {data.minStars}★
                    </>
                  )}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {queue.length > 1 && position >= 0 && onNavigate && (
                <div className="mr-1 flex items-center gap-1 text-xs text-gray-500">
                  <button
                    type="button"
                    onClick={() => previous && onNavigate(previous)}
                    disabled={!previous || isBooking}
                    className="rounded-lg p-1.5 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Previous PNR needing a hotel"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="whitespace-nowrap tabular-nums">
                    {position + 1} of {queue.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => next && onNavigate(next)}
                    disabled={!next || isBooking}
                    className="rounded-lg p-1.5 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Next PNR needing a hotel"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
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
          </div>
          {booking && (
            <div
              className={cn(
                "mt-4 flex gap-2 rounded-lg px-3 py-2.5 text-xs",
                booking.reasonCode === "NO_ROOM_SPLIT" && arrangementPossible
                  ? "bg-amber-50 text-amber-800"
                  : "bg-red-50 text-red-700",
              )}
              title={booking.reason ?? undefined}
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className={cn("min-w-0 flex-1", hasResults && !reasonOpen && "truncate")}>
                {failureMessage(booking, data)}
              </span>
              {hasResults && (
                <button
                  type="button"
                  onClick={() => setReasonOpen((open) => !open)}
                  className="shrink-0 font-medium underline-offset-2 hover:underline"
                >
                  {reasonOpen ? "Less" : "Details"}
                </button>
              )}
            </div>
          )}
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {!detailHotel && hasResults && !criteriaOpen && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 text-gray-700">
                <Search className="h-4 w-4 shrink-0 text-[#0F2757]" />
                <span className="truncate">
                  Within {data!.radius} {unit} ·{" "}
                  {data!.rooms ? splitLabel(data!.rooms).toLowerCase() : ""}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setCriteriaOpen(true)}
                disabled={isLoading || isBooking}
                className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#0F2757] hover:underline disabled:opacity-50"
              >
                <Pencil className="h-3.5 w-3.5" /> Edit search
              </button>
            </div>
          )}
          {!detailHotel && (criteriaOpen || !hasResults) && (
          <section className="mb-5 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
            <div className="mb-3 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-[#0F2757]" />
              <h3 className="text-sm font-semibold text-gray-900">
                Search criteria
              </h3>
            </div>

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

            <div className="mt-4">
              <span className="mb-1.5 block text-xs font-medium text-gray-600">
                Room arrangement
              </span>
              <div className="flex flex-wrap gap-2">
                {splitOptions.map((option) => {
                  const active =
                    !customRooms &&
                    !!rooms &&
                    splitKey(rooms) === splitKey(option.rooms);
                  return (
                    <button
                      key={splitKey(option.rooms)}
                      type="button"
                      onClick={() => chooseSplit(option.rooms)}
                      disabled={isLoading || isBooking}
                      className={cn(
                        "rounded-lg border px-3 py-2 text-left text-xs transition-colors disabled:cursor-not-allowed",
                        active
                          ? "border-[#0F2757] bg-[#0F2757] text-white"
                          : "border-gray-300 bg-white text-gray-800 hover:border-[#0F2757]/40",
                      )}
                    >
                      <span className="font-medium">{splitLabel(option.rooms)}</span>
                      {option.recommended && (
                        <span
                          className={cn(
                            "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]",
                            active ? "bg-white/20" : "bg-green-50 text-green-700",
                          )}
                        >
                          Recommended
                        </span>
                      )}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={startCustom}
                  disabled={isLoading || isBooking || !arrangementPossible}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                    customRooms
                      ? "border-[#0F2757] bg-[#0F2757] text-white"
                      : "border-dashed border-gray-400 bg-white text-gray-700 hover:border-[#0F2757]/40",
                  )}
                >
                  Custom rooms
                </button>
              </div>
            </div>

            {customRooms && (
              <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
                <div className="space-y-2">
                  {customRooms.map((room, index) => (
                    <div
                      key={index}
                      className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-700"
                    >
                      <span className="w-14 font-medium">Room {index + 1}</span>
                      <RoomStepper
                        label="Adults"
                        value={room.adults}
                        min={1}
                        max={limits.maxAdultsPerRoom}
                        disabled={isLoading || isBooking}
                        onChange={(value) => updateCustomRoom(index, { adults: value })}
                      />
                      <RoomStepper
                        label="Children"
                        value={room.children}
                        min={0}
                        max={limits.maxChildrenPerRoom}
                        disabled={isLoading || isBooking}
                        onChange={(value) =>
                          updateCustomRoom(index, { children: value })
                        }
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setCustomRooms((current) =>
                            (current ?? []).filter((_, i) => i !== index),
                          )
                        }
                        disabled={customRooms.length === 1 || isLoading || isBooking}
                        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={`Remove room ${index + 1}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 pt-3">
                  <button
                    type="button"
                    onClick={() =>
                      setCustomRooms((current) => [
                        ...(current ?? []),
                        { adults: 1, children: 0 },
                      ])
                    }
                    disabled={
                      customRooms.length >= limits.maxRooms ||
                      isLoading ||
                      isBooking
                    }
                    className="inline-flex items-center gap-1 text-xs font-medium text-[#0F2757] hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add room
                  </button>
                  <span
                    className={cn(
                      "text-[11px]",
                      customProblem ? "text-red-600" : "text-green-700",
                    )}
                  >
                    {customProblem ?? "Everyone is placed."}
                  </span>
                </div>
                <p className="mt-2 flex items-start gap-1.5 text-[11px] text-gray-500">
                  <Info className="mt-px h-3.5 w-3.5 shrink-0" />
                  Every room needs an adult; up to {limits.maxAdultsPerRoom} adults
                  and {limits.maxChildrenPerRoom} children per room, {limits.maxRooms}{" "}
                  rooms in total.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => loadRecommendations({ radius, rooms: criteriaRooms })}
              disabled={!canSearch}
              className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0F2757] px-4 text-sm font-medium text-white hover:bg-[#162259] disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {isLoading ? "Searching hotels" : "Search hotels"}
            </button>
          </section>
          )}

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
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <AlertCircle className="h-8 w-8 text-red-500" />
              <p className="mt-3 text-sm font-medium text-gray-900">
                {error.retryable ? "Hotels could not be loaded" : "Check the search criteria"}
              </p>
              <p className="mt-1 max-w-sm text-xs text-gray-500">{error.message}</p>
              {error.retryable && (
                <button
                  type="button"
                  onClick={() => loadRecommendations({ radius, rooms: criteriaRooms })}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <RefreshCw className="h-4 w-4" /> Retry search
                </button>
              )}
            </div>
          )}

          {/* Nothing searched yet: no standard arrangement, the user sets rooms first. */}
          {!isLoading && !error && data && !searched && arrangementPossible && (
            <div className="rounded-xl border border-dashed border-gray-300 p-5 text-sm text-gray-600">
              <p className="font-medium text-gray-900">How to book this PNR</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs">
                <li>Set the rooms above so everyone is placed.</li>
                <li>Choose a distance and click Search hotels.</li>
                <li>Pick a hotel and book it.</li>
              </ol>
            </div>
          )}

          {!isLoading && !error && data && !arrangementPossible && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              This party can&apos;t be booked in FlyVoid. Arrange the stay with the
              hotel or your agent directly.
            </div>
          )}

          {!isLoading && !error && data && searched && data.options.length === 0 && (
            <div className="flex min-h-48 flex-col items-center justify-center text-center">
              <Building2 className="h-8 w-8 text-gray-400" />
              <p className="mt-3 text-sm font-medium text-gray-900">
                No hotels available
              </p>
              <p className="mt-1 max-w-sm text-xs text-gray-500">
                No hotel within {data.radius} {unit} has{" "}
                {data.rooms ? splitLabel(data.rooms).toLowerCase() : "these rooms"} free.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {nextRadius && (
                  <button
                    type="button"
                    onClick={() => {
                      setRadius(nextRadius);
                      void loadRecommendations({
                        radius: nextRadius,
                        rooms: criteriaRooms,
                      });
                    }}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0F2757] px-3 py-2 text-sm font-medium text-white hover:bg-[#162259]"
                  >
                    <Search className="h-4 w-4" /> Search {nextRadius} {unit}
                  </button>
                )}
                <button
                  type="button"
                  onClick={tryAnotherArrangement}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Try another arrangement
                </button>
              </div>
            </div>
          )}

          {!isLoading && !error && hasResults && !detailHotel && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-gray-900">
                  {plural(visibleHotels.length, "hotel", "hotels")}
                  {visibleHotels.length !== data!.options.length &&
                    ` of ${data!.options.length}`}
                </p>
                <div className="flex items-center gap-3 text-xs">
                  <label className="flex cursor-pointer items-center gap-1.5 text-gray-600">
                    <input
                      type="checkbox"
                      checked={onlyMeetsMinimum}
                      onChange={(event) => setOnlyMeetsMinimum(event.target.checked)}
                      className="size-3.5 accent-[#0F2757]"
                    />
                    Meets {data!.minStars}★ minimum
                  </label>
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value as SortKey)}
                    className="h-8 rounded-lg border border-gray-300 bg-white px-2 text-xs text-gray-800"
                    aria-label="Sort hotels"
                  >
                    {SORT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        Sort: {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {visibleHotels.length === 0 && (
                <p className="rounded-xl border border-dashed border-gray-300 p-5 text-center text-xs text-gray-500">
                  No hotel meets the {data!.minStars}★ minimum. Untick the filter to see the others.
                </p>
              )}

              {visibleHotels.map((hotel) => {
                const isSelected = selectedHotel?.hotelCode === hotel.hotelCode;
                return (
                  <div
                    key={hotel.hotelCode}
                    role="button"
                    tabIndex={0}
                    onClick={() => !isBooking && setSelectedHotel(hotel)}
                    onKeyDown={(event) => {
                      if ((event.key === "Enter" || event.key === " ") && !isBooking) {
                        event.preventDefault();
                        setSelectedHotel(hotel);
                      }
                    }}
                    className={cn(
                      "flex cursor-pointer gap-3 rounded-xl border p-3 text-left transition-colors",
                      isSelected
                        ? "border-[#0F2757] bg-[#0F2757]/[0.03] ring-1 ring-[#0F2757]"
                        : "border-gray-200 hover:border-gray-300",
                      isBooking && "cursor-not-allowed opacity-60",
                    )}
                  >
                    <HotelPhoto url={hotel.imageUrl} name={hotel.hotelName} className="h-24 w-24" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold text-gray-900">
                            {hotel.hotelName}
                          </h3>
                          <Stars count={hotel.stars} />
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-gray-900">
                            {money(hotel.totalPrice, hotel.currency)}
                          </p>
                          <p className="text-[11px] text-gray-500">
                            total ·{" "}
                            {data &&
                              plural(nightsBetween(data.checkInDate, data.checkOutDate), "night", "nights")}
                          </p>
                        </div>
                      </div>
                      <p className="mt-1 flex items-start gap-1 text-xs text-gray-500">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                        <span className="truncate">
                          {hotel.address || "Address unavailable"}
                          {hotel.distanceKm != null && ` · ${hotel.distanceKm} km from airport`}
                        </span>
                      </p>
                      <p className="mt-1 truncate text-xs text-gray-700">
                        <BedDouble className="mr-1 inline h-3 w-3 text-gray-400" />
                        {roomsSummary(hotel)}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {hotel.freeCancellationUntil ? (
                          <Badge tone="green">
                            Free cancellation until {deadlineLabel(hotel.freeCancellationUntil)}
                          </Badge>
                        ) : (
                          <Badge tone="gray">Non-refundable</Badge>
                        )}
                        {!hotel.meetsMinimum && (
                          <Badge tone="amber">Below {data!.minStars}★ minimum</Badge>
                        )}
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void openDetails(hotel);
                          }}
                          className="ml-auto inline-flex items-center gap-0.5 text-xs font-medium text-[#0F2757] hover:underline"
                        >
                          View details <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <span
                      className={cn(
                        "mt-1 flex size-5 shrink-0 items-center justify-center rounded-full border",
                        isSelected
                          ? "border-[#0F2757] bg-[#0F2757] text-white"
                          : "border-gray-300 bg-white",
                      )}
                      aria-hidden
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {detailHotel && data && (
            <HotelDetailView
              hotel={detailHotel}
              details={details}
              loading={detailsLoading}
              error={detailsError}
              minStars={data.minStars}
              nights={nightsBetween(data.checkInDate, data.checkOutDate)}
              onBack={() => setDetailHotel(null)}
              onSelect={() => {
                setSelectedHotel(detailHotel);
                setDetailHotel(null);
              }}
              selected={selectedHotel?.hotelCode === detailHotel.hotelCode}
            />
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
              className="inline-flex min-w-36 max-w-[340px] items-center justify-center gap-2 rounded-lg bg-[#0F2757] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#162259] disabled:cursor-not-allowed disabled:bg-gray-300"
            >
              {isBooking && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
              <span className="truncate">
                {isBooking
                  ? "Starting booking"
                  : selectedHotel
                    ? `Book ${selectedHotel.hotelName} · ${selectedPrice}`
                    : "Select a hotel to book"}
              </span>
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
  max,
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
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
      <span className="w-4 text-center font-semibold text-gray-900">{value}</span>
      <button
        type="button"
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        className="flex size-6 items-center justify-center rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label={`More ${label.toLowerCase()}`}
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

/** ★★★★☆ for 4 stars; "Unrated" when the hotel has no rating. */
function Stars({ count }: { count: number }) {
  const rating = Math.max(0, Math.min(5, Math.round(count)));
  if (rating === 0) {
    return <span className="mt-0.5 block text-xs text-gray-400">Unrated</span>;
  }
  return (
    <span
      className="mt-0.5 flex items-center gap-0.5"
      role="img"
      aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
      title={`${rating} star${rating === 1 ? "" : "s"}`}
    >
      {Array.from({ length: 5 }, (_, index) => (
        <Star
          key={index}
          className={cn(
            "h-3.5 w-3.5",
            index < rating ? "fill-amber-400 text-amber-400" : "text-gray-300",
          )}
        />
      ))}
    </span>
  );
}

function Badge({
  tone,
  children,
}: {
  tone: "green" | "amber" | "gray";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-medium",
        tone === "green" && "bg-green-50 text-green-700",
        tone === "amber" && "bg-amber-50 text-amber-700",
        tone === "gray" && "bg-gray-100 text-gray-600",
      )}
    >
      {children}
    </span>
  );
}

/** Hotel photo with a placeholder when there is none or it fails to load. */
function HotelPhoto({
  url,
  name,
  className,
}: {
  url?: string | null;
  name: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400",
          className,
        )}
      >
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- supplier CDN images, any host
    <img
      src={url}
      alt={name}
      onError={() => setFailed(true)}
      className={cn("shrink-0 rounded-lg object-cover", className)}
    />
  );
}

function HotelDetailView({
  hotel,
  details,
  loading,
  error,
  minStars,
  nights,
  selected,
  onBack,
  onSelect,
}: {
  hotel: HotelRecommendation;
  details: HotelDetails | null;
  loading: boolean;
  error: string | null;
  minStars: number;
  nights: number;
  selected: boolean;
  onBack: () => void;
  onSelect: () => void;
}) {
  const latitude = details?.latitude ?? hotel.latitude ?? null;
  const longitude = details?.longitude ?? hotel.longitude ?? null;
  const distance = details?.distanceFromAirportKm ?? hotel.distanceKm ?? null;
  const policies = details?.policies;
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-xs font-medium text-[#0F2757] hover:underline"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back to hotels
      </button>

      <HotelPhoto
        url={details?.imageUrl ?? hotel.imageUrl}
        name={hotel.hotelName}
        className="h-48 w-full"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900">{hotel.hotelName}</h3>
          <div className="flex flex-wrap items-center gap-2">
            <Stars count={hotel.stars} />
            {!hotel.meetsMinimum && <Badge tone="amber">Below {minStars}★ minimum</Badge>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-semibold text-gray-900">
            {money(hotel.totalPrice, hotel.currency)}
          </p>
          <p className="text-[11px] text-gray-500">
            total · {plural(hotel.rooms.length, "room", "rooms")} ·{" "}
            {plural(nights, "night", "nights")}
          </p>
        </div>
      </div>

      <div className="space-y-1.5 text-xs text-gray-600">
        <p className="flex items-start gap-1.5">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            {details?.address || hotel.address || "Address unavailable"}
            {distance != null && ` · ${distance} km from the airport`}
            {latitude != null && longitude != null && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1.5 inline-flex items-center gap-0.5 font-medium text-[#0F2757] hover:underline"
              >
                Map <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </span>
        </p>
        {details?.contact?.phones?.[0] && (
          <p className="flex items-center gap-1.5">
            <Phone className="h-3.5 w-3.5 shrink-0" /> {details.contact.phones[0].phoneNumber}
          </p>
        )}
        {details?.contact?.email && (
          <p className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 shrink-0" /> {details.contact.email}
          </p>
        )}
        {details?.website && (
          <p className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 shrink-0" />
            <a
              href={details.website}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-[#0F2757] hover:underline"
            >
              {details.website}
            </a>
          </p>
        )}
      </div>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Rooms</h4>
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          {hotel.rooms.map((room, index) => (
            <li key={index} className="space-y-1 px-3 py-2.5 text-xs">
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium text-gray-900">
                  Room {index + 1} · {room.roomName}
                </span>
                <span className="shrink-0 font-medium text-gray-900">
                  {money(room.price, room.currency)}
                </span>
              </div>
              <p className="text-gray-600">
                {guestsLabel(room)} · {room.boardName}
              </p>
              <p className={room.freeCancellationUntil ? "text-green-700" : "text-gray-500"}>
                {room.freeCancellationUntil
                  ? `Free cancellation until ${deadlineLabel(room.freeCancellationUntil)}${
                      room.cancellationPenalty != null
                        ? `, then ${money(room.cancellationPenalty, room.currency)}`
                        : ""
                    }`
                  : "Non-refundable"}
              </p>
              {(room.taxesAtProperty ?? []).length > 0 && (
                <p className="text-amber-700">
                  Pay at hotel:{" "}
                  {room.taxesAtProperty!
                    .map((tax) => `${tax.name} ${money(tax.amount, tax.currencyCode)}`)
                    .join(", ")}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading hotel details…
        </div>
      )}
      {!loading && error && <p className="text-xs text-gray-500">{error}</p>}

      {details && details.amenities.length > 0 && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Amenities
          </h4>
          <div className="flex flex-wrap gap-1.5">
            {details.amenities.map((amenity) => (
              <span key={amenity} className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-700">
                {amenity}
              </span>
            ))}
          </div>
        </section>
      )}

      {policies && (policies.checkInTime || policies.checkOutTime || policies.items.length > 0) && (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            Policies
          </h4>
          {(policies.checkInTime || policies.checkOutTime) && (
            <p className="mb-2 flex items-center gap-1.5 text-xs text-gray-700">
              <Clock className="h-3.5 w-3.5" />
              {policies.checkInTime && `Check-in from ${policies.checkInTime}`}
              {policies.checkInTime && policies.checkOutTime && " · "}
              {policies.checkOutTime && `Check-out until ${policies.checkOutTime}`}
            </p>
          )}
          <ul className="space-y-1.5 text-xs text-gray-600">
            {policies.items.map((item) => (
              <li key={item.category}>
                <span className="font-medium text-gray-800">{item.category}:</span>{" "}
                {item.details.join(" · ")}
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg text-sm font-medium",
          selected
            ? "border border-[#0F2757] text-[#0F2757]"
            : "bg-[#0F2757] text-white hover:bg-[#162259]",
        )}
      >
        <Check className="h-4 w-4" />
        {selected ? "Selected · back to hotels" : "Select this hotel"}
      </button>
    </div>
  );
}
