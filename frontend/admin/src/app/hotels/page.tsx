"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { countries } from "countries-list";
import { AlertTriangle, BedDouble, Download, Hotel, Loader2, Search, Users } from "lucide-react";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { DatePicker } from "@/src/components/ui/DatePicker";
import { Pagination } from "@/src/components/ui/pagination";
import { StatCard } from "@/src/components/ui/StatCard";
import { RoomsGuestsPicker } from "@/src/components/hotels/RoomsGuestsPicker";
import { HotelResultsTable } from "@/src/components/hotels/HotelResultsTable";
import { useAuth } from "@/src/hooks/useAuth";
import { describeRooms, downloadCsv, hotelsToCsv } from "@/src/lib/hotels-csv";
import { hotelCapacityStats } from "@/src/lib/hotel-stats";
import { airportsService, AirportDTO } from "@/src/services/airports.service";
import { adminHotelBookingsService, HotelProviderDTO } from "@/src/services/hotel-bookings.service";
import {
  hotelAvailabilityService,
  HotelAvailabilityResult,
  HotelAvailabilityRoom,
  HotelAvailabilitySearch,
} from "@/src/services/hotel-availability.service";

// Defaults agreed for the page: check-in two weeks out, one night, one room
// with two adults, 10 km. Radius is capped at RateHawk's 70 km.
const DEFAULT_CHECK_IN_DAYS_AHEAD = 14;
const DEFAULT_ROOMS: HotelAvailabilityRoom[] = [{ adults: 2, childrenAges: [] }];
const DEFAULT_RADIUS_KM = "10";
const RADIUS_OPTIONS = ["5", "10", "20", "30", "50", "70"].map((km) => ({ value: km, label: `${km} km` }));
const MAX_NIGHTS = 30;
// Only RateHawk searches several rooms as one multiroom order.
const MULTIROOM_PROVIDERS = new Set(["ratehawk"]);
const AIRPORT_PAGE_SIZE = 200;

const MIN_STARS_OPTIONS = [
  { value: "0", label: "Any stars" },
  { value: "3", label: "3★ and up" },
  { value: "4", label: "4★ and up" },
  { value: "5", label: "5★ only" },
];
const SORT_OPTIONS = [
  { value: "distance", label: "Sort: Distance" },
  { value: "price", label: "Sort: Lowest price" },
  { value: "stars", label: "Sort: Stars" },
];

const COUNTRY_OPTIONS = Object.entries(countries)
  .map(([code, country]) => ({ value: code, label: `${country.name} (${code})` }))
  .sort((a, b) => a.label.localeCompare(b.label));

