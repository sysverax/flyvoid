"use client";

import { useState, useMemo, useEffect } from "react";
import { X, Plus, CreditCard, Star, Trash2, Wallet, Download, ChevronDown, Building2, FileCheck } from "lucide-react";
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
import { PaymentDrawer } from "@/src/components/ui/PaymentDrawer";
import { Pagination } from "@/src/components/ui/pagination";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { FiltersCard } from "@/src/components/ui/FiltersCard";

interface SavedCard {
  id: string;
  brand: string;
  last4: string;
  expiry: string;
  holder: string;
  isDefault: boolean;
}

// Payment History Record Interface
interface PaymentRecord {
  id: string; // Reference
  date: string; // Payment Date
  method: string;
  amount: number;
  status: string;
  approvedBy: string;
}

// Transaction History Interface
interface Transaction {
  id: string;
  type: string; // e.g. "Payment" or "Booking Service Fee"
  description: string;
  date: string;
  amount: number;
  status: string;
}

const INITIAL_CARDS: SavedCard[] = [
  {
    id: "1",
    brand: "Visa",
    last4: "4242",
    expiry: "08/28",
    holder: "Skyward Airlines Ltd",
    isDefault: false,
  },
  {
    id: "2",
    brand: "Mastercard",
    last4: "5599",
    expiry: "03/27",
    holder: "Skyward Operations",
    isDefault: true,
  },
];

// Initial Payment History mock data
const INITIAL_PAYMENTS: PaymentRecord[] = [
  { id: "TX-9021", date: "Aug 12, 2026", method: "Credit Card", amount: 3500, status: "Success", approvedBy: "Auto-approved" },
  { id: "TX-9022", date: "Aug 05, 2026", method: "Credit Card", amount: 1200, status: "Success", approvedBy: "Auto-approved" },
  { id: "TX-9023", date: "Jul 28, 2026", method: "Bank Transfer", amount: 2500, status: "Success", approvedBy: "Sarah Jenkins" },
  { id: "TX-9024", date: "Jul 15, 2026", method: "Credit Card", amount: 1800, status: "Failed", approvedBy: "Auto-declined" },
  { id: "TX-9025", date: "Jul 01, 2026", method: "Bank Transfer", amount: 950, status: "Rejected", approvedBy: "John Admin" },
];

// Initial Transaction History mock data
const INITIAL_TRANSACTIONS: Transaction[] = [
  { id: "TX-9021", type: "Payment", description: "Service fee payment - Mastercard •••• 5599", date: "Aug 13, 2026, 12:56 AM", amount: -6287, status: "Success" },
  { id: "TX-9022", type: "Booking Service Fee", description: "Platform fee charge - Flight SW7781", date: "Jul 20, 2026, 03:30 PM", amount: 340, status: "Success" },
  { id: "TX-9023", type: "Payment", description: "Service fee payment - Visa •••• 4242", date: "Aug 05, 2026, 09:15 AM", amount: -1200, status: "Success" },
  { id: "TX-9024", type: "Booking Service Fee", description: "Platform fee charge - Flight AA-204", date: "Jul 28, 2026, 11:20 AM", amount: 220, status: "Success" },
  { id: "TX-9025", type: "Payment", description: "Service fee payment - Bank Transfer", date: "Jul 15, 2026, 02:45 PM", amount: -1800, status: "Pending" },
  { id: "TX-9026", type: "Booking Service Fee", description: "Platform fee charge - Flight UA-883", date: "Jul 10, 2026, 04:10 PM", amount: 180, status: "Success" },
];

const STATUS_OPTIONS = [
  { value: "All Statuses", label: "All Statuses" },
  { value: "Success", label: "Success" },
  { value: "Pending", label: "Pending" },
  { value: "Failed", label: "Failed" },
  { value: "Rejected", label: "Rejected" },
];

function formatDateString(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
}

