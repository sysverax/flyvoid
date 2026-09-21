"use client";

import { useState, useMemo, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  Wallet as WalletIcon,
  ArrowLeft,
  Loader2,
  Plus,
  Minus,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  SortHeader,
} from "@/src/components/ui/table";
import { Pagination } from "@/src/components/ui/pagination";
import { sortData, cn, formatDate } from "@/src/lib/utils";
import { TableEmptyState } from "@/src/components/ui/EmptyState";
import { FiltersCard } from "@/src/components/ui/FiltersCard";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { DatePicker } from "@/src/components/ui/DatePicker";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { WalletBalanceModal } from "@/src/components/airlines/WalletBalanceModal";
import {
  airlinesService,
  mapAirlineDTOToAirline,
  WalletTransactionItemDTO,
} from "@/src/services/airlines.service";
import { Airline } from "@/src/types/airlines";
import { toast } from "react-toastify";

export interface WalletTransactionDisplay {
  id: string;
  date: string;
  rawDate: string;
  openingBalance: string;
  amount: number;
  closingBalance: string;
  creditLimit: string;
  reason: string;
  status: "Success" | "Pending" | "Failed";
  type: string;
}

const statusOptions = [
  { value: "All Status", label: "All Status" },
  { value: "Success", label: "Success" },
  { value: "Pending", label: "Pending" },
  { value: "Failed", label: "Failed" },
];

const typeOptions = [
  { value: "All Types", label: "All Types" },
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "CANCELLED_FLIGHT_COST", label: "Cancelled Flight" },
];

