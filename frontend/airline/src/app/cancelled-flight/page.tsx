"use client";

import { PageHeader } from "@/src/components/layout/PageHeader";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Plus,
  Send,
  Eye,
  Loader2,
} from "lucide-react";
import { toast } from "react-toastify";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  SortHeader,
} from "@/src/components/ui/table";
import { TableEmptyState } from "@/src/components/ui/EmptyState";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { FLIGHT_PAYMENT_STEP_ENABLED } from "@/src/lib/constants";
import { FiltersCard } from "@/src/components/ui/FiltersCard";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { TruncatedTooltip } from "@/src/components/ui/TruncatedTooltip";
import { useAuth } from "@/src/hooks/useAuth";
import { Pagination } from "@/src/components/ui/pagination";
import { getInitialStepFromStatus } from "./CancellationWizard";
import {
  cancellationService,
  CancelledFlightApiStatus,
  ListCancelledFlightsItemDTO,
  ListCancelledFlightsResponseDataDto,
} from "@/src/services/cancellation.service";

interface Cancellation {
  id: string;
  flight: string;
  route: string;
  cancellationDate: string;
  bookings: number;
  passengers: number;
  totalCost: number;
  status: "Published" | "Verified" | "Allocated" | "Draft" | "Paid";
  displayStatus: string;
  apiStatus: string;
  reason: string;
}

const STATUS_OPTIONS = [
  { value: "All Status", label: "All Status" },
  { value: "Draft", label: "Draft" },
  { value: "In Progress", label: "In Progress" },
  { value: "Confirmed", label: "Ready for Allocation" },
  { value: "HA In Progress", label: "Allocation In Progress" },
  { value: "Allocated", label: "Hotels Booked" },
  { value: "Paid", label: "Paid" },
  { value: "Published", label: "Published" },
  // "Paid" only comes from the payment step; hide it while that step is off.
].filter((option) => FLIGHT_PAYMENT_STEP_ENABLED || option.value !== "Paid");

const UI_STATUS_TO_API_STATUS: Record<
  string,
  CancelledFlightApiStatus | undefined
> = {
  "All Status": undefined,
  Draft: "draft",
  "In Progress": "in_progress",
  Confirmed: "passengers_booking_confirmed",
  "HA In Progress": "hotel_allocation_in_progress",
  Allocated: "allocated",
  Paid: "paid",
  Published: "published",
};

const API_STATUS_TO_UI_STATUS: Record<
  string,
  { status: Cancellation["status"]; displayStatus: string }
> = {
  draft: { status: "Draft", displayStatus: "Draft" },
  in_progress: { status: "Draft", displayStatus: "In Progress" },
  passengers_booking_confirmed: {
    status: "Verified",
    displayStatus: "Ready for Allocation",
  },
  hotel_allocation_in_progress: {
    status: "Verified",
    displayStatus: "Allocation In Progress",
  },
  allocated: { status: "Allocated", displayStatus: "Hotels Booked" },
  paid: { status: "Paid", displayStatus: "Paid" },
  published: { status: "Published", displayStatus: "Published" },
};

