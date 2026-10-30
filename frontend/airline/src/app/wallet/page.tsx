"use client";

import { WalletSummaryCards } from "@/src/components/wallet/WalletSummaryCards";
import { PageHeader } from "@/src/components/layout/PageHeader";
import { useState, useMemo, useEffect } from "react";
import { Search } from "lucide-react";
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
import { sortData, cn, formatUtcStartDate, formatUtcEndDate } from "@/src/lib/utils";
import { TableEmptyState } from "@/src/components/ui/EmptyState";
import { FiltersCard } from "@/src/components/ui/FiltersCard";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { DatePicker } from "@/src/components/ui/DatePicker";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { TruncatedTooltip } from "@/src/components/ui/TruncatedTooltip";
import {
  walletService,
  WalletTransactionItemDTO,
} from "@/src/services/wallet.service";

export interface WalletTransaction {
  id: string;
  rawId: number;
  date: string;
  rawDate: string;
  openingBalance: number;
  amount: number;
  closingBalance: number;
  creditLimit: number;
  reason: string;
  status: "Success" | "Pending" | "Failed";
}

// Values are the API's transaction types (TRANSACTION_REFERENCE_TYPES).
const typeOptions = [
  { value: "All Types", label: "All Types" },
  { value: "ADJUSTMENT", label: "Adjustment" },
  { value: "BOOKING", label: "Hotel Booking" },
];

const statusOptions = [
  { value: "All Status", label: "All Status" },
  { value: "Success", label: "Success" },
  { value: "Pending", label: "Pending" },
  { value: "Failed", label: "Failed" },
];