export default function BillingPage() {
  const [balance, setBalance] = useState(6287);
  const [cards, setCards] = useState<SavedCard[]>(INITIAL_CARDS);

  // Separate states for the two tables
  const [payments, setPayments] = useState<PaymentRecord[]>(INITIAL_PAYMENTS);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);

  // Drawer & Modals
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);

  // Add Card Form Inputs
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardSetAsDefault, setCardSetAsDefault] = useState(false);

  // Common Filter State Variables
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All Statuses");

  // Sorting & Pagination for Payment History Table
  const [paySortField, setPaySortField] = useState<keyof PaymentRecord | null>(null);
  const [paySortOrder, setPaySortOrder] = useState<"asc" | "desc">("asc");
  const [payCurrentPage, setPayCurrentPage] = useState(1);
  const [payResultsPerPage, setPayResultsPerPage] = useState(5);

  // Sorting & Pagination for Transaction History Table
  const [txSortField, setTxSortField] = useState<keyof Transaction | null>(null);
  const [txSortOrder, setTxSortOrder] = useState<"asc" | "desc">("asc");
  const [txCurrentPage, setTxCurrentPage] = useState(1);
  const [txResultsPerPage, setTxResultsPerPage] = useState(5);

  // Outstanding limits
  const creditLimit = 25000;
  const remainingCredit = creditLimit - balance;
  const utilizationPercent = (balance / creditLimit) * 100;

  // Handle Pay Outstanding Completed (triggers updates in both tables)
  const handlePaymentComplete = (amount: number, method: "card" | "bank", title: string, description: string) => {
    setBalance((prev) => Math.max(0, prev - amount));

    const defaultCard = cards.find((c) => c.isDefault);
    const cardDesc = method === "card"
      ? `${defaultCard?.brand || "Card"} •••• ${defaultCard?.last4 || "5599"}`
      : "Bank Transfer";

    const now = new Date();
    const formattedDateTime = now.toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    }) + ", " + now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    const refId = `TX-${Math.floor(Math.random() * 1000) + 2000}`;

    // 1. Add to Payment History Table
    const newPayment: PaymentRecord = {
      id: refId,
      date: formatDateString(now.toISOString()),
      method: method === "card" ? "Credit Card" : "Bank Transfer",
      amount: amount,
      status: method === "card" ? "Success" : "Pending",
      approvedBy: method === "card" ? "Auto-approved" : "Pending Review",
    };
    setPayments((prev) => [newPayment, ...prev]);

    // 2. Add to Transaction History Table
    const newTx: Transaction = {
      id: refId,
      type: "Payment",
      description: `Service fee payment - ${cardDesc.toUpperCase()}`,
      date: "Aug 19, 2026",
      amount: -amount,
      status: "Completed",
    };
    setTransactions((prev) => [newTx, ...prev]);

    // Show toast using react-toastify
    toast.success(title);
  };

  // Add new card handler
  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardHolder || !cardNumber || !cardExpiry) return;

    const last4 = cardNumber.slice(-4) || "0000";
    
    // Auto-detect brand from card number
    let brandLabel = "Visa";
    const cleanNum = cardNumber.replace(/\s+/g, "");
    if (cleanNum.startsWith("4")) {
      brandLabel = "Visa";
    } else if (cleanNum.startsWith("5")) {
      brandLabel = "Mastercard";
    } else if (cleanNum.startsWith("3")) {
      brandLabel = "American Express";
    }

    const added: SavedCard = {
      id: String(Date.now()),
      brand: brandLabel,
      last4: last4,
      expiry: cardExpiry,
      holder: cardHolder,
      isDefault: cards.length === 0 || cardSetAsDefault,
    };

    setCards((prev) => {
      const updated = cardSetAsDefault ? prev.map((c) => ({ ...c, isDefault: false })) : prev;
      return [...updated, added];
    });
    setIsAddCardOpen(false);

    // Reset fields
    setCardHolder("");
    setCardNumber("");
    setCardExpiry("");
    setCardCvv("");
    setCardSetAsDefault(false);

    toast.success("Card added successfully");
  };

  // Set default card handler
  const handleSetDefaultCard = (id: string) => {
    setCards((prev) =>
      prev.map((c) => ({
        ...c,
        isDefault: c.id === id,
      }))
    );
    const target = cards.find((c) => c.id === id);
    if (target) {
      toast.success("Default card updated");
    }
  };

  // Delete card handler
  const handleDeleteCard = (id: string) => {
    const target = cards.find((c) => c.id === id);
    if (target?.isDefault) {
      alert("You cannot delete your default payment method. Set another card as default first.");
      return;
    }
    setCards((prev) => prev.filter((c) => c.id !== id));
    if (target) {
      toast.success("Card removed successfully");
    }
  };

  // Common Clear Filters Handler
  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedStatus("All Statuses");
    setPaySortField(null);
    setPaySortOrder("asc");
    setPayCurrentPage(1);
    setTxSortField(null);
    setTxSortOrder("asc");
    setTxCurrentPage(1);
  };

  // Filter & Sorting logic for Payment History
  const handlePaySort = (field: keyof PaymentRecord) => {
    if (paySortField === field) {
      setPaySortOrder(paySortOrder === "asc" ? "desc" : "asc");
    } else {
      setPaySortField(field);
      setPaySortOrder("asc");
    }
    setPayCurrentPage(1);
  };

  const filteredPayments = useMemo(() => {
    return payments.filter((p) => {
      const matchesSearch =
        searchQuery === "" ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.approvedBy.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        selectedStatus === "All Statuses" || p.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [payments, searchQuery, selectedStatus]);

  const sortedPayments = useMemo(() => {
    if (!paySortField) return filteredPayments;
    return [...filteredPayments].sort((a, b) => {
      const valA = a[paySortField];
      const valB = b[paySortField];

      if (typeof valA === "number" && typeof valB === "number") {
        return paySortOrder === "asc" ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      if (strA < strB) return paySortOrder === "asc" ? -1 : 1;
      if (strA > strB) return paySortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredPayments, paySortField, paySortOrder]);

  const paginatedPayments = useMemo(() => {
    const startIndex = (payCurrentPage - 1) * payResultsPerPage;
    return sortedPayments.slice(startIndex, startIndex + payResultsPerPage);
  }, [sortedPayments, payCurrentPage, payResultsPerPage]);

  const payTotalPages = Math.ceil(sortedPayments.length / payResultsPerPage) || 1;

  // Sorting & Filtering logic for Transaction History
  const handleTxSort = (field: keyof Transaction) => {
    if (txSortField === field) {
      setTxSortOrder(txSortOrder === "asc" ? "desc" : "asc");
    } else {
      setTxSortField(field);
      setTxSortOrder("asc");
    }
    setTxCurrentPage(1);
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch =
        searchQuery === "" ||
        tx.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.description.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        selectedStatus === "All Statuses" || tx.status === selectedStatus;

      return matchesSearch && matchesStatus;
    });
  }, [transactions, searchQuery, selectedStatus]);

  const sortedTransactions = useMemo(() => {
    if (!txSortField) return filteredTransactions;
    return [...filteredTransactions].sort((a, b) => {
      const valA = a[txSortField];
      const valB = b[txSortField];

      if (typeof valA === "number" && typeof valB === "number") {
        return txSortOrder === "asc" ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      if (strA < strB) return txSortOrder === "asc" ? -1 : 1;
      if (strA > strB) return txSortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredTransactions, txSortField, txSortOrder]);

  const paginatedTransactions = useMemo(() => {
    const startIndex = (txCurrentPage - 1) * txResultsPerPage;
    return sortedTransactions.slice(startIndex, startIndex + txResultsPerPage);
  }, [sortedTransactions, txCurrentPage, txResultsPerPage]);

  const txTotalPages = Math.ceil(sortedTransactions.length / txResultsPerPage) || 1;

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      <div className="space-y-7">
        <div>
          <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%]">
            Billing & Payments
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1 font-figtree">
            Platform fees, payment methods and payment history
          </p>
        </div>

        {/* Row cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Outstanding Balance card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col justify-between h-auto min-h-[300px]">
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-[#1F2937] font-figtree">
                    Outstanding Platform Balance
                  </h3>
                  <p className="text-sm text-[#6B7280] mt-0.5 font-figtree">
                    Platform fees payable
                  </p>
                </div>
                <div className="size-11 bg-gray-50 rounded-xl flex items-center justify-center border border-gray-100">
                  <Wallet className="h-[22px] w-[22px] text-gray-500" />
                </div>
              </div>

              {/* Price value block */}
              <div className="mt-5">
                <span className="text-[36px] font-bold text-gray-900 leading-none font-figtree">
                  ${balance.toLocaleString()}
                </span>
                <p className="text-sm text-gray-500 mt-1 font-figtree">
                  of ${creditLimit.toLocaleString()} credit limit used
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden mt-5 relative">
                <div
                  className="bg-[#0F2757] h-full transition-all duration-500"
                  style={{ width: `${utilizationPercent}%` }}
                />
              </div>

              {/* Label values below progress bar */}
              <div className="flex justify-between items-center text-xs text-gray-500 font-medium font-figtree mt-2.5">
                <span>{utilizationPercent.toFixed(0)}% of limit</span>
                <span>${remainingCredit.toLocaleString()} remaining</span>
              </div>
            </div>

            {/* Pay Now Button */}
            <button
              onClick={() => balance > 0 && setIsPaymentDrawerOpen(true)}
              disabled={balance === 0}
              className={`w-full py-3.5 text-center text-sm font-semibold rounded-lg transition-colors duration-200 mt-5 border ${
                balance > 0
                  ? "bg-[#0F2757] hover:bg-[#162259] text-white border-transparent cursor-pointer"
                  : "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
              }`}
            >
              Pay Now
            </button>
          </div>

          {/* Payment Methods card */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col h-auto min-h-[300px]">
            <div className="flex justify-between items-start pb-5">
              <div>
                <h3 className="text-lg font-semibold text-[#1F2937] font-figtree">
                  Payment Methods
                </h3>
                <p className="text-sm text-[#6B7280] mt-0.5 font-figtree">
                  Cards used for hotel bookings and fee payments
                </p>
              </div>
              <button
                onClick={() => setIsAddCardOpen(true)}
                className="bg-[#0F2757] hover:bg-[#162259] text-white px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer flex items-center gap-1.5 font-figtree"
              >
                <Plus className="h-4 w-4" />
                <span>Add Card</span>
              </button>
            </div>

            {/* Card row list */}
            <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
              {cards.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-6 text-gray-400 font-figtree">
                  No payment methods added.
                </div>
              ) : (
                cards.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                      c.isDefault ? "border-blue-200 bg-blue-50/20" : "border-gray-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className="size-11 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-100">
                        <CreditCard className="h-5 w-5 text-gray-500" />
                      </div>
                      <div className="font-figtree">
                        <div className="flex items-center gap-2">
                          <span className="text-[15px] font-semibold text-gray-900">
                            {c.brand} •••• {c.last4}
                          </span>
                          {c.isDefault && (
                            <span className="bg-gray-100 text-gray-600 text-[11px] px-2 py-0.5 rounded-md font-semibold border border-gray-200">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {c.holder} • Expires {c.expiry}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {!c.isDefault && (
                        <button
                          onClick={() => handleSetDefaultCard(c.id)}
                          className="border border-gray-300 text-gray-700 hover:bg-gray-50 flex items-center gap-1 text-[13px] font-semibold px-3 py-1.5 rounded-lg cursor-pointer font-figtree"
                          title="Set Default"
                        >
                          <Star className="h-3.5 w-3.5 fill-none" />
                          <span>Set Default</span>
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteCard(c.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors p-2.5 cursor-pointer rounded-lg hover:bg-red-50"
                        title="Remove Card"
                      >
                        <Trash2 className="h-4.5 w-4.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Common Filters Card */}
        <FiltersCard
          searchQuery={searchQuery}
          setSearchQuery={(q) => {
            setSearchQuery(q);
            setPayCurrentPage(1);
            setTxCurrentPage(1);
          }}
          searchPlaceholder="Search transactions by reference ID or description..."
          onClearFilters={handleClearFilters}
        >
          {/* Status dropdown */}
          <Dropdown
            value={selectedStatus}
            onChange={(val) => {
              setSelectedStatus(val);
              setPayCurrentPage(1);
              setTxCurrentPage(1);
            }}
            options={STATUS_OPTIONS}
            widthClass="w-44"
            triggerWidthClass="w-[180px]"
          />
        </FiltersCard>

        {/* Payment History card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-5">
          <div>
            <h3 className="text-lg font-semibold text-[#1F2937] font-figtree">
              Payment History
            </h3>
          </div>

          {/* Payments Table */}
          <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[130px]">
                    <SortHeader
                      label="Payment Date"
                      field="date"
                      sortField={paySortField}
                      sortOrder={paySortOrder}
                      onSort={handlePaySort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[160px]">
                    <SortHeader
                      label="Method"
                      field="method"
                      sortField={paySortField}
                      sortOrder={paySortOrder}
                      onSort={handlePaySort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    <SortHeader
                      label="Amount"
                      field="amount"
                      sortField={paySortField}
                      sortOrder={paySortOrder}
                      onSort={handlePaySort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[115px]">
                    <SortHeader
                      label="Status"
                      field="status"
                      sortField={paySortField}
                      sortOrder={paySortOrder}
                      onSort={handlePaySort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[130px]">
                    <SortHeader
                      label="Reference"
                      field="id"
                      sortField={paySortField}
                      sortOrder={paySortOrder}
                      onSort={handlePaySort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[160px]">
                    <SortHeader
                      label="Approved By"
                      field="approvedBy"
                      sortField={paySortField}
                      sortOrder={paySortOrder}
                      onSort={handlePaySort}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="px-6 py-12 text-center text-gray-500 font-figtree">
                      No payment history transactions.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPayments.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-[#6B7280]">
                        {tx.date}
                      </TableCell>
                      <TableCell className="text-[#6B7280]">
                        {tx.method}
                      </TableCell>
                      <TableCell className="font-semibold text-gray-900">
                        ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={tx.status} />
                      </TableCell>
                      <TableCell className="font-medium text-[#1F2937]">
                        {tx.id}
                      </TableCell>
                      <TableCell className="text-[#6B7280]">
                        {tx.approvedBy}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <Pagination
            totalResults={sortedPayments.length}
            currentPage={payCurrentPage}
            setCurrentPage={setPayCurrentPage}
            resultsPerPage={payResultsPerPage}
            setResultsPerPage={setPayResultsPerPage}
            totalPages={payTotalPages}
          />
        </div>

        {/* Transaction History card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-[#1F2937] font-figtree">
                Transaction History
              </h3>
            </div>
          </div>

          {/* Transaction Table */}
          <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[130px]">
                    <SortHeader
                      label="Type"
                      field="type"
                      sortField={txSortField}
                      sortOrder={txSortOrder}
                      onSort={handleTxSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[220px]">
                    <SortHeader
                      label="Description"
                      field="description"
                      sortField={txSortField}
                      sortOrder={txSortOrder}
                      onSort={handleTxSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[160px]">
                    <SortHeader
                      label="Date"
                      field="date"
                      sortField={txSortField}
                      sortOrder={txSortOrder}
                      onSort={handleTxSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    <SortHeader
                      label="Amount"
                      field="amount"
                      sortField={txSortField}
                      sortOrder={txSortOrder}
                      onSort={handleTxSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[115px]">
                    <SortHeader
                      label="Status"
                      field="status"
                      sortField={txSortField}
                      sortOrder={txSortOrder}
                      onSort={handleTxSort}
                    />
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-6 py-12 text-center text-gray-500 font-figtree">
                      No transactions found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTransactions.map((tx) => {
                    const isNegative = tx.amount < 0;
                    const amountText = isNegative
                      ? `−$${Math.abs(tx.amount).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
                      : `+$${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

                    return (
                      <TableRow key={tx.id}>
                        <TableCell className="font-semibold text-[#1F2937]">
                          {tx.type}
                        </TableCell>
                        <TableCell className="text-[#6B7280]">
                          {tx.description}
                        </TableCell>
                        <TableCell className="text-[#6B7280]">
                          {tx.date}
                        </TableCell>
                        <TableCell className="font-semibold text-gray-900">
                          {amountText}
                        </TableCell>
                        <TableCell>
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
            totalResults={sortedTransactions.length}
            currentPage={txCurrentPage}
            setCurrentPage={setTxCurrentPage}
            resultsPerPage={txResultsPerPage}
            setResultsPerPage={setTxResultsPerPage}
            totalPages={txTotalPages}
          />
        </div>
      </div>

      {/* Add Payment Method Modal */}
      {isAddCardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setIsAddCardOpen(false)} />
          <form
            onSubmit={handleAddCard}
            className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg flex flex-col gap-5 z-10 animate-scaleIn border border-gray-100"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-900 font-figtree">
                  Add New Card
                </h3>
                <p className="text-sm text-gray-500 font-figtree mt-0.5">
                  Hotel booking costs are charged directly to this card.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddCardOpen(false)}
                className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <X className="h-5.5 w-5.5" />
              </button>
            </div>

            <div className="h-px bg-gray-100 w-full" />

            <div className="grid grid-cols-2 gap-4 font-figtree text-sm">
              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-gray-600 font-medium">Cardholder Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Skyward Operations"
                  value={cardHolder}
                  onChange={(e) => setCardHolder(e.target.value)}
                  className="block h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-[14px] text-gray-900 bg-gray-50 focus:bg-white focus:border-[#0F2757] focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5 col-span-2">
                <label className="text-gray-600 font-medium">Card Number</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 4111 2222 3333 4444"
                  maxLength={19}
                  value={cardNumber}
                  onChange={(e) => setCardNumber(e.target.value)}
                  className="block h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-[14px] text-gray-900 bg-gray-50 focus:bg-white focus:border-[#0F2757] focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-gray-600 font-medium">Expiry Date</label>
                <input
                  type="text"
                  required
                  placeholder="MM/YY"
                  maxLength={5}
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(e.target.value)}
                  className="block h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-[14px] text-gray-900 bg-gray-50 focus:bg-white focus:border-[#0F2757] focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-gray-600 font-medium">CVV</label>
                <input
                  type="password"
                  required
                  placeholder="123"
                  maxLength={4}
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value)}
                  className="block h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-[14px] text-gray-900 bg-gray-50 focus:bg-white focus:border-[#0F2757] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2 col-span-2 mt-1">
                <input
                  type="checkbox"
                  id="setAsDefaultCard"
                  checked={cardSetAsDefault}
                  onChange={(e) => setCardSetAsDefault(e.target.checked)}
                  className="h-4 w-4 rounded border-[#D1D5DB] text-[#0F2757] focus:ring-[#0F2757] cursor-pointer"
                />
                <label htmlFor="setAsDefaultCard" className="text-gray-600 font-medium font-figtree select-none cursor-pointer text-sm">
                  Set as default card
                </label>
              </div>
            </div>

            <div className="h-px bg-gray-100 w-full mt-2" />

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsAddCardOpen(false)}
                className="w-1/2 border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-lg transition-colors cursor-pointer text-center text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="w-1/2 bg-[#0F2757] hover:bg-[#162259] text-white font-medium py-2.5 px-4 rounded-lg transition-colors cursor-pointer text-center text-sm"
              >
                Add Card
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Pay balance Drawer */}
      <PaymentDrawer
        isOpen={isPaymentDrawerOpen}
        onClose={() => setIsPaymentDrawerOpen(false)}
        balance={balance}
        onPaymentComplete={handlePaymentComplete}
      />
    </div>
  );
}