export default function AirlineWalletPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const airlineId = Number(resolvedParams.id);

  const [airline, setAirline] = useState<Airline | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionDisplay[]>(
    []
  );
  const [isLoadingAirline, setIsLoadingAirline] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);

  // Modals state
  const [addWalletTarget, setAddWalletTarget] = useState<Airline | null>(null);
  const [deductWalletTarget, setDeductWalletTarget] = useState<Airline | null>(
    null
  );

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [selectedType, setSelectedType] = useState("All Types");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination state
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Sorting state
  const [sortField, setSortField] =
    useState<keyof WalletTransactionDisplay | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Fetch Airline details
  const fetchAirlineDetail = async () => {
    try {
      const dto = await airlinesService.getAirlineDetail(airlineId);
      setAirline(mapAirlineDTOToAirline(dto));
    } catch (err: any) {
      toast.error(err.message || "Failed to load airline details");
    } finally {
      setIsLoadingAirline(false);
    }
  };

  // Fetch Wallet Transactions
  const fetchTransactions = async () => {
    setIsLoadingTransactions(true);
    try {
      const typeParam =
        selectedType !== "All Types" ? selectedType : undefined;
      const statusParam =
        selectedStatus !== "All Status"
          ? selectedStatus.toUpperCase()
          : undefined;

      const res = await airlinesService.getWalletTransactions({
        airlineId,
        type: typeParam,
        status: statusParam,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page: currentPage,
        limit: resultsPerPage,
      });

      const mapped: WalletTransactionDisplay[] = (res.transactions || []).map(
        (tx: WalletTransactionItemDTO) => {
          const formattedDate = tx.createdAt
            ? new Date(tx.createdAt).toLocaleString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })
            : "N/A";

          const isCredit = tx.transactionType === "CREDIT";
          const numericAmount = isCredit
            ? Math.abs(tx.transactionAmount)
            : -Math.abs(tx.transactionAmount);

          return {
            id: `WTX-${tx.id}`,
            date: formattedDate,
            rawDate: tx.createdAt,
            openingBalance: `$${tx.openingBalance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
            amount: numericAmount,
            closingBalance: `$${tx.closingBalance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`,
            creditLimit: `$${(tx.creditLimit || 100000).toLocaleString(
              "en-US",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}`,
            reason: tx.reason || (isCredit ? "Manual top-up" : "Deduction"),
            status:
              tx.status === "SUCCESS"
                ? "Success"
                : tx.status === "PENDING"
                ? "Pending"
                : "Failed",
            type: tx.type,
          };
        }
      );

      setTransactions(mapped);
      setTotalResults(res.pagination?.totalCount || mapped.length);
    } catch (err: any) {
      toast.error(err.message || "Failed to load wallet transactions");
      setTransactions([]);
      setTotalResults(0);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  useEffect(() => {
    fetchAirlineDetail();
  }, [airlineId]);

  useEffect(() => {
    fetchTransactions();
  }, [
    airlineId,
    selectedType,
    selectedStatus,
    startDate,
    endDate,
    currentPage,
    resultsPerPage,
  ]);

  const handleClearAll = () => {
    setSearchQuery("");
    setSelectedStatus("All Status");
    setSelectedType("All Types");
    setStartDate("");
    setEndDate("");
    setSortField(null);
    setSortOrder("desc");
    setCurrentPage(1);
  };

  // Local search filter
  const filteredTransactions = useMemo(() => {
    if (!searchQuery.trim()) return transactions;
    const query = searchQuery.trim().toLowerCase();
    return transactions.filter(
      (tx) =>
        tx.id.toLowerCase().includes(query) ||
        tx.reason.toLowerCase().includes(query)
    );
  }, [transactions, searchQuery]);

  // Sort transactions
  const sortedTransactions = useMemo(() => {
    return sortData(filteredTransactions, sortField, sortOrder, ["rawDate"]);
  }, [filteredTransactions, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(totalResults / resultsPerPage));

  const handleSort = (field: keyof WalletTransactionDisplay) => {
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

  const formatAmount = (amount: number) => {
    const isPositive = amount > 0;
    const absFormatted = Math.abs(amount).toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return {
      text: `${isPositive ? "+" : "–"} $${absFormatted}`,
      color: isPositive ? "#278D68" : "#C83833",
    };
  };

  const handleAddWalletSuccess = async (
    airlineIdStr: string,
    addedAmount: number,
    remarks: string
  ) => {
    try {
      const result = await airlinesService.adjustWalletBalance({
        airlineId: Number(airlineIdStr),
        type: "CREDIT",
        amount: addedAmount,
        reason: remarks || undefined,
      });

      toast.success(
        `Successfully added $${addedAmount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })} to wallet balance`
      );

      fetchAirlineDetail();
      fetchTransactions();
    } catch (err: any) {
      toast.error(err.message || "Failed to increase wallet balance");
      throw err;
    }
  };

  const handleDeductWalletSuccess = async (
    airlineIdStr: string,
    deductedAmount: number,
    remarks: string
  ) => {
    try {
      const result = await airlinesService.adjustWalletBalance({
        airlineId: Number(airlineIdStr),
        type: "DEBIT",
        amount: deductedAmount,
        reason: remarks,
      });

      toast.success(
        `Successfully deducted $${deductedAmount.toLocaleString("en-US", {
          minimumFractionDigits: 2,
        })} from wallet balance`
      );

      fetchAirlineDetail();
      fetchTransactions();
    } catch (err: any) {
      toast.error(err.message || "Failed to deduct wallet balance");
      throw err;
    }
  };

  if (isLoadingAirline && !airline) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="mt-4 text-gray-500 font-figtree">
          Loading wallet details...
        </span>
      </div>
    );
  }

  const currentWalletBalance = airline?.spend ?? 0;
  const currentCreditLimit = airline?.creditLimit ?? 100000;

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      <div className="space-y-7">
        {/* Top Back Navigation */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push("/airlines")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Airlines</span>
          </button>
        </div>

        {/* Header Title */}
        <div>
          <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%]">
            Wallet Transactions
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            {airline?.airlineName || "Airline"} — Wallet Balance $
            {currentWalletBalance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>
        </div>

        {/* Filters Card */}
        <FiltersCard
          searchQuery={searchQuery}
          setSearchQuery={(q) => {
            setSearchQuery(q);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search by ID, refrence or reason"
          onClearFilters={handleClearAll}
        >
          {/* Status Dropdown */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
            <Dropdown
              value={selectedStatus}
              onChange={(val) => {
                setSelectedStatus(val);
                setCurrentPage(1);
              }}
              options={statusOptions}
              triggerWidthClass="w-full sm:w-40"
              widthClass="w-full sm:w-40"
            />
          </div>

          {/* Divider */}
          <div className="hidden sm:block h-11 w-[2px] bg-[#E5E7EB] mx-1.5" />

          {/* Date Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <DatePicker
              value={startDate}
              onChange={(val) => {
                setStartDate(val);
                setCurrentPage(1);
              }}
              placeholder="Start Date"
            />
            <DatePicker
              value={endDate}
              onChange={(val) => {
                setEndDate(val);
                setCurrentPage(1);
              }}
              placeholder="End Date"
            />
          </div>
        </FiltersCard>

        {/* Table Content */}
        <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white mb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[170px]">
                  <SortHeader
                    label="DATE"
                    field="date"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[140px]">
                  <SortHeader
                    label="TRANSACTION ID"
                    field="id"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[150px]">
                  <SortHeader
                    label="OPENING BALANCE"
                    field="openingBalance"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[140px]">
                  <SortHeader
                    label="AMOUNT"
                    field="amount"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[150px]">
                  <SortHeader
                    label="CLOSING BALANCE"
                    field="closingBalance"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[140px]">
                  <SortHeader
                    label="CREDIT LIMIT"
                    field="creditLimit"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[160px]">
                  <SortHeader
                    label="REASON"
                    field="reason"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
                <TableHead className="min-w-[110px]">
                  <SortHeader
                    label="STATUS"
                    field="status"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    onSort={handleSort}
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingTransactions ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="px-6 py-12 text-center text-gray-500 font-figtree"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <svg
                        className="animate-spin h-8 w-8 text-[#0F2757]"
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
                      <span>Loading wallet transactions...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedTransactions.length === 0 ? (
                <TableEmptyState
                  colSpan={8}
                  icon={Search}
                  title="No transactions found"
                  message="Try adjusting your filters or search query."
                />
              ) : (
                sortedTransactions.map((tx) => {
                  const formatted = formatAmount(tx.amount);
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="text-[#6B7280] whitespace-nowrap font-figtree">
                        {tx.date}
                      </TableCell>
                      <TableCell className="text-[#1F2937] whitespace-nowrap font-medium">
                        {tx.id}
                      </TableCell>
                      <TableCell className="text-[#6B7280] whitespace-nowrap font-figtree">
                        {tx.openingBalance}
                      </TableCell>
                      <TableCell
                        className="whitespace-nowrap font-semibold font-figtree"
                        style={{ color: formatted.color }}
                      >
                        {formatted.text}
                      </TableCell>
                      <TableCell className="font-semibold text-[#1F2937] whitespace-nowrap font-figtree">
                        {tx.closingBalance}
                      </TableCell>
                      <TableCell className="text-[#6B7280] whitespace-nowrap font-figtree">
                        {tx.creditLimit}
                      </TableCell>
                      <TableCell className="text-[#1F2937] whitespace-nowrap">
                        {tx.reason}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <StatusBadge status={tx.status} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <Pagination
          totalResults={totalResults}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          resultsPerPage={resultsPerPage}
          setResultsPerPage={setResultsPerPage}
          totalPages={totalPages}
        />
      </div>

      {/* Adjust Wallet Balance Modals */}
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
