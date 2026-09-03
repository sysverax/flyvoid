"use client";

import { useState, useMemo } from "react";
import { Search, X, Plus, Send, Eye, ArrowLeft, Plane, Calendar, FileText, Users, DollarSign, CheckCircle2, Download, Bed, Percent, Wallet, Receipt, Star } from "lucide-react";
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
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { FiltersCard } from "@/src/components/ui/FiltersCard";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { Pagination } from "@/src/components/ui/pagination";
import CancellationWizard from "./CancellationWizard";

interface Cancellation {
  id: string;
  flight: string;
  route: string;
  cancellationDate: string;
  bookings: number;
  passengers: number;
  totalCost: number;
  status: "Published" | "Verified" | "Allocated" | "Draft" | "Paid";
  reason: string;
}

const INITIAL_CANCELLATIONS: Cancellation[] = [
  {
    id: "1",
    flight: "AA-204",
    route: "LAX → JFK",
    cancellationDate: "Aug 10, 2026",
    bookings: 24,
    passengers: 185,
    totalCost: 28400,
    status: "Published",
    reason: "Severe weather conditions (snow storm)",
  },
  {
    id: "2",
    flight: "UA-883",
    route: "SFO → ORD",
    cancellationDate: "Aug 9, 2026",
    bookings: 18,
    passengers: 120,
    totalCost: 15600,
    status: "Draft",
    reason: "Technical maintenance issue",
  },
  {
    id: "3",
    flight: "SQ-012",
    route: "SIN → LHR",
    cancellationDate: "Aug 8, 2026",
    bookings: 45,
    passengers: 310,
    totalCost: 52000,
    status: "Allocated",
    reason: "Air Traffic Control crew shortage",
  },
  {
    id: "4",
    flight: "LH-430",
    route: "FRA → JFK",
    cancellationDate: "Aug 7, 2026",
    bookings: 30,
    passengers: 240,
    totalCost: 38100,
    status: "Verified",
    reason: "Late incoming aircraft delay",
  },
  {
    id: "5",
    flight: "EK-201",
    route: "DXB → LHR",
    cancellationDate: "Aug 6, 2026",
    bookings: 12,
    passengers: 95,
    totalCost: 11200,
    status: "Paid",
    reason: "Aircraft engine sensor malfunction",
  }
];

const STATUS_OPTIONS = [
  { value: "All Status", label: "All Status" },
  { value: "Published", label: "Published" },
  { value: "Verified", label: "Verified" },
  { value: "Allocated", label: "Allocated" },
  { value: "Paid", label: "Paid" },
  { value: "Draft", label: "Draft" },
];

