"use client";

import { countries } from "countries-list";

import { useState, useMemo, useEffect, useRef } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  Search,
  Eye,
  AlertTriangle,
  Loader2,
  Plus,
  Minus,
  Wallet,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  SortHeader,
} from "../../components/ui/table";
import { Pagination } from "@/src/components/ui/pagination";
import { cn, sortData } from "@/src/lib/utils";
import { Airline } from "@/src/types/airlines";
import { TableEmptyState } from "@/src/components/ui/EmptyState";
import { FiltersCard } from "@/src/components/ui/FiltersCard";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { EditAirlineModal } from "@/src/components/airlines/EditAirlineModal";
import { SuspendAirlineDialog } from "@/src/components/airlines/SuspendAirlineDialog";
import { WalletBalanceModal } from "@/src/components/airlines/WalletBalanceModal";
import { useAuth } from "@/src/hooks/useAuth";
import { toast } from "react-toastify";
import {
  airlinesService,
  UpdateAirlineRequest,
  mapAirlineDTOToAirline,
  WalletSummaryDTO,
} from "@/src/services/airlines.service";
import { getCountryCode } from "@/src/lib/utils";
import { useRouter } from "next/navigation";

export default function AirlinesPage() {
  const router = useRouter();
  const [airlines, setAirlines] = useState<Airline[]>([]);
  const { hasPermission } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isViewingDetail, setIsViewingDetail] = useState<string | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [selectedCountry, setSelectedCountry] = useState("All Countries");

  // Pagination States
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Sorting States
  const [sortField, setSortField] = useState<keyof Airline | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Modals & Confirmation States
  const [editTarget, setEditTarget] = useState<Airline | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Airline | null>(null);
  const [addWalletTarget, setAddWalletTarget] = useState<Airline | null>(null);
  const [deductWalletTarget, setDeductWalletTarget] = useState<Airline | null>(
    null,
  );
  const [isSuspending, setIsSuspending] = useState(false);
  const [togglingAirlineId, setTogglingAirlineId] = useState<string | null>(
    null,
  );

  // Wallet Summary State
  const [walletSummary, setWalletSummary] = useState<WalletSummaryDTO | null>(
    null,
  );

  const fetchWalletSummary = async () => {
    try {
      const data = await airlinesService.getWalletsSummary();
      setWalletSummary(data);
    } catch (err: any) {
      console.error("Failed to fetch wallets summary:", err);
    }
  };

  const handleAddWalletSuccess = async (
    airlineId: string,
    addedAmount: number,
    remarks: string,
  ) => {
    try {
      const result = await airlinesService.adjustWalletBalance({
        airlineId: Number(airlineId),
        type: "CREDIT",
        amount: addedAmount,
        reason: remarks || undefined,
      });

      const updatedSpend =
        result?.closingBalance ??
        (airlines.find((a) => a.id === airlineId)?.spend ?? 0) + addedAmount;

      setAirlines((prev) =>
        prev.map((item) => {
          if (item.id === airlineId) {
            return { ...item, spend: updatedSpend };
          }
          return item;
        }),
      );
      toast.success(
        `Successfully added $${addedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} to wallet balance`,
      );
      fetchAirlines(false);
      fetchWalletSummary();
    } catch (err: any) {
      toast.error(err.message || "Failed to increase wallet balance");
      throw err;
    }
  };

  const handleDeductWalletSuccess = async (
    airlineId: string,
    deductedAmount: number,
    remarks: string,
  ) => {
    try {
      const result = await airlinesService.adjustWalletBalance({
        airlineId: Number(airlineId),
        type: "DEBIT",
        amount: deductedAmount,
        reason: remarks,
      });

      const updatedSpend =
        result?.closingBalance ??
        Math.max(
          0,
          (airlines.find((a) => a.id === airlineId)?.spend ?? 0) -
            deductedAmount,
        );

      setAirlines((prev) =>
        prev.map((item) => {
          if (item.id === airlineId) {
            return { ...item, spend: updatedSpend };
          }
          return item;
        }),
      );
      toast.success(
        `Successfully deducted $${deductedAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })} from wallet balance`,
      );
      fetchAirlines(false);
      fetchWalletSummary();
    } catch (err: any) {
      toast.error(err.message || "Failed to deduct wallet balance");
      throw err;
    }
  };

  const statusOptions = [
    { value: "All Status", label: "All Status" },
    { value: "Active", label: "Active" },
    { value: "Inactive", label: "Inactive" },
    { value: "Suspended", label: "Suspended" },
  ];

  const countryOptions = [
    { value: "All Countries", label: "All Countries" },
    ...Object.entries(countries)
      .map(([_, c]) => ({ value: c.name, label: c.name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ];

  const fetchAirlines = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      let isActive: boolean | undefined = undefined;
      let isSuspended: boolean | undefined = undefined;

      if (selectedStatus === "Active") {
        isActive = true;
        isSuspended = false;
      } else if (selectedStatus === "Inactive") {
        isActive = false;
        isSuspended = false;
      } else if (selectedStatus === "Suspended") {
        isSuspended = true;
      }

      const res = await airlinesService.getAirlines({
        search: searchQuery || undefined,
        isActive,
        isSuspended,
        countryCode:
          selectedCountry !== "All Countries"
            ? getCountryCode(selectedCountry)
            : undefined,
        page: currentPage,
        limit: resultsPerPage,
      });

      const mapped = res.airlines.map(mapAirlineDTOToAirline);
      setAirlines(mapped);
      setTotalResults(res.total);
    } catch (err: any) {
      toast.error(err.message || "Failed to load airlines");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAirlines();
    fetchWalletSummary();
  }, [
    searchQuery,
    selectedStatus,
    selectedCountry,
    currentPage,
    resultsPerPage,
  ]);

  const filteredAirlines = useMemo(() => {
    return airlines;
  }, [airlines]);

  // Sort Data
  const sortedAirlines = useMemo(() => {
    return sortData(filteredAirlines, sortField, sortOrder, ["onboardingDate"]);
  }, [filteredAirlines, sortField, sortOrder]);

  // Paginated Data
  const totalPages = Math.max(1, Math.ceil(totalResults / resultsPerPage));

  const handleClearAll = () => {
    setSearchQuery("");
    setSelectedStatus("All Status");
    setSelectedCountry("All Countries");
    setSortField(null);
    setSortOrder("asc");
    setCurrentPage(1);
  };

  const handleSort = (field: keyof Airline) => {
    if (sortField === field) {
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else {
        setSortField(null);
      }
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  const handleViewDetails = (id: string) => {
    setIsViewingDetail(id);
    router.push(`/airlines/${id}`);
  };

  // Toggle active/disable status from the toggle switch in the table
  const handleToggleStatus = async (airline: Airline) => {
    if (togglingAirlineId) return;
    const targetIsActive = !airline.isActive;

    setTogglingAirlineId(airline.id);
    try {
      const response = await airlinesService.updateAirline(Number(airline.id), {
        isActive: targetIsActive,
      });

      toast.success(
        response.message ||
          `Successfully ${targetIsActive ? "enabled" : "disabled"} ${airline.airlineName}`,
      );

      if (response?.data) {
        const updatedMapped = mapAirlineDTOToAirline(response.data);
        setAirlines((prev) =>
          prev.map((item) => (item.id === airline.id ? updatedMapped : item)),
        );
      } else {
        setAirlines((prev) =>
          prev.map((item) =>
            item.id === airline.id
              ? {
                  ...item,
                  isActive: targetIsActive,
                  status: item.isSuspended
                    ? "Suspended"
                    : targetIsActive
                      ? "Active"
                      : "Disabled",
                }
              : item,
          ),
        );
      }

      fetchAirlines(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update airline status");
    } finally {
      setTogglingAirlineId(null);
    }
  };

  // Trigger suspend flow
  const handleOpenSuspendConfirm = (airline: Airline) => {
    setSuspendTarget(airline);
  };

  const handleConfirmSuspend = async () => {
    if (!suspendTarget) return;

    setIsSuspending(true);
    try {
      const response = await airlinesService.updateAirline(
        Number(suspendTarget.id),
        {
          isActive: false,
          isSuspended: true,
        },
      );

      toast.success(
        response.message ||
          `Successfully suspended ${suspendTarget.airlineName}`,
      );
      setSuspendTarget(null);
      fetchAirlines();
    } catch (err: any) {
      toast.error(err.message || "Failed to suspend airline");
    } finally {
      setIsSuspending(false);
    }
  };

  // Trigger edit modal — the list row no longer carries company/contact/admin
  // details (GET /airline is a lean summary now), so fetch the full airline
  // detail before opening the form.
  const handleOpenEditModal = async (airline: Airline) => {
    try {
      const dto = await airlinesService.getAirlineDetail(Number(airline.id));
      setEditTarget(mapAirlineDTOToAirline(dto));
    } catch (err: any) {
      toast.error(err.message || "Failed to load airline details");
    }
  };

  const handleSaveEdit = async (
    updatedFields: Partial<Airline>,
    assignAirportIds: number[],
    disableAirportIds: number[],
  ) => {
    if (!editTarget) return;

    setIsSaving(true);
    try {
      const status = editTarget.status;
      const isActive = status === "Active";
      const isSuspended = status === "Suspended";

      const payload: Partial<UpdateAirlineRequest> = {
        name: updatedFields.airlineName,
        code: updatedFields.airlineCode,
        countryCode: getCountryCode(updatedFields.country || "United States"),
        companyRegistrationNumber: updatedFields.companyReg,
        website: updatedFields.website || undefined,
        contactEmail: updatedFields.contactEmail,
        contactPhone: updatedFields.contactPhone,
        timezone: updatedFields.timezone,
        logo: updatedFields.logoUrl || undefined,
        currency: updatedFields.currency,
        address: updatedFields.address,
        isActive,
        isSuspended,
        adminFirstName: updatedFields.adminFirstName,
        adminLastName: updatedFields.adminLastName,
        adminEmail: updatedFields.adminEmail,
        adminJobTitle: updatedFields.adminJobTitle,
      };

      const response = await airlinesService.updateAirline(
        Number(editTarget.id),
        payload,
      );

      if (assignAirportIds.length > 0 || disableAirportIds.length > 0) {
        await airlinesService.updateAirlineAirportAssignments(
          Number(editTarget.id),
          {
            assignAirportIds,
            disableAirportIds,
          },
        );
      }

      toast.success(response.message || "Airline updated successfully");
      setEditTarget(null);

      fetchAirlines(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update airline");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      <div className="space-y-7">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%]">
              Airlines Management
            </h1>
            <p className="text-[14px] text-[#6B7280] mt-1">
              Manage all registered airlines
            </p>
          </div>

          <div className="flex items-center rounded-[10px] border border-[#E5E7EB] bg-white px-4 py-2 shadow-2xs divide-x divide-[#E5E7EB] shrink-0">
            <div className="pr-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                TOTAL WALLET BALANCE
              </div>
              <div className="text-[18px] font-bold text-[#203663]">
                $
                {(walletSummary?.totalWalletBalance ?? 0).toLocaleString(
                  "en-US",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  },
                )}
              </div>
            </div>
            <div className="pl-4">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#6B7280]">
                TOTAL CREDIT LIMIT
              </div>
              <div className="text-[18px] font-bold text-[#203663]">
                $
                {(walletSummary?.totalCreditIssued ?? 0).toLocaleString(
                  "en-US",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  },
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Filters card */}
        <FiltersCard
          searchQuery={searchQuery}
          setSearchQuery={(q) => {
            setSearchQuery(q);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search airlines..."
          onClearFilters={handleClearAll}
        >
          {/* Status Selector */}
          <Dropdown
            value={selectedStatus}
            onChange={(val) => {
              setSelectedStatus(val);
              setCurrentPage(1);
            }}
            options={statusOptions}
            widthClass="w-44"
            triggerWidthClass="w-[180px]"
          />

          {/* Country Selector */}
          <Dropdown
            value={selectedCountry}
            onChange={(val) => {
              setSelectedCountry(val);
              setCurrentPage(1);
            }}
            options={countryOptions}
            widthClass="w-full sm:w-44"
            triggerWidthClass="w-full sm:w-44"
            maxListHeightClass="max-h-[296px]"
            searchable
          />
        </FiltersCard>

        {/* Airlines Table */}
        <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white mb-6">
          <Table>
            <TableHeader className="pt-1">
              <TableRow>
                <TableHead className="min-w-[150px]">
                  <SortHeader
                    label="AIRLINE"
                    field="airlineName"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[75px]">
                  <SortHeader
                    label="IATA"
                    field="airlineCode"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[130px]">
                  <SortHeader
                    label="COUNTRY"
                    field="country"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[130px]">
                  <SortHeader
                    label="CREDIT LIMIT($)"
                    field="creditLimit"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[145px]">
                  <SortHeader
                    label="PLATFORM FEE (%)"
                    field="platformFeePercentage"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[185px]">
                  <SortHeader
                    label="WALLET BALANCE"
                    field="spend"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[100px]">
                  <SortHeader
                    label="STATUS"
                    field="status"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                {hasPermission("edit") && (
                  <TableHead className="whitespace-nowrap min-w-[120px]">
                    Enable/Disable
                  </TableHead>
                )}
                <TableHead className="min-w-[100px]">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={9}
                    className="px-6 py-12 text-center text-gray-500 font-figtree"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-8 w-8 text-primary"
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
                      <span>Loading airlines...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedAirlines.length === 0 ? (
                <TableEmptyState
                  colSpan={9}
                  icon={Search}
                  title="No airlines found"
                  message="Try adjusting your filters or search query."
                />
              ) : (
                sortedAirlines.map((airline) => (
                  <TableRow key={airline.id}>
                    <TableCell>
                      <AirlineNameCell name={airline.airlineName} />
                    </TableCell>
                    <TableCell>
                      <span className="rounded-[4px] bg-[#E5E7EB] text-[#1F2937] font-inter text-[12px] px-2.5 py-1.5 font-medium h-[28px]">
                        {airline.airlineCode}
                      </span>
                    </TableCell>
                    <TableCell className="text-[#1F2937]">
                      {airline.country}
                    </TableCell>
                    <TableCell className="text-[#1F2937]">
                      $
                      {airline.creditLimit >= 1000
                        ? `${airline.creditLimit / 1000}K`
                        : airline.creditLimit}
                    </TableCell>
                    <TableCell className="text-[#1F2937]">
                      {airline.platformFeePercentage}%
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setAddWalletTarget(airline)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E4E9F1] text-[#203663] hover:bg-[#E0E7FF] transition-colors cursor-pointer"
                          title="Add to Wallet Balance"
                        >
                          <Plus className="h-3.5 w-3.5 stroke-[2px]" />
                        </button>
                        <span className="font-semibold text-[#1F2937] text-[14px]">
                          $
                          {(airline.spend ?? 0).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <button
                          type="button"
                          onClick={() => setDeductWalletTarget(airline)}
                          className="flex h-7 w-7 items-center justify-center rounded-full bg-[#E4E9F1] text-[#203663] hover:bg-[#E0E7FF] transition-colors cursor-pointer"
                          title="Deduct from Wallet Balance"
                        >
                          <Minus className="h-3.5 w-3.5 stroke-[2px]" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={airline.status} />
                    </TableCell>
                    {hasPermission("edit") && (
                      <TableCell>
                        {/* Enable/Disable Toggle Switch */}
                        <button
                          type="button"
                          disabled={
                            !hasPermission("edit") ||
                            togglingAirlineId === airline.id
                          }
                          onClick={() => handleToggleStatus(airline)}
                          className={cn(
                            "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none",
                            hasPermission("edit") &&
                              togglingAirlineId !== airline.id
                              ? "cursor-pointer"
                              : "cursor-not-allowed opacity-70",
                            airline.isActive ? "bg-emerald-500" : "bg-gray-200",
                          )}
                        >
                          <span
                            className={cn(
                              "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out flex items-center justify-center",
                              airline.isActive
                                ? "translate-x-5"
                                : "translate-x-0",
                            )}
                          >
                            {togglingAirlineId === airline.id && (
                              <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
                            )}
                          </span>
                        </button>
                      </TableCell>
                    )}
                    <TableCell>
                      <div className="flex items-center justify-start gap-2.5">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/airlines/${airline.id}/wallet`)
                          }
                          className="p-1 text-[#6B7280] hover:text-primary transition-colors cursor-pointer"
                          title="Wallet Transactions"
                        >
                          <Wallet className="h-[18px] w-[18px]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleViewDetails(airline.id)}
                          className="p-1 text-[#6B7280] hover:text-primary transition-colors cursor-pointer"
                          disabled={isViewingDetail === airline.id}
                          title="View Details"
                        >
                          {isViewingDetail === airline.id ? (
                            <Loader2 className="h-[18px] w-[18px] animate-spin text-[#6B7280]" />
                          ) : (
                            <Eye className="h-[18px] w-[18px]" />
                          )}
                        </button>
                        {hasPermission("edit") && (
                          <button
                            type="button"
                            onClick={() => handleOpenSuspendConfirm(airline)}
                            className="p-1 text-[#EF4444] hover:text-[#DC2626] cursor-pointer transition-colors"
                            title="Suspend Airline"
                          >
                            <AlertTriangle className="h-[18px] w-[18px]" />
                          </button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Pagination
          totalResults={totalResults}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          resultsPerPage={resultsPerPage}
          setResultsPerPage={setResultsPerPage}
          totalPages={totalPages}
        />
      </div>

      <EditAirlineModal
        isOpen={!!editTarget}
        airline={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleSaveEdit}
        isSaving={isSaving}
      />

      <SuspendAirlineDialog
        isOpen={!!suspendTarget}
        airline={suspendTarget}
        isSuspending={isSuspending}
        onClose={() => setSuspendTarget(null)}
        onConfirm={handleConfirmSuspend}
      />

      <WalletBalanceModal
        isOpen={!!addWalletTarget}
        mode="add"
        airline={addWalletTarget}
        onClose={() => setAddWalletTarget(null)}
        onSuccess={handleAddWalletSuccess}
      />

      <WalletBalanceModal
        isOpen={!!deductWalletTarget}
        mode="deduct"
        airline={deductWalletTarget}
        onClose={() => setDeductWalletTarget(null)}
        onSuccess={handleDeductWalletSuccess}
      />
    </div>
  );
}

function AirlineNameCell({ name }: { name: string }) {
  const textRef = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const checkTruncation = () => {
    if (textRef.current) {
      setIsTruncated(textRef.current.scrollWidth > textRef.current.clientWidth);
    }
  };

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild onMouseEnter={checkTruncation}>
          <div ref={textRef} className="max-w-[150px] truncate cursor-default">
            {name}
          </div>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          {isTruncated && (
            <Tooltip.Content
              side="top"
              sideOffset={5}
              className="bg-gray-100 border border-gray-200 text-gray-800 text-[13px] font-medium px-3 py-1.5 rounded-md shadow-lg max-w-xs break-words z-[100] animate-in fade-in-0 zoom-in-95 font-figtree"
            >
              {name}
              <Tooltip.Arrow className="fill-gray-100" />
            </Tooltip.Content>
          )}
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}

function MetricTooltip({
  value,
  isCurrency = false,
}: {
  value: number;
  isCurrency?: boolean;
}) {
  const compactValue = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
  const exactValue = new Intl.NumberFormat("en-US").format(value);
  const exactStr = isCurrency ? `$${exactValue}` : exactValue;
  const compactStr = isCurrency ? `$${compactValue}` : compactValue;

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <span className="cursor-default">{compactStr}</span>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            sideOffset={5}
            className="bg-gray-100 border border-gray-200 text-gray-800 text-[13px] font-medium px-3 py-1.5 rounded-md shadow-lg max-w-xs break-words z-[100] animate-in fade-in-0 zoom-in-95 font-figtree"
          >
            {exactStr}
            <Tooltip.Arrow className="fill-gray-100" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