/** Today's calendar date in an IANA timezone (browser's when none). */
function todayIn(timeZone?: string): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(date: string, days: number): string {
  const ms = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

const nightsBetween = (from: string, to: string) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/** "Nov 10" from YYYY-MM-DD, without timezone shifts. */
const shortDate = (date: string) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

const defaultDates = (timeZone?: string) => {
  const checkIn = addDays(todayIn(timeZone), DEFAULT_CHECK_IN_DAYS_AHEAD);
  return { checkIn, checkOut: addDays(checkIn, 1) };
};

export default function HotelsPage() {
  const { hasPermission } = useAuth();

  // Options
  const [providers, setProviders] = useState<HotelProviderDTO[]>([]);
  const [airports, setAirports] = useState<AirportDTO[]>([]);

  // Search form
  const [providerId, setProviderId] = useState("");
  const [airportId, setAirportId] = useState("");
  const [checkIn, setCheckIn] = useState(() => defaultDates().checkIn);
  const [checkOut, setCheckOut] = useState(() => defaultDates().checkOut);
  const [datesTouched, setDatesTouched] = useState(false);
  const [rooms, setRooms] = useState<HotelAvailabilityRoom[]>(DEFAULT_ROOMS);
  const [radius, setRadius] = useState(DEFAULT_RADIUS_KM);
  const [residency, setResidency] = useState("");

  // Results
  const [result, setResult] = useState<HotelAvailabilityResult | null>(null);
  const [lastSearch, setLastSearch] = useState<HotelAvailabilitySearch | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Client-side refinement of loaded results (no new supplier call)
  const [nameQuery, setNameQuery] = useState("");
  const [minStars, setMinStars] = useState("0");
  const [sortBy, setSortBy] = useState("distance");
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(10);

  useEffect(() => {
    adminHotelBookingsService
      .getHotelProviders({ isActive: true })
      .then((list) => setProviders(list.filter((provider) => provider.isConfigured)))
      .catch((err: Error) => toast.error(err.message));

    // Every active airport, a page at a time.
    (async () => {
      const all: AirportDTO[] = [];
      for (let page = 1; ; page += 1) {
        const res = await airportsService.getAirports({ status: true, page, limit: AIRPORT_PAGE_SIZE });
        all.push(...res.airports);
        if (page >= res.totalPages || res.airports.length === 0) break;
      }
      setAirports(all);
    })().catch((err: Error) => toast.error(err.message));
  }, []);

  const provider = providers.find((p) => String(p.id) === providerId) ?? null;
  const airport = airports.find((a) => String(a.id) === airportId) ?? null;
  const maxRooms = provider && !MULTIROOM_PROVIDERS.has(provider.code.toLowerCase()) ? 1 : 9;

  const providerOptions = useMemo(
    () => [
      { value: "", label: providers.length ? "Select provider" : "No configured provider" },
      ...providers.map((p) => ({ value: String(p.id), label: p.name })),
    ],
    [providers],
  );
  const airportOptions = useMemo(
    () => [
      { value: "", label: "Select airport" },
      ...airports
        .map((a) => ({ value: String(a.id), label: `${a.iataCode} · ${a.name}` }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ],
    [airports],
  );
  const countryOptions = useMemo(
    () => [{ value: "", label: "Guest country" }, ...COUNTRY_OPTIONS],
    [],
  );

  const handleAirportChange = (value: string) => {
    setAirportId(value);
    const selected = airports.find((a) => String(a.id) === value);
    if (!selected) return;
    // Guest country follows the airport; defaults use the airport's "today".
    setResidency(selected.countryCode?.toUpperCase() ?? "");
    if (!datesTouched) {
      const dates = defaultDates(selected.timezone);
      setCheckIn(dates.checkIn);
      setCheckOut(dates.checkOut);
    }
  };

  // Same rules as the API, so the admin sees them before searching.
  const formError = useMemo(() => {
    if (!checkIn || !checkOut) return "Choose check-in and check-out dates.";
    const today = todayIn(airport?.timezone);
    if (checkIn < today) return `Check-in must be today or later${airport ? ` at ${airport.iataCode}` : ""} (${today}).`;
    if (checkOut <= checkIn) return "Check-out must be after check-in.";
    if (nightsBetween(checkIn, checkOut) > MAX_NIGHTS) return `The stay can be at most ${MAX_NIGHTS} nights.`;
    if (rooms.length > maxRooms) return `${provider?.name ?? "This provider"} searches one room at a time.`;
    return null;
  }, [checkIn, checkOut, airport, rooms.length, maxRooms, provider]);

  const canSearch = !!provider && !!airport && !formError && !isSearching;

  const runSearch = async (params: HotelAvailabilitySearch) => {
    setIsSearching(true);
    setSearchError(null);
    setLastSearch(params);
    try {
      const data = await hotelAvailabilityService.search(params);
      setResult(data);
      setCurrentPage(1);
    } catch (err) {
      setResult(null);
      setSearchError(err instanceof Error && err.message ? err.message : "Hotel search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSearch = () => {
    if (!provider || !airport || formError) return;
    runSearch({
      providerId: provider.id,
      airportId: airport.id,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      rooms,
      radius: Number(radius),
      residency: residency || airport.countryCode.toUpperCase(),
    });
  };

  const handleReset = () => {
    const dates = defaultDates(airport?.timezone);
    setCheckIn(dates.checkIn);
    setCheckOut(dates.checkOut);
    setDatesTouched(false);
    setRooms(DEFAULT_ROOMS);
    setRadius(DEFAULT_RADIUS_KM);
    setResidency(airport?.countryCode?.toUpperCase() ?? "");
  };

  // Next wider radius for the "no results" state.
  const widerRadius = lastSearch
    ? RADIUS_OPTIONS.map((o) => Number(o.value)).find((km) => km > lastSearch.radius)
    : undefined;

  const visibleHotels = useMemo(() => {
    if (!result) return [];
    const query = nameQuery.trim().toLowerCase();
    const stars = Number(minStars);
    const list = result.hotels.filter(
      (hotel) =>
        (!query ||
          hotel.name.toLowerCase().includes(query) ||
          String(hotel.hid ?? hotel.hotelCode).includes(query)) &&
        (stars === 0 || hotel.stars >= stars),
    );
    const byDistance = (a: number | null, b: number | null) =>
      (a ?? Number.POSITIVE_INFINITY) - (b ?? Number.POSITIVE_INFINITY);
    return [...list].sort((a, b) => {
      if (sortBy === "price") return a.lowestTotalPrice - b.lowestTotalPrice;
      if (sortBy === "stars") return b.stars - a.stars || a.lowestTotalPrice - b.lowestTotalPrice;
      return byDistance(a.distanceKm, b.distanceKm) || a.lowestTotalPrice - b.lowestTotalPrice;
    });
  }, [result, nameQuery, minStars, sortBy]);

  const stats = useMemo(() => hotelCapacityStats(visibleHotels), [visibleHotels]);
  const hasResults = !isSearching && !!result && result.hotels.length > 0;
  const coverage = (count: number) =>
    count === stats.hotels
      ? "Reported by every hotel"
      : `Reported by ${count} of ${stats.hotels} hotel${stats.hotels === 1 ? "" : "s"}`;

  const totalPages = Math.max(1, Math.ceil(visibleHotels.length / resultsPerPage));
  const pagedHotels = visibleHotels.slice((currentPage - 1) * resultsPerPage, currentPage * resultsPerPage);

  const handleExport = () => {
    if (!result) return;
    downloadCsv(
      `hotels_${result.airport.code}_${result.checkInDate}_to_${result.checkOutDate}.csv`,
      hotelsToCsv(result, visibleHotels),
    );
  };

  const searchedAt = result
    ? new Date(result.searchedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "";

  const emptyState = (
    <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
      <Hotel className="h-7 w-7 text-slate-300" />
      {!result ? (
        <>
          <p className="text-sm font-medium text-slate-500">No search yet</p>
          <p className="text-sm text-slate-400">Select a provider and an airport, then click Search to see available hotels.</p>
        </>
      ) : result.hotels.length === 0 ? (
        <>
          <p className="text-sm font-medium text-slate-500">
            No hotels available within {result.radius} km of {result.airport.code} for these dates
          </p>
          <p className="text-sm text-slate-400">Try a wider radius or different dates.</p>
          {widerRadius && lastSearch && (
            <button
              type="button"
              onClick={() => {
                setRadius(String(widerRadius));
                runSearch({ ...lastSearch, radius: widerRadius });
              }}
              className="mt-2 h-9 rounded-[8px] border border-[#D1D5DB] px-4 text-[14px] text-[#1F2937] hover:bg-[#F3F4F6] cursor-pointer"
            >
              Widen to {widerRadius} km
            </button>
          )}
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-slate-500">No hotels match these filters</p>
          <p className="text-sm text-slate-400">Clear the name search or lower the minimum stars.</p>
        </>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      <div className="space-y-7">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%]">
            Hotels
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            Check live supplier availability near an airport. Nothing is booked from this page.
          </p>
        </div>

        {/* Search form */}
        <div className="space-y-[14px] rounded-[12px] border border-[#E5E7EB] bg-white p-[17px]">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <span className="block text-[13px] font-medium text-[#374151]">Provider *</span>
              <Dropdown
                value={providerId}
                onChange={(value) => setProviderId(value)}
                options={providerOptions}
                widthClass="w-60"
                triggerWidthClass="w-[180px]"
              />
            </div>
            <div className="space-y-1.5">
              <span className="block text-[13px] font-medium text-[#374151]">Airport *</span>
              <Dropdown
                value={airportId}
                onChange={handleAirportChange}
                options={airportOptions}
                widthClass="w-80 max-w-[calc(100vw-2rem)]"
                triggerWidthClass="w-[260px]"
                maxListHeightClass="max-h-60"
                searchable
                searchMatch="includes"
              />
            </div>
            <div className="space-y-1.5">
              <span className="block text-[13px] font-medium text-[#374151]">Check-in</span>
              <DatePicker
                value={checkIn}
                onChange={(value) => {
                  setDatesTouched(true);
                  setCheckIn(value);
                  // Keep at least one night.
                  if (value && (!checkOut || checkOut <= value)) setCheckOut(addDays(value, 1));
                }}
                placeholder="Check-in"
              />
            </div>
            <div className="space-y-1.5">
              <span className="block text-[13px] font-medium text-[#374151]">Check-out</span>
              <DatePicker
                value={checkOut}
                onChange={(value) => {
                  setDatesTouched(true);
                  setCheckOut(value);
                }}
                placeholder="Check-out"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <span className="block text-[13px] font-medium text-[#374151]">Rooms & guests</span>
                <RoomsGuestsPicker value={rooms} onChange={setRooms} maxRooms={maxRooms} />
              </div>
              <div className="space-y-1.5">
                <span className="block text-[13px] font-medium text-[#374151]">Radius</span>
                <Dropdown
                  value={radius}
                  onChange={setRadius}
                  options={RADIUS_OPTIONS}
                  widthClass="w-32"
                  triggerWidthClass="w-[110px]"
                />
              </div>
              <div className="space-y-1.5">
                <span className="block text-[13px] font-medium text-[#374151]">Guest country</span>
                <Dropdown
                  value={residency}
                  onChange={setResidency}
                  options={countryOptions}
                  widthClass="w-80 max-w-[calc(100vw-2rem)]"
                  triggerWidthClass="w-[220px]"
                  maxListHeightClass="max-h-60"
                  searchable
                  searchMatch="includes"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="h-11 rounded-[8px] px-[14px] text-[15px] text-[#6B7280] transition-colors hover:bg-gray-100 hover:text-gray-800 cursor-pointer"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleSearch}
                disabled={!canSearch}
                className="flex h-11 items-center gap-2 rounded-[10px] bg-primary px-5 text-[15px] font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                {isSearching ? "Searching…" : "Search"}
              </button>
            </div>
          </div>

          {provider && airport && formError && (
            <p className="text-[13px] text-red-600">{formError}</p>
          )}
        </div>

        {/* Error */}
        {searchError && !isSearching && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-red-200 bg-red-50 px-4 py-3">
            <div className="flex items-center gap-2 text-[14px] text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{searchError}</span>
            </div>
            {lastSearch && (
              <button
                type="button"
                onClick={() => runSearch(lastSearch)}
                className="h-9 rounded-[8px] border border-red-200 bg-white px-4 text-[14px] text-red-700 hover:bg-red-100 cursor-pointer"
              >
                Try again
              </button>
            )}
          </div>
        )}

        {/* KPI cards: always shown; "—" until a search returns hotels */}
        <div className="space-y-2">
          <p className="text-[13px] text-[#6B7280]">
            Capacity of the hotels matching the filters, as reported by the supplier
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard
              title="Total Hotels"
              value={hasResults ? stats.hotels.toLocaleString() : "—"}
              hint={result && !isSearching ? `Within ${result.radius} km of ${result.airport.code}` : "Run a search to see hotels"}
              icon={<Hotel className="h-5 w-5" />}
            />
            <StatCard
              title="Total Rooms"
              value={hasResults && stats.hotelsWithRooms ? stats.rooms.toLocaleString() : "—"}
              hint={
                !hasResults
                  ? "Rooms available at the supplier"
                  : stats.hotelsWithRooms
                    ? coverage(stats.hotelsWithRooms)
                    : "Supplier did not report rooms available"
              }
              icon={<BedDouble className="h-5 w-5" />}
            />
            <StatCard
              title="Passengers Supported"
              value={hasResults && stats.hotelsWithPassengers ? stats.passengers.toLocaleString() : "—"}
              hint={
                !hasResults
                  ? "Rooms available × max guests"
                  : stats.hotelsWithPassengers
                    ? `${coverage(stats.hotelsWithPassengers)} · rooms × max guests`
                    : "Supplier did not report room capacity"
              }
              icon={<Users className="h-5 w-5" />}
            />
          </div>
        </div>

        {/* Results */}
        {isSearching ? (
          <div className="flex flex-col items-center gap-3 rounded-[12px] border border-[#E5E7EB] bg-white py-16 text-center">
            <Loader2 className="h-6 w-6 animate-spin text-[#0F2757]" />
            <p className="text-[14px] text-[#6B7280]">
              Searching {provider?.name ?? "the supplier"} for hotels near {airport?.iataCode ?? "the airport"}…
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {result && (
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-[15px] font-medium text-[#1F2937]">
                    {result.hotels.length} hotel{result.hotels.length === 1 ? "" : "s"} within {result.radius} km of{" "}
                    {result.airport.code} · {shortDate(result.checkInDate)} – {shortDate(result.checkOutDate)} (
                    {result.nights} night{result.nights === 1 ? "" : "s"}) · {describeRooms(result.rooms)}
                  </p>
                  <p className="text-[13px] text-[#6B7280]">
                    {result.provider.name} · guest country {result.residency} · searched at {searchedAt} · supplier
                    prices
                  </p>
                </div>

                {result.hotels.length > 0 && (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                      <input
                        type="text"
                        value={nameQuery}
                        onChange={(event) => {
                          setNameQuery(event.target.value);
                          setCurrentPage(1);
                        }}
                        placeholder="Search hotel name or HID..."
                        className="h-11 w-[240px] rounded-[8px] border border-[#D1D5DB] bg-[#F3F4F6] pl-9 pr-3 text-[15px] placeholder-[#6B7280] focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                    <Dropdown
                      value={minStars}
                      onChange={(value) => {
                        setMinStars(value);
                        setCurrentPage(1);
                      }}
                      options={MIN_STARS_OPTIONS}
                      widthClass="w-40"
                      triggerWidthClass="w-[140px]"
                    />
                    <Dropdown
                      value={sortBy}
                      onChange={setSortBy}
                      options={SORT_OPTIONS}
                      widthClass="w-48"
                      triggerWidthClass="w-[180px]"
                    />
                    {hasPermission("export") && (
                      <button
                        type="button"
                        onClick={handleExport}
                        disabled={visibleHotels.length === 0}
                        className="flex h-11 items-center gap-2 rounded-[8px] border border-[#D1D5DB] bg-white px-4 text-[15px] text-[#1F2937] transition-colors hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                      >
                        <Download className="h-4 w-4" />
                        Export CSV
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            <HotelResultsTable hotels={pagedHotels} nights={result?.nights ?? 1} emptyState={emptyState} />

            {visibleHotels.length > 0 && (
              <Pagination
                totalResults={visibleHotels.length}
                currentPage={currentPage}
                setCurrentPage={setCurrentPage}
                resultsPerPage={resultsPerPage}
                setResultsPerPage={(size) => {
                  setResultsPerPage(size);
                  setCurrentPage(1);
                }}
                totalPages={totalPages}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