function PublishedDetailView({ cancellation, onClose }: { cancellation: Cancellation, onClose: () => void }) {
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(10);

  const hotelCost = cancellation.bookings * 144;
  const platformDiscount = hotelCost * 0.10;
  const hotelTax = hotelCost * 0.08;
  const subtotal = hotelCost - platformDiscount + hotelTax;
  const platformFee = subtotal * 0.05;
  const totalPayment = subtotal + platformFee;

  return (
    <div className="w-full space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center w-full mt-2">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-[#6B7280] hover:text-[#111827] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Back to Cancelled Flights</span>
        </button>
        <StatusBadge status="Published" className="h-[28px] px-3.5 text-[14px]" />
      </div>

      {/* Flight Summary Card */}
      <div className="w-full bg-white rounded-[16px] border border-gray-200 p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-[52px] h-[52px] rounded-[12px] bg-[#F3F4F6] flex items-center justify-center text-[#4B5563]">
            <Plane className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-[24px] font-bold text-[#1F2937] leading-tight">{cancellation.flight}</h2>
            <p className="text-[#6B7280] mt-0.5">{cancellation.route.replace("➔", "→")}</p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-[#F9FAFB] rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[#6B7280] mb-2">
              <Calendar className="w-[15px] h-[15px]" />
              <span className="text-[13px] font-medium">Cancellation Date</span>
            </div>
            <p className="text-[#1F2937] font-semibold">{cancellation.cancellationDate}</p>
          </div>
          <div className="bg-[#F9FAFB] rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[#6B7280] mb-2">
              <FileText className="w-[15px] h-[15px]" />
              <span className="text-[13px] font-medium">Bookings</span>
            </div>
            <p className="text-[#1F2937] font-semibold">{cancellation.bookings}</p>
          </div>
          <div className="bg-[#F9FAFB] rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[#6B7280] mb-2">
              <Users className="w-[15px] h-[15px]" />
              <span className="text-[13px] font-medium">Passengers</span>
            </div>
            <p className="text-[#1F2937] font-semibold">{cancellation.passengers}</p>
          </div>
          <div className="bg-[#F9FAFB] rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[#6B7280] mb-2">
              <DollarSign className="w-[15px] h-[15px]" />
              <span className="text-[13px] font-medium">Total Cost</span>
            </div>
            <p className="text-[#059669] font-semibold">${cancellation.totalCost.toLocaleString()}</p>
          </div>
        </div>

        <div className="h-px bg-gray-100 w-full mb-4"></div>

        <p className="text-[#4B5563] text-[15px]">
          <span className="font-semibold text-[#6B7280] mr-2">Reason:</span>
          {cancellation.reason}
        </p>
      </div>

      {/* Published Bookings Detail Card */}
      <div className="w-full bg-white rounded-[16px] border border-gray-200 p-6">
        <div className="flex justify-between items-start mb-6">
          <div className="flex items-center gap-4">
            <div className="w-[42px] h-[42px] rounded-full bg-[#ECFDF5] flex items-center justify-center text-[#10B981]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-[18px] font-bold text-[#1F2937] leading-tight">Published Bookings</h3>
              <p className="text-[#6B7280] text-[15px] mt-0.5">Confirmation emails have been sent to all passengers</p>
            </div>
          </div>
          <button className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-[#374151] px-4 py-2.5 rounded-lg font-medium transition-colors cursor-pointer text-sm">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
            <div className="flex items-center gap-2 text-gray-500 mb-3">
              <Bed className="h-4 w-4" />
              <span className="text-[13px] font-semibold uppercase">Total Room Bookings</span>
            </div>
            <div className="text-[24px] font-bold text-gray-900">{cancellation.bookings}</div>
            <div className="text-sm text-gray-400 mt-1">Rooms booked</div>
          </div>

          <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
            <div className="flex items-center gap-2 text-gray-500 mb-3">
              <Receipt className="h-4 w-4" />
              <span className="text-[13px] font-semibold uppercase">Total Hotel Cost</span>
            </div>
            <div className="text-[24px] font-bold text-gray-900">${hotelCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-sm text-gray-400 mt-1">Hotel charges before platform discount</div>
          </div>

          <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
            <div className="flex items-center gap-2 text-gray-500 mb-3">
              <Percent className="h-4 w-4" />
              <span className="text-[13px] font-semibold uppercase">Platform Discount</span>
            </div>
            <div className="text-[24px] font-bold text-green-600">-${platformDiscount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-sm text-gray-400 mt-1">Discount provided by platform</div>
          </div>

          <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
            <div className="flex items-center gap-2 text-gray-500 mb-3">
              <DollarSign className="h-4 w-4" />
              <span className="text-[13px] font-semibold uppercase">Hotel Tax</span>
            </div>
            <div className="text-[24px] font-bold text-gray-900">${hotelTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-sm text-gray-400 mt-1">Applicable hotel taxes</div>
          </div>

          <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
            <div className="flex items-center gap-2 text-gray-500 mb-3">
              <Percent className="h-4 w-4" />
              <span className="text-[13px] font-semibold uppercase">Platform Fee (5%)</span>
            </div>
            <div className="text-[24px] font-bold text-gray-900">${platformFee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-sm text-gray-400 mt-1">Platform fee on the hotel payment</div>
          </div>

          <div className="bg-[#F6F7F8] border-[2px] border-[#0F2757] rounded-xl p-5 text-left">
            <div className="flex items-center gap-2 text-[#0F2757] mb-3">
              <Wallet className="h-4 w-4" />
              <span className="text-[13px] font-semibold uppercase">Total Payment</span>
            </div>
            <div className="text-[24px] font-bold text-[#0F2757]">${totalPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div className="text-sm text-gray-500 mt-1">Total amount to be charged</div>
          </div>
        </div>

        {/* Booked Hotels Table */}
        <div className="mt-8 text-left">
          <h4 className="text-[16px] font-semibold text-[#0F2757]">Booked Hotels</h4>
          <p className="text-sm text-gray-500 mt-1">Review the hotel assigned to each booking and the associated room costs.</p>
        </div>

        <div className="overflow-x-auto border border-gray-200 rounded-xl mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[140px]">Hotel Booking ID</TableHead>
                <TableHead className="min-w-[100px]">PNR</TableHead>
                <TableHead className="min-w-[160px]">Contact</TableHead>
                <TableHead className="min-w-[120px]">Passengers</TableHead>
                <TableHead className="min-w-[180px]">Hotel</TableHead>
                <TableHead className="min-w-[100px]">Rating</TableHead>
                <TableHead className="min-w-[80px]">Rooms</TableHead>
                <TableHead className="min-w-[100px]">Total</TableHead>
                <TableHead className="min-w-[80px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: cancellation.bookings })
                .slice((currentPage - 1) * resultsPerPage, currentPage * resultsPerPage)
                .map((_, idx) => {
                  const originalIdx = (currentPage - 1) * resultsPerPage + idx;
                  const isBusiness = originalIdx === 0;
                  const hotelName = isBusiness ? "Hyatt Regency LAX" : "Holiday Inn Express LAX";
                  const stars = isBusiness ? 4 : 3;
                  const rooms = 1;
                  const bookingCost = rooms * (isBusiness ? 160 : 120);

                  return (
                    <TableRow key={originalIdx}>
                      <TableCell className="font-medium text-gray-900">HB-00023{originalIdx + 1}</TableCell>
                      <TableCell className="font-medium text-gray-900">A{originalIdx}B{originalIdx}C</TableCell>
                    <TableCell>
                      <div className="font-semibold text-gray-900">Jane Doe</div>
                      <div className="text-xs text-gray-500">jane.doe@example.com</div>
                    </TableCell>
                    <TableCell className="text-center">1 Passenger</TableCell>
                    <TableCell className="font-medium">{hotelName}</TableCell>
                    <TableCell>
                      <div className="flex items-center text-amber-400">
                        {[...Array(stars)].map((_, i) => (
                          <Star key={i} className="h-3 w-3 fill-current" />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{rooms}</TableCell>
                    <TableCell className="font-semibold text-gray-900">${bookingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                    <TableCell>
                      <button
                        type="button"
                        className="p-1.5 text-gray-400 hover:text-[#0F2757] hover:bg-gray-100 rounded transition-colors cursor-pointer"
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="mt-4">
          <Pagination
            totalResults={cancellation.bookings}
            resultsPerPage={resultsPerPage}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            setResultsPerPage={(val: number) => {
              setResultsPerPage(val);
              setCurrentPage(1);
            }}
            totalPages={Math.ceil(cancellation.bookings / resultsPerPage) || 1}
          />
        </div>

        {/* Success Banner */}
        <div className="mt-8 flex items-center justify-between bg-[#F0FDF4] border border-[#DCFCE7] rounded-xl px-5 py-4">
          <div>
            <h4 className="text-[#15803D] font-medium text-[15px]">All bookings confirmed</h4>
            <p className="text-[#64748B] text-[13px] mt-0.5">{cancellation.bookings} confirmation emails sent</p>
          </div>
          <div className="text-[22px] font-bold text-[#0F2757]">
            ${totalPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CancellationPage() {
  const [cancellations, setCancellations] = useState<Cancellation[]>(INITIAL_CANCELLATIONS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All Status");

  // Sorting
  const [sortField, setSortField] = useState<keyof Cancellation | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(10);

  // View state
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [detailCancellation, setDetailCancellation] = useState<Cancellation | null>(null);
  const [publishTarget, setPublishTarget] = useState<Cancellation | null>(null);

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

  // Confirm Publish function (from modal)
  const confirmPublish = (id: string) => {
    setCancellations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "Published" } : c))
    );
    setPublishTarget(null);
    toast.success("Published successfully");
  };

  // Filtering Logic
  const filteredCancellations = useMemo(() => {
    return cancellations.filter((c) => {
      const matchesSearch =
        searchQuery === "" ||
        c.flight.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.route.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        selectedStatus === "All Status" || c.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [cancellations, searchQuery, selectedStatus]);

  // Sorting Logic
  const sortedCancellations = useMemo(() => {
    if (!sortField) return filteredCancellations;
    return [...filteredCancellations].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];

      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      if (strA < strB) return sortOrder === "asc" ? -1 : 1;
      if (strA > strB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredCancellations, sortField, sortOrder]);

  // Pagination Logic
  const paginatedCancellations = useMemo(() => {
    const startIndex = (currentPage - 1) * resultsPerPage;
    return sortedCancellations.slice(startIndex, startIndex + resultsPerPage);
  }, [sortedCancellations, currentPage, resultsPerPage]);

  const totalPages = Math.ceil(sortedCancellations.length / resultsPerPage) || 1;

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      {detailCancellation && detailCancellation.status === "Published" ? (
        <PublishedDetailView
          cancellation={detailCancellation}
          onClose={() => setDetailCancellation(null)}
        />
      ) : isAddingNew ? (
        <CancellationWizard
          onClose={() => setIsAddingNew(false)}
          onSave={(added) => {
            setCancellations((prev) => [added, ...prev]);
            setIsAddingNew(false);
            toast.success(`Successfully published cancellation`);
          }}
        />
      ) : (
        <div className="space-y-7">
          {/* Header Block */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%]">
                Cancellation
              </h1>
              <p className="text-[14px] text-[#6B7280] mt-1">
                Manage flight cancellations and hotel allocations
              </p>
            </div>
            <button
              onClick={() => setIsAddingNew(true)}
              className="h-[50px] rounded-[10px] bg-[#0F2757] hover:bg-[#162259] px-4.5 py-[9px] text-[16px] font-medium font-figtree transition-colors duration-200 cursor-pointer text-white flex items-center justify-center gap-1.5 -translate-y-0.5"
            >
              <Plus className="h-4 w-4" />
              <span>Create Cancelled Flight</span>
            </button>
          </div>

          {/* Filters Card */}
          <FiltersCard
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
              widthClass="w-44"
              triggerWidthClass="w-[180px]"
            />
          </FiltersCard>

          {/* Cancellations Table */}
          <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white mb-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[130px]">
                    <SortHeader
                      label="Flight"
                      field="flight"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[140px]">
                    <SortHeader
                      label="Route"
                      field="route"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[170px]">
                    <SortHeader
                      label="Cancellation Date"
                      field="cancellationDate"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[110px]">
                    <SortHeader
                      label="Bookings"
                      field="bookings"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    <SortHeader
                      label="Passengers"
                      field="passengers"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[130px]">
                    <SortHeader
                      label="Total Cost"
                      field="totalCost"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[115px]">
                    <SortHeader
                      label="Status"
                      field="status"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedCancellations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-6 py-12 text-center text-gray-500 font-figtree">
                      No flight cancellations found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedCancellations.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="text-[#1F2937]">
                        {c.flight}
                      </TableCell>
                      <TableCell className="text-[#6B7280]">
                        {c.route.split("➔").map((part, i, arr) => (
                          <span key={i}>
                            {part}
                            {i < arr.length - 1 && <span className="font-bold text-gray-900">→</span>}
                          </span>
                        ))}
                      </TableCell>
                      <TableCell className="text-[#6B7280]">
                        {c.cancellationDate}
                      </TableCell>
                      <TableCell className="text-[#6B7280]">
                        {c.bookings}
                      </TableCell>
                      <TableCell className="text-[#6B7280]">
                        {c.passengers}
                      </TableCell>
                      <TableCell className="text-[#6B7280]">
                        ${c.totalCost.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={c.status} />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-start gap-1 -translate-x-1">
                          {c.status === "Paid" && (
                            <button
                              onClick={() => setPublishTarget(c)}
                              className="p-1 text-[#6B7280] hover:text-emerald-600 transition-colors cursor-pointer"
                              title="Publish"
                            >
                              <Send className="h-[20px] w-[20px]" />
                            </button>
                          )}
                          <button
                            onClick={() => setDetailCancellation(c)}
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
            totalResults={sortedCancellations.length}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            resultsPerPage={resultsPerPage}
            setResultsPerPage={setResultsPerPage}
            totalPages={totalPages}
          />
        </div>
      )}

      {/* Details Modal */}
      {detailCancellation && detailCancellation.status !== "Published" && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center transition-opacity duration-300 p-4"
          onClick={() => setDetailCancellation(null)}
        >
          {/* Modal Container */}
          <div
            className="w-[540px] max-w-[calc(100vw-32px)] bg-white rounded-3xl flex flex-col justify-start items-start gap-4 overflow-hidden shadow-2xl transition-all duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="self-stretch px-6 py-5 border-b border-gray-300 flex justify-between items-center">
              <div className="flex justify-start items-center gap-2">
                <h2 className="text-gray-900 text-2xl font-semibold font-figtree translate-y-0.5">
                  Cancellation Details
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDetailCancellation(null)}
                className="p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5 text-gray-955" />
              </button>
            </div>

            {/* Body */}
            <div className="self-stretch px-6 pb-5 flex flex-col justify-start items-start gap-6">
              <div className="self-stretch flex flex-col gap-3.5 text-left">
                <div className="self-stretch flex justify-between items-center">
                  <div className="text-gray-550 text-[16px] font-normal font-figtree h-[19px] leading-normal">Flight Code</div>
                  <div className="text-right text-gray-900 text-[16px] font-medium font-figtree h-[19px] leading-normal">
                    {detailCancellation.flight}
                  </div>
                </div>

                <div className="self-stretch flex justify-between items-center">
                  <div className="text-gray-550 text-[16px] font-normal font-figtree h-[19px] leading-normal">Route</div>
                  <div className="text-right text-gray-900 text-[16px] font-medium font-figtree h-[19px] leading-normal">
                    {detailCancellation.route}
                  </div>
                </div>

                <div className="self-stretch flex justify-between items-center">
                  <div className="text-gray-550 text-[16px] font-normal font-figtree h-[19px] leading-normal">Cancellation Date</div>
                  <div className="text-right text-gray-900 text-[16px] font-medium font-figtree h-[19px] leading-normal">
                    {detailCancellation.cancellationDate}
                  </div>
                </div>

                <div className="self-stretch flex justify-between items-center">
                  <div className="text-gray-550 text-[16px] font-normal font-figtree h-[19px] leading-normal">Bookings</div>
                  <div className="text-right text-gray-900 text-[16px] font-medium font-figtree h-[19px] leading-normal">
                    {detailCancellation.bookings}
                  </div>
                </div>

                <div className="self-stretch flex justify-between items-center">
                  <div className="text-gray-550 text-[16px] font-normal font-figtree h-[19px] leading-normal">Passengers</div>
                  <div className="text-right text-gray-900 text-[16px] font-medium font-figtree h-[19px] leading-normal">
                    {detailCancellation.passengers}
                  </div>
                </div>

                <div className="self-stretch flex justify-between items-center">
                  <div className="text-gray-550 text-[16px] font-normal font-figtree h-[19px] leading-normal">Total Cost</div>
                  <div className="text-right text-gray-900 text-[16px] font-medium font-figtree h-[19px] leading-normal">
                    ${detailCancellation.totalCost.toLocaleString()}
                  </div>
                </div>

                <div className="self-stretch flex justify-between items-center">
                  <div className="text-gray-550 text-[16px] font-normal font-figtree h-[19px] leading-normal">Reason</div>
                  <div className="text-right text-gray-900 text-[16px] font-medium font-figtree h-[19px] leading-normal">
                    {detailCancellation.reason}
                  </div>
                </div>

                <div className="self-stretch flex justify-between items-center">
                  <div className="text-gray-550 text-[16px] font-normal font-figtree h-[19px] leading-normal">Status</div>
                  <div className="text-right">
                    <StatusBadge status={detailCancellation.status} />
                  </div>
                </div>
              </div>

              {/* Divider */}
              <div className="self-stretch h-0 border-t border-gray-300"></div>

              {/* Close Button */}
              <div className="self-stretch inline-flex justify-end items-center gap-2.5 translate-y-0.5">
                <button
                  type="button"
                  onClick={() => setDetailCancellation(null)}
                  className="h-[42px] w-[128px] flex items-center justify-center bg-[#0F2757] hover:bg-[#162259] text-white text-lg font-normal font-figtree rounded-[10px] transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Publish Confirmation Modal */}
      {publishTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 animate-fadeIn">
          <div className="absolute inset-0 bg-black/40" onClick={() => setPublishTarget(null)} />
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
                This will finalize hotel bookings and send confirmation emails to all passengers.
              </p>

              <div className="w-full bg-[#F8F9FA] rounded-xl p-5 space-y-3 text-[15px]">
                <div className="flex justify-between items-center text-gray-800">
                  <span>Flight</span>
                  <span className="font-semibold text-gray-900">{publishTarget.flight}</span>
                </div>
                <div className="flex justify-between items-center text-gray-800">
                  <span>Route</span>
                  <span className="font-semibold text-gray-900">{publishTarget.route}</span>
                </div>
                <div className="flex justify-between items-center text-gray-800">
                  <span>Bookings</span>
                  <span className="font-semibold text-gray-900">{publishTarget.bookings}</span>
                </div>
                <div className="flex justify-between items-center text-gray-800">
                  <span>Passengers</span>
                  <span className="font-semibold text-gray-900">{publishTarget.passengers}</span>
                </div>
                <div className="flex justify-between items-center text-gray-800 pt-3 border-t border-gray-200 mt-1">
                  <span className="font-medium text-gray-900">Total Cost</span>
                  <span className="font-bold text-gray-900 text-[17px]">${publishTarget.totalCost.toLocaleString()}</span>
                </div>
              </div>

              <div className="w-full bg-[#FFF7E8] border border-[#FBE0C3] p-4 rounded-xl text-sm text-[#F59E0B] text-left">
                <p>
                  <span className="font-bold">Note:</span> This action cannot be undone. Passengers will receive their hotel booking confirmations immediately.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 w-full mt-2">
              <button
                type="button"
                onClick={() => setPublishTarget(null)}
                className="flex-1 py-3 rounded-lg border border-[#D1D5DB] text-[#1F2937] transition-colors hover:bg-[#F9FAFB] cursor-pointer font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmPublish(publishTarget.id)}
                className="flex-1 py-3 rounded-lg text-white bg-[#0F2757] hover:bg-[#162259] transition-colors cursor-pointer flex items-center justify-center gap-2 font-medium"
              >
                <Send className="h-4 w-4" />
                <span>Publish & Notify</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