export default function WalletPage() {
  // The wallet balance is shown in the top bar (components/layout/TopBar.tsx).
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);

  // Search & Filter state inputs
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState("All Types");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination state
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Sorting state
  const [sortField, setSortField] = useState<keyof WalletTransaction | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Fetch Wallet Transactions from GET /api/v1/wallets/transactions
  const fetchWalletTransactions = async (isMounted = true) => {
    setIsLoadingTransactions(true);
    try {
      const typeParam =
        selectedType !== "All Types" ? selectedType : undefined;
      const statusParam =
        selectedStatus !== "All Status"
          ? selectedStatus.toUpperCase()
          : undefined;

      const formattedStartDate = formatUtcStartDate(startDate);
      const formattedEndDate = formatUtcEndDate(endDate);

      if (
        formattedStartDate &&
        formattedEndDate &&
        new Date(formattedStartDate).getTime() >= new Date(formattedEndDate).getTime()
      ) {
        if (isMounted) {
          setTransactions([]);
          setTotalResults(0);
        }
        return;
      }

      const trimmedSearch = searchQuery.trim();
      let searchParam: string | undefined = undefined;

      if (trimmedSearch) {
        if (/^w(t(x(\s*-?\s*)?)?)?$/i.test(trimmedSearch)) {
          searchParam = undefined;
        } else {
          searchParam = trimmedSearch.replace(/^WTX\s*-?\s*/i, "").trim() || undefined;
        }
      }

      const res = await walletService.getWalletTransactions({
        search: searchParam,
        status: statusParam,
        startDate: formattedStartDate,
        endDate: formattedEndDate,
        page: currentPage,
        limit: resultsPerPage,
      });

      if (!isMounted) return;

      const mapped: WalletTransaction[] = (res.transactions || []).map(
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
            ? Math.abs(Number(tx.transactionAmount || 0))
            : -Math.abs(Number(tx.transactionAmount || 0));

          return {
            id: `WTX-${tx.id}`,
            rawId: Number(tx.id || 0),
            date: formattedDate,
            rawDate: tx.createdAt,
            openingBalance: Number(tx.openingBalance || 0),
            amount: numericAmount,
            closingBalance: Number(tx.closingBalance || 0),
            creditLimit: Number(tx.creditLimit || 100000),
            reason: tx.reason || (isCredit ? "Wallet top-up" : "Deduction"),
            status:
              tx.status === "SUCCESS"
                ? "Success"
                : tx.status === "PENDING"
                  ? "Pending"
                  : "Failed",
          };
        }
      );

      setTransactions(mapped);
      setTotalResults(res.pagination?.totalCount || mapped.length);
    } catch (err: any) {
      if (!isMounted) return;
      console.error("Failed to fetch wallet transactions:", err);
      setTransactions([]);
      setTotalResults(0);
    } finally {
      if (isMounted) {
        setIsLoadingTransactions(false);
      }
    }
  };

  useEffect(() => {
    let isMounted = true;

    const timeoutId = setTimeout(() => {
      fetchWalletTransactions(isMounted);
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
    };
  }, [
    searchQuery,
    selectedStatus,
    startDate,
    endDate,
    currentPage,
    resultsPerPage,
  ]);

  const handleClearAll = () => {
    setSearchQuery("");
    setSelectedType("All Types");
    setSelectedStatus("All Status");
    setStartDate("");
    setEndDate("");
    setSortField(null);
    setSortOrder("desc");
    setCurrentPage(1);
  };

  // Sort transactions
  const sortedTransactions = useMemo(() => {
    if (!sortField) return transactions;

    if (sortField === "id") {
      return [...transactions].sort((a, b) => {
        const diff = (a.rawId ?? 0) - (b.rawId ?? 0);
        return sortOrder === "asc" ? diff : -diff;
      });
    }

    if (sortField === "date") {
      return [...transactions].sort((a, b) => {
        const timeA = a.rawDate ? new Date(a.rawDate).getTime() : 0;
        const timeB = b.rawDate ? new Date(b.rawDate).getTime() : 0;
        return sortOrder === "asc" ? timeA - timeB : timeB - timeA;
      });
    }

    return sortData(transactions, sortField, sortOrder, ["rawDate", "date"]);
  }, [transactions, sortField, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(totalResults / resultsPerPage));

  const handleSort = (field: keyof WalletTransaction) => {
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
    if (amount === 0) {
      return {
        text: `$${absFormatted}`,
        color: "#6B7280",
      };
    }
    return {
      text: `${isPositive ? "+" : "–"} $${absFormatted}`,
      color: isPositive ? "#278D68" : "#C83833",
    };
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      <div className="space-y-7">
        <PageHeader />

        {/* Account summary: available, balance, credit limit, reserved */}
        <WalletSummaryCards />


        {/* Filters Card */}
        <FiltersCard
          searchQuery={searchQuery}
          setSearchQuery={(q) => {
            setSearchQuery(q);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search by transaction ID"
          onClearFilters={handleClearAll}
        >
          {/* Type Dropdown */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
            <Dropdown
              value={selectedType}
              onChange={(val) => {
                setSelectedType(val);
                setCurrentPage(1);
              }}
              options={typeOptions}
              triggerWidthClass="w-full sm:w-44"
              widthClass="w-full sm:w-44"
            />
          </div>

          {/* Status Dropdown */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
            <Dropdown
              value={selectedStatus}
              onChange={(val) => {
                setSelectedStatus(val);
                setCurrentPage(1);
              }}
              options={statusOptions}
              triggerWidthClass="w-full sm:w-44"
              widthClass="w-full sm:w-44"
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
              widthClass="w-[195px]"
            />
            <DatePicker
              value={endDate}
              onChange={(val) => {
                setEndDate(val);
                setCurrentPage(1);
              }}
              placeholder="End Date"
              widthClass="w-[195px]"
              align="right"
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
                <TableHead className="min-w-[150px]">
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
                      <TableCell className="text-[#6B7280] font-figtree">
                        <TruncatedTooltip text={tx.date} side="top">
                          <div className="max-w-[170px] truncate cursor-default">
                            {tx.date}
                          </div>
                        </TruncatedTooltip>
                      </TableCell>
                      <TableCell className="text-[#1F2937] font-medium">
                        <TruncatedTooltip text={tx.id} side="top">
                          <div className="max-w-[140px] truncate cursor-default">
                            {tx.id}
                          </div>
                        </TruncatedTooltip>
                      </TableCell>
                      <TableCell className="text-[#6B7280] font-figtree">
                        <TruncatedTooltip
                          text={`$${tx.openingBalance.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`}
                          side="top"
                        >
                          <div className="max-w-[140px] truncate cursor-default">
                            $
                            {tx.openingBalance.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </TruncatedTooltip>
                      </TableCell>
                      <TableCell
                        className="font-semibold font-figtree"
                        style={{ color: formatted.color }}
                      >
                        <TruncatedTooltip text={formatted.text} side="top">
                          <div className="max-w-[140px] truncate cursor-default">
                            {formatted.text}
                          </div>
                        </TruncatedTooltip>
                      </TableCell>
                      <TableCell className="font-semibold text-[#1F2937] font-figtree">
                        <TruncatedTooltip
                          text={`$${tx.closingBalance.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`}
                          side="top"
                        >
                          <div className="max-w-[140px] truncate cursor-default">
                            $
                            {tx.closingBalance.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </TruncatedTooltip>
                      </TableCell>
                      <TableCell className="text-[#6B7280] font-figtree">
                        <TruncatedTooltip
                          text={`$${tx.creditLimit.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}`}
                          side="top"
                        >
                          <div className="max-w-[140px] truncate cursor-default">
                            $
                            {tx.creditLimit.toLocaleString("en-US", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </div>
                        </TruncatedTooltip>
                      </TableCell>
                      <TableCell className="text-[#1F2937]">
                        <TruncatedTooltip text={tx.reason} side="top">
                          <div className="max-w-[200px] truncate cursor-default">
                            {tx.reason}
                          </div>
                        </TruncatedTooltip>
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
    </div>
  );
}