function formatDateString(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function mapApiCancelledFlight(
  item: ListCancelledFlightsItemDTO,
): Cancellation {
  const mappedStatus = API_STATUS_TO_UI_STATUS[item.status] || {
    status: "Draft" as const,
    displayStatus: "Draft",
  };

  const depCode =
    item.departureAirport?.code ||
    (item as any).departureAirport?.iataCode ||
    "";
  const arrCode =
    item.arrivalAirport?.code ||
    (item as any).arrivalAirport?.iataCode ||
    "";

  return {
    id: String(item.id),
    flight: item.flightNumber,
    route: `${depCode} ➔ ${arrCode}`,
    cancellationDate: formatDateString(item.cancellationDate),
    bookings: Number(item.totalBookings || 0),
    passengers: Number(item.totalPassengers || 0),
    totalCost: Number(item.totalCost || 0),
    status: mappedStatus.status,
    displayStatus: mappedStatus.displayStatus,
    apiStatus: item.status || "",
    reason: "",
  };
}

export default function CancellationPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [cancellations, setCancellations] = useState<Cancellation[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [isLoading, setIsLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Sorting
  const [sortField, setSortField] = useState<keyof Cancellation | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(10);

  // Publish Modal state
  const [publishTarget, setPublishTarget] = useState<Cancellation | null>(null);
  const [isPublishingModal, setIsPublishingModal] = useState(false);

  // Sort function
  const handleSort = (field: keyof Cancellation) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  // Clear filters
  const handleClearAll = () => {
    setSearchQuery("");
    setSelectedStatus("All Status");
    setSortField(null);
    setSortOrder("asc");
    setCurrentPage(1);
  };

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      setIsLoading(true);
      try {
        const response = await cancellationService.listCancelledFlights({
          page: currentPage,
          limit: resultsPerPage,
          status: UI_STATUS_TO_API_STATUS[selectedStatus],
          search: searchQuery.trim() || undefined,
        });

        if (isMounted) {
          const data: ListCancelledFlightsResponseDataDto | undefined =
            response?.data;
          const items = data?.cancelledFlights || [];
          setCancellations(items.map(mapApiCancelledFlight));
          setTotalCount(data?.pagination?.totalCount || 0);
        }
      } catch (error: any) {
        if (isMounted) {
          toast.error(error?.message || "Failed to load cancelled flights");
          setCancellations([]);
          setTotalCount(0);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    const timeoutId = setTimeout(() => {
      loadData();
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [searchQuery, selectedStatus, currentPage, resultsPerPage]);

  // Confirm Publish function (from modal)
  const confirmPublish = async (id: string) => {
    setIsPublishingModal(true);
    try {
      await cancellationService.publishFlight(Number(id));
      setCancellations((prev) =>
        prev.map((c) =>
          c.id === id
            ? { ...c, status: "Published", displayStatus: "Published" }
            : c,
        ),
      );
      toast.success("Cancelled flight published successfully");
      setPublishTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to publish flight");
    } finally {
      setIsPublishingModal(false);
    }
  };

  // Sorting Logic
  const sortedCancellations = useMemo(() => {
    if (!sortField) return cancellations;
    return [...cancellations].sort((a, b) => {
      if (sortField === "status") {
        const strA = (a.displayStatus || a.status || "").toLowerCase();
        const strB = (b.displayStatus || b.status || "").toLowerCase();
        if (strA < strB) return sortOrder === "asc" ? -1 : 1;
        if (strA > strB) return sortOrder === "asc" ? 1 : -1;
        return 0;
      }

      if (sortField === "cancellationDate") {
        const timeA = new Date(a.cancellationDate).getTime() || 0;
        const timeB = new Date(b.cancellationDate).getTime() || 0;
        if (timeA !== timeB) {
          return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
        }
      }

      const valA = a[sortField];
      const valB = b[sortField];

      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }

      const strA = String(valA ?? "").toLowerCase();
      const strB = String(valB ?? "").toLowerCase();

      if (strA < strB) return sortOrder === "asc" ? -1 : 1;
      if (strA > strB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [cancellations, sortField, sortOrder]);

  const totalPages = Math.ceil(totalCount / resultsPerPage) || 1;

  const handleCreate = () => {
    router.push("/cancelled-flight/create");
  };

  const handleView = (c: Cancellation) => {
    const rawStatus = (c.apiStatus || c.displayStatus || c.status).toLowerCase();
    if (rawStatus === "published") {
      router.push(`/cancelled-flight/${c.id}`);
    } else {
      const stepN = getInitialStepFromStatus(rawStatus, c.bookings);
      router.push(`/cancelled-flight/${c.id}/step-${stepN}`);
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      <div className="space-y-7">
        <PageHeader
          actions={
            hasPermission("edit") && (
              <button
                onClick={handleCreate}
                className="h-[50px] rounded-[10px] bg-[#0F2757] hover:bg-[#162259] px-4.5 py-[9px] text-[16px] font-medium font-figtree transition-colors duration-200 cursor-pointer text-white flex items-center justify-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span>Create Cancelled Flight</span>
              </button>
            )
          }
        />

        {/* Filters Card */}
        <FiltersCard
          singleRow
          searchQuery={searchQuery}
          setSearchQuery={(q) => {
            setSearchQuery(q);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search flights..."
          onClearFilters={handleClearAll}
        >
          {/* Status selector */}
          <Dropdown
            value={selectedStatus}
            onChange={(val) => {
              setSelectedStatus(val);
              setCurrentPage(1);
            }}
            options={STATUS_OPTIONS}
          />
        </FiltersCard>

        {/* Table Content */}
        <div className="w-full overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px]">
                  <SortHeader<Cancellation>
                    label="Flight"
                    field="flight"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[160px]">
                  <SortHeader<Cancellation>
                    label="Route"
                    field="route"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[160px]">
                  <SortHeader<Cancellation>
                    label="Cancellation Date"
                    field="cancellationDate"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[100px] text-center">
                  <SortHeader<Cancellation>
                    label="Bookings"
                    field="bookings"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[120px] text-center">
                  <SortHeader<Cancellation>
                    label="Passengers"
                    field="passengers"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[120px]">
                  <SortHeader<Cancellation>
                    label="Total Cost"
                    field="totalCost"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[130px]">
                  <SortHeader<Cancellation>
                    label="Status"
                    field="status"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[80px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="text-center py-12 text-[#6B7280]"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-5 w-5 text-[#0F2757]"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      <span>Loading cancellations...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedCancellations.length === 0 ? (
                <TableEmptyState
                  colSpan={8}
                  icon={Search}
                  title="No flights found"
                  message="Try adjusting your filters or search query."
                />
              ) : (
                sortedCancellations.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-[#1F2937]">
                      <TruncatedTooltip text={c.flight} side="top">
                        <div className="max-w-[120px] truncate cursor-default">
                          {c.flight}
                        </div>
                      </TruncatedTooltip>
                    </TableCell>
                    <TableCell className="text-[#6B7280]">
                      <TruncatedTooltip text={c.route.replace("➔", "→")} side="top">
                        <div className="max-w-[200px] truncate cursor-default">
                          {c.route.split("➔").map((part, i, arr) => (
                            <span key={i}>
                              {part}
                              {i < arr.length - 1 && (
                                <span className="font-bold text-gray-900">→</span>
                              )}
                            </span>
                          ))}
                        </div>
                      </TruncatedTooltip>
                    </TableCell>
                    <TableCell className="text-[#6B7280]">
                      {c.cancellationDate}
                    </TableCell>
                    <TableCell className="text-center font-medium text-[#1F2937]">
                      {c.bookings}
                    </TableCell>
                    <TableCell className="text-center font-medium text-[#1F2937]">
                      {c.passengers}
                    </TableCell>
                    <TableCell className="font-medium text-[#1F2937]">
                      $
                      {c.totalCost.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={c.displayStatus} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-start gap-1 -translate-x-1">
                        {(c.status === "Paid" ||
                          c.displayStatus === "Paid" ||
                          // Without the payment step an allocated flight is ready to publish.
                          (!FLIGHT_PAYMENT_STEP_ENABLED && c.status === "Allocated")) &&
                          hasPermission("edit") && (
                          <button
                            onClick={() => setPublishTarget(c)}
                            className="p-1 text-[#6B7280] hover:text-emerald-600 transition-colors cursor-pointer"
                            title="Publish"
                          >
                            <Send className="h-[20px] w-[20px]" />
                          </button>
                        )}
                        <button
                          onClick={() => handleView(c)}
                          className="p-1 text-[#6B7280] hover:text-[#0F2757] transition-colors cursor-pointer"
                          title="View"
                        >
                          <Eye className="h-[20px] w-[20px]" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination footer */}
        <Pagination
          totalResults={totalCount}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          resultsPerPage={resultsPerPage}
          setResultsPerPage={setResultsPerPage}
          totalPages={totalPages}
        />
      </div>

      {/* Publish Confirmation Modal */}
      {publishTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fadeIn">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setPublishTarget(null)}
          />
          <div
            className="relative bg-white flex flex-col justify-center items-start py-6 gap-5 z-10 animate-scaleIn border border-gray-100"
            style={{ width: 560, borderRadius: 16 }}
          >
            {/* Header */}
            <div
              className="flex flex-row justify-between items-center w-full"
              style={{
                padding: "0px 24px 20px",
                borderBottom: "1px solid #D1D5DB",
              }}
            >
              <h2
                className="text-[#1F2937] font-semibold text-[22px] font-figtree"
                style={{ lineHeight: "100%" }}
              >
                Publish Hotel Allocations
              </h2>
              <button
                onClick={() => setPublishTarget(null)}
                className="p-1.5 rounded-lg transition-colors cursor-pointer flex-shrink-0"
              >
                <X className="w-5 h-5 text-[#1F2937]" />
              </button>
            </div>

            {/* Body */}
            <div className="px-6 w-full text-left space-y-4">
              <p className="text-gray-500 text-[15px] leading-relaxed">
                This will finalize hotel bookings and send confirmation emails
                to all passengers.
              </p>

              <div className="bg-[#F9FAFB] rounded-xl p-4 border border-gray-100 space-y-2 text-sm text-[#4B5563]">
                <div className="flex justify-between">
                  <span className="text-gray-500">Flight</span>
                  <span className="font-semibold text-gray-800">
                    {publishTarget.flight}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Bookings</span>
                  <span className="font-semibold text-gray-800">
                    {publishTarget.bookings}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Cost</span>
                  <span className="font-semibold text-emerald-600">
                    $
                    {publishTarget.totalCost.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            </div>

             {/* Footer */}
            <div className="flex gap-3 px-6 w-full mt-2">
              <button
                type="button"
                onClick={() => setPublishTarget(null)}
                disabled={isPublishingModal}
                className="flex-1 py-3 rounded-lg border border-[#D1D5DB] text-[#1F2937] transition-colors hover:bg-[#F9FAFB] cursor-pointer font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmPublish(publishTarget.id)}
                disabled={isPublishingModal}
                className="flex-1 py-3 rounded-lg text-white bg-[#0F2757] hover:bg-[#162259] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2 font-medium"
              >
                {isPublishingModal ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Publishing...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Publish & Notify</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
