"use client";

import { useState, useMemo } from "react";
import { Search, X, Plus, Send, Eye } from "lucide-react";
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
  status: "Published" | "Draft" | "In Progress";
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
    status: "In Progress",
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
    status: "Published",
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
    status: "Draft",
    reason: "Aircraft engine sensor malfunction",
  }
];

const STATUS_OPTIONS = [
  { value: "All Status", label: "All Status" },
  { value: "Published", label: "Published" },
  { value: "Draft", label: "Draft" },
  { value: "In Progress", label: "In Progress" },
];

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
      {isAddingNew ? (
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
                        {c.route}
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
                          {c.status !== "Published" && (
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
      {detailCancellation && (
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
            className="relative bg-white flex flex-col justify-center items-start py-6 gap-6 z-10 animate-scaleIn border border-gray-100"
            style={{ width: 560, borderRadius: 16 }}
          >
            {/* Header */}
            <div
              className="flex flex-row justify-between items-center w-full"
              style={{
                padding: "0px 24px 24px",
                borderBottom: "1px solid #D1D5DB",
              }}
            >
              <h2
                className="text-[#1F2937]"
                style={{
                  fontFamily: "Figtree",
                  fontWeight: 600,
                  fontSize: 24,
                  lineHeight: "100%",
                }}
              >
                Publish Cancellation?
              </h2>
              <button
                onClick={() => setPublishTarget(null)}
                className="p-1.5 rounded-lg transition-colors cursor-pointer flex-shrink-0"
              >
                <X className="w-5 h-5 text-[#1F2937]" />
              </button>
            </div>

            {/* Body */}
            <div
              className="px-6 text-[#6B7280] w-full text-left"
              style={{
                fontFamily: "Figtree, sans-serif",
                fontWeight: 400,
                fontSize: 18,
                lineHeight: "150%",
              }}
            >
              Are you sure you want to publish the cancellation for <span className="font-semibold text-gray-900">{publishTarget.flight}</span>? This will make the flight cancellation public and activate hotel allocation matching.
            </div>

            {/* Footer */}
            <div className="flex gap-3 px-6 w-full mt-4">
              <button
                type="button"
                onClick={() => setPublishTarget(null)}
                className="flex-1 py-2.5 rounded-lg border border-[#D1D5DB] text-[#1F2937] transition-colors hover:bg-[#F9FAFB] cursor-pointer"
                style={{
                  fontFamily: "Figtree, sans-serif",
                  fontSize: 18,
                  fontWeight: 400,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => confirmPublish(publishTarget.id)}
                className="flex-1 py-2.5 rounded-lg text-white bg-[#0F2757] hover:bg-[#162259] transition-colors cursor-pointer flex items-center justify-center gap-2 font-medium"
                style={{
                  fontFamily: "Figtree, sans-serif",
                  fontSize: 18,
                }}
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
