"use client";

import { useState, useMemo, useEffect } from "react";
import { X, Plus, CreditCard, Star, Trash2, CheckCircle2, Download, ChevronDown, Building2, FileCheck } from "lucide-react";
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
import { PaymentDrawer, type SavedCard } from "@/src/components/ui/PaymentDrawer";
import { Pagination } from "@/src/components/ui/pagination";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { FiltersCard } from "@/src/components/ui/FiltersCard";
import { DatePicker } from "@/src/components/ui/DatePicker";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";

// Payment History Record Interface
interface PaymentRecord {
  id: string; // Reference
  date: string; // Payment Date
  hotelBookingId: string; // Hotel Booking
  pnr: string; // PNR
  method: string;
  amount: number;
  status: string;
  type?: string;
}

// Pending Payment Record Interface
interface PendingPayment {
  id: string;
  pnr: string;
  hotel: string;
  allocatedDate: string;
  amount: number;
  status: "Payment Pending" | "Payment Failed";
  hotelCost?: number;
  platformDiscount?: number;
  hotelTax?: number;
  platformFee?: number;
}

const INITIAL_CARDS: SavedCard[] = [
  {
    id: "1",
    brand: "Visa",
    last4: "4242",
    expiry: "08/28",
    holder: "Skyward Airlines Ltd",
    isDefault: true,
  },
  {
    id: "2",
    brand: "Mastercard",
    last4: "5599",
    expiry: "03/27",
    holder: "Skyward Operations",
    isDefault: false,
  },
];

// Initial Payment History mock data
const INITIAL_PAYMENTS: PaymentRecord[] = [
  {
    id: "PAY-782341",
    date: "Sep 2, 2026, 07:45 PM",
    hotelBookingId: "HB-000233",
    pnr: "DDJU34",
    method: "Visa •••• 4242",
    amount: 766,
    status: "Success",
    type: "Hotel Booking Payment",
  },
  {
    id: "PAY-782340",
    date: "Sep 1, 2026, 03:20 PM",
    hotelBookingId: "HB-000232",
    pnr: "DL8841",
    method: "Mastercard •••• 5599",
    amount: 1420,
    status: "Success",
    type: "Hotel Booking Payment",
  },
  {
    id: "PAY-782339",
    date: "Aug 28, 2026, 11:15 AM",
    hotelBookingId: "HB-000231",
    pnr: "AA9023",
    method: "Bank Transfer",
    amount: 2500,
    status: "Success",
    type: "Refund",
  },
  {
    id: "PAY-782338",
    date: "Aug 20, 2026, 06:10 PM",
    hotelBookingId: "HB-000230",
    pnr: "UA1042",
    method: "Visa •••• 4242",
    amount: 1800,
    status: "Refunded",
    type: "Adjustment",
  },
  {
    id: "PAY-782337",
    date: "Aug 15, 2026, 02:30 PM",
    hotelBookingId: "HB-000229",
    pnr: "SQ5512",
    method: "Bank Transfer",
    amount: 950,
    status: "Success",
    type: "Credit",
  },
];

// Initial Pending Payments mock data
const INITIAL_PENDING_PAYMENTS: PendingPayment[] = [
  {
    id: "HB-000234",
    pnr: "DDJU34",
    hotel: "Holiday Inn Express LAX",
    allocatedDate: "Sep 2, 2026",
    amount: 766,
    status: "Payment Pending",
    hotelCost: 720,
    platformDiscount: 50,
    hotelTax: 60,
    platformFee: 36,
  },
  {
    id: "HB-000235",
    pnr: "PNR992",
    hotel: "Hyatt Regency LAX",
    allocatedDate: "Sep 2, 2026",
    amount: 1240,
    status: "Payment Failed",
    hotelCost: 1160,
    platformDiscount: 80,
    hotelTax: 100,
    platformFee: 60,
  },
];

const PENDING_STATUS_OPTIONS = [
  { value: "All Statuses", label: "All Statuses" },
  { value: "Payment Pending", label: "Payment Pending" },
  { value: "Payment Failed", label: "Payment Failed" },
];

const PAY_STATUS_OPTIONS = [
  { value: "All Statuses", label: "All Statuses" },
  { value: "Success", label: "Success" },
  { value: "Refunded", label: "Refunded" },
];

const PAY_TYPE_OPTIONS = [
  { value: "All Types", label: "All Types" },
  { value: "Hotel Booking Payment", label: "Hotel Booking Payment" },
  { value: "Refund", label: "Refund" },
  { value: "Adjustment", label: "Adjustment" },
  { value: "Credit", label: "Credit" },
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

export default function PaymentsPage() {
  const [balance, setBalance] = useState(6287);
  const [cards, setCards] = useState<SavedCard[]>(INITIAL_CARDS);

  // Separate states for the two tables
  const [payments, setPayments] = useState<PaymentRecord[]>(INITIAL_PAYMENTS);
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>(INITIAL_PENDING_PAYMENTS);
  const [selectedPendingPayment, setSelectedPendingPayment] = useState<PendingPayment | null>(null);

  // Drawer & Modals
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false);
  const [isAddCardOpen, setIsAddCardOpen] = useState(false);

  // Lock body scroll when modal or drawer is open (matching admin portal)
  useLockBodyScroll(isAddCardOpen || isPaymentDrawerOpen);

  // Add Card Form Inputs
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardSetAsDefault, setCardSetAsDefault] = useState(false);

  // Filters for Pending Payments
  const [pendingSearchQuery, setPendingSearchQuery] = useState("");
  const [pendingSelectedStatus, setPendingSelectedStatus] = useState("All Statuses");

  // Filters for Payment History
  const [paySearchQuery, setPaySearchQuery] = useState("");
  const [paySelectedStatus, setPaySelectedStatus] = useState("All Statuses");
  const [paySelectedType, setPaySelectedType] = useState("All Types");
  const [payStartDate, setPayStartDate] = useState("");
  const [payEndDate, setPayEndDate] = useState("");

  // Sorting & Pagination for Pending Payments Table
  const [pendingSortField, setPendingSortField] = useState<keyof PendingPayment | null>(null);
  const [pendingSortOrder, setPendingSortOrder] = useState<"asc" | "desc">("asc");
  const [pendingCurrentPage, setPendingCurrentPage] = useState(1);
  const [pendingResultsPerPage, setPendingResultsPerPage] = useState(10);

  // Sorting & Pagination for Payment History Table
  const [paySortField, setPaySortField] = useState<keyof PaymentRecord | null>(null);
  const [paySortOrder, setPaySortOrder] = useState<"asc" | "desc">("asc");
  const [payCurrentPage, setPayCurrentPage] = useState(1);
  const [payResultsPerPage, setPayResultsPerPage] = useState(10);

  // Allowed pending payment limit
  const creditLimit = 25000;

  // Total pending amount calculation
  const totalPendingAmount = useMemo(() => {
    return pendingPayments.reduce((sum, p) => sum + p.amount, 0);
  }, [pendingPayments]);

  // Handle payment completed (for balance pay or pending payment pay)
  const handlePaymentComplete = (
    amount: number,
    method: "card" | "bank",
    title: string,
    description: string,
    cardUsed?: SavedCard
  ) => {
    if (selectedPendingPayment) {
      // Remove paid item from pending payments
      setPendingPayments((prev) => prev.filter((p) => p.id !== selectedPendingPayment.id));

      const now = new Date();
      const formattedDate =
        now.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }) +
        ", " +
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });

      const cardMethod = cardUsed
        ? `${cardUsed.brand} •••• ${cardUsed.last4}`
        : `${cards[0]?.brand || "Visa"} •••• ${cards[0]?.last4 || "4242"}`;

      const newPayment: PaymentRecord = {
        id: `PAY-${Math.floor(Math.random() * 900000) + 100000}`,
        date: formattedDate,
        hotelBookingId: selectedPendingPayment.id,
        pnr: selectedPendingPayment.pnr,
        method: cardMethod,
        amount: selectedPendingPayment.amount,
        status: "Success",
        type: "Hotel Booking Payment",
      };
      setPayments((prev) => [newPayment, ...prev]);
      toast.success(`Payment for ${selectedPendingPayment.id} completed successfully!`);
      setSelectedPendingPayment(null);
    } else {
      setBalance((prev) => Math.max(0, prev - amount));

      const now = new Date();
      const formattedDate =
        now.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }) +
        ", " +
        now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        });

      const defaultCard = cards.find((c) => c.isDefault);
      const cardMethod =
        method === "card"
          ? `${defaultCard?.brand || "Visa"} •••• ${defaultCard?.last4 || "4242"}`
          : "Bank Transfer";

      const newPayment: PaymentRecord = {
        id: `PAY-${Math.floor(Math.random() * 900000) + 100000}`,
        date: formattedDate,
        hotelBookingId: "HB-PLATFORM",
        pnr: "-",
        method: cardMethod,
        amount: amount,
        status: method === "card" ? "Success" : "Pending",
        type: "Credit",
      };
      setPayments((prev) => [newPayment, ...prev]);
      toast.success(title);
    }
  };

  const handlePayPending = (payment: PendingPayment) => {
    setSelectedPendingPayment(payment);
    setIsPaymentDrawerOpen(true);
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

  // Payment History Clear Filters Handler
  const handleClearPayFilters = () => {
    setPaySearchQuery("");
    setPaySelectedStatus("All Statuses");
    setPaySelectedType("All Types");
    setPayStartDate("");
    setPayEndDate("");
    setPaySortField(null);
    setPaySortOrder("asc");
    setPayCurrentPage(1);
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
        paySearchQuery === "" ||
        p.id.toLowerCase().includes(paySearchQuery.toLowerCase()) ||
        p.hotelBookingId.toLowerCase().includes(paySearchQuery.toLowerCase()) ||
        p.pnr.toLowerCase().includes(paySearchQuery.toLowerCase()) ||
        p.method.toLowerCase().includes(paySearchQuery.toLowerCase()) ||
        (p.type && p.type.toLowerCase().includes(paySearchQuery.toLowerCase()));

      const matchesStatus =
        paySelectedStatus === "All Statuses" || p.status === paySelectedStatus;

      let matchesType = true;
      if (paySelectedType !== "All Types") {
        matchesType = p.type === paySelectedType;
      }

      let matchesDate = true;
      if (payStartDate || payEndDate) {
        const recordTime = new Date(p.date).getTime();
        if (!isNaN(recordTime)) {
          if (payStartDate) {
            const startTime = new Date(`${payStartDate}T00:00:00`).getTime();
            if (!isNaN(startTime) && recordTime < startTime) {
              matchesDate = false;
            }
          }
          if (payEndDate) {
            const endTime = new Date(`${payEndDate}T23:59:59.999`).getTime();
            if (!isNaN(endTime) && recordTime > endTime) {
              matchesDate = false;
            }
          }
        }
      }

      return matchesSearch && matchesStatus && matchesType && matchesDate;
    });
  }, [payments, paySearchQuery, paySelectedStatus, paySelectedType, payStartDate, payEndDate]);

  const sortedPayments = useMemo(() => {
    if (!paySortField) return filteredPayments;
    return [...filteredPayments].sort((a, b) => {
      if (paySortField === "date") {
        const timeA = new Date(a.date).getTime() || 0;
        const timeB = new Date(b.date).getTime() || 0;
        return paySortOrder === "asc" ? timeA - timeB : timeB - timeA;
      }
      const valA = a[paySortField];
      const valB = b[paySortField];

      if (typeof valA === "number" && typeof valB === "number") {
        return paySortOrder === "asc" ? valA - valB : valB - valA;
      }

      const strA = String(valA ?? "").toLowerCase();
      const strB = String(valB ?? "").toLowerCase();

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

  // Sorting & Filtering logic for Pending Payments
  const handlePendingSort = (field: keyof PendingPayment) => {
    if (pendingSortField === field) {
      setPendingSortOrder(pendingSortOrder === "asc" ? "desc" : "asc");
    } else {
      setPendingSortField(field);
      setPendingSortOrder("asc");
    }
    setPendingCurrentPage(1);
  };

  const sortedPendingPayments = useMemo(() => {
    if (!pendingSortField) return pendingPayments;
    return [...pendingPayments].sort((a, b) => {
      const valA = a[pendingSortField];
      const valB = b[pendingSortField];

      if (typeof valA === "number" && typeof valB === "number") {
        return pendingSortOrder === "asc" ? valA - valB : valB - valA;
      }

      const strA = String(valA ?? "").toLowerCase();
      const strB = String(valB ?? "").toLowerCase();

      if (strA < strB) return pendingSortOrder === "asc" ? -1 : 1;
      if (strA > strB) return pendingSortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [pendingPayments, pendingSortField, pendingSortOrder]);

  const paginatedPendingPayments = useMemo(() => {
    const startIndex = (pendingCurrentPage - 1) * pendingResultsPerPage;
    return sortedPendingPayments.slice(startIndex, startIndex + pendingResultsPerPage);
  }, [sortedPendingPayments, pendingCurrentPage, pendingResultsPerPage]);

  const pendingTotalPages = Math.ceil(sortedPendingPayments.length / pendingResultsPerPage) || 1;

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      <div className="space-y-7">
        <div>
          <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%]">
            Payments
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1 font-figtree">
            Manage payment methods and view pending and completed hotel booking payments.
          </p>
        </div>

        {/* Payment Methods Section (Full Width) */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
            <div>
              <h3 className="text-lg font-semibold text-[#1F2937] font-figtree">
                Payment Methods
              </h3>
              <p className="text-sm text-[#6B7280] mt-0.5 font-figtree">
                Manage the cards used for hotel booking payments.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsAddCardOpen(true)}
              className="bg-[#0F2757] hover:bg-[#162259] text-white font-medium py-2 px-4 rounded-[10px] text-sm cursor-pointer transition-colors inline-flex items-center gap-1.5 font-figtree self-start sm:self-auto shadow-2xs"
            >
              <Plus className="h-4 w-4" />
              <span>Add Card</span>
            </button>
          </div>

          {/* Cards List */}
          {cards.length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              No payment methods saved. Add one to enable automatic settlements.
            </p>
          ) : (
            <div className="space-y-3">
              {cards.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors bg-white shadow-2xs"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="size-10 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200">
                      <CreditCard className="h-5 w-5 text-gray-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm font-figtree">
                          {c.brand} •••• {c.last4}
                        </span>
                        {c.isDefault && (
                          <span className="inline-flex items-center gap-1 bg-slate-200 text-slate-700 text-[11px] font-medium px-2 py-0.5 rounded-full font-figtree">
                            <CheckCircle2 className="w-3 h-3 text-slate-600" />
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 font-figtree">
                        {c.holder ? `${c.holder} · ` : ""}Expires {c.expiry}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {!c.isDefault && (
                      <button
                        type="button"
                        onClick={() => handleSetDefaultCard(c.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer font-figtree"
                      >
                        <Star className="h-3.5 w-3.5 text-gray-500" />
                        <span>Set Default</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDeleteCard(c.id)}
                      className="p-1.5 text-red-500 hover:text-red-700 transition-colors rounded-lg hover:bg-red-50 cursor-pointer"
                      title="Remove card"
                    >
                      <Trash2 className="h-4.5 w-4.5 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Payments Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h3 className="text-lg font-semibold text-[#1F2937] font-figtree">
                Pending Payments
              </h3>
              <p className="text-[14px] text-[#6B7280] mt-1 font-figtree">
                Hotel bookings that have been allocated but are awaiting payment.
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[11px] font-semibold text-[#6B7280] tracking-wider uppercase font-figtree">
                TOTAL PENDING
              </span>
              <div className="text-[26px] font-bold text-[#111827] leading-tight mt-0.5 font-figtree">
                ${totalPendingAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-[12px] text-[#6B7280] mt-0.5 font-figtree">
                Allowed pending payment limit: ${creditLimit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Pending Payments Table */}
          <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[160px]">
                    <SortHeader
                      label="Hotel Booking ID"
                      field="id"
                      sortField={pendingSortField}
                      sortOrder={pendingSortOrder}
                      onSort={handlePendingSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[110px]">
                    <SortHeader
                      label="PNR"
                      field="pnr"
                      sortField={pendingSortField}
                      sortOrder={pendingSortOrder}
                      onSort={handlePendingSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[220px]">
                    <SortHeader
                      label="Hotel"
                      field="hotel"
                      sortField={pendingSortField}
                      sortOrder={pendingSortOrder}
                      onSort={handlePendingSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[140px]">
                    <SortHeader
                      label="Allocated Date"
                      field="allocatedDate"
                      sortField={pendingSortField}
                      sortOrder={pendingSortOrder}
                      onSort={handlePendingSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    <SortHeader
                      label="Amount"
                      field="amount"
                      sortField={pendingSortField}
                      sortOrder={pendingSortOrder}
                      onSort={handlePendingSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[150px]">
                    <SortHeader
                      label="Status"
                      field="status"
                      sortField={pendingSortField}
                      sortOrder={pendingSortOrder}
                      onSort={handlePendingSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    Action
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPendingPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="px-6 py-12 text-center text-gray-500 font-figtree">
                      No pending payments found.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPendingPayments.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-[#1F2937]">
                        {p.id}
                      </TableCell>
                      <TableCell className="text-[#6B7280]">
                        {p.pnr}
                      </TableCell>
                      <TableCell className="text-[#6B7280]">
                        {p.hotel}
                      </TableCell>
                      <TableCell className="text-[#6B7280]">
                        {p.allocatedDate}
                      </TableCell>
                      <TableCell className="text-gray-900">
                        ${p.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => handlePayPending(p)}
                          className="bg-[#0F2757] hover:bg-[#162259] text-white font-medium py-1.5 px-3.5 rounded-[8px] text-[13px] cursor-pointer transition-colors inline-flex items-center justify-center font-figtree"
                        >
                          {p.status === "Payment Failed" ? "Retry Payment" : "Pay Now"}
                        </button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <Pagination
            totalResults={sortedPendingPayments.length}
            currentPage={pendingCurrentPage}
            setCurrentPage={setPendingCurrentPage}
            resultsPerPage={pendingResultsPerPage}
            setResultsPerPage={setPendingResultsPerPage}
            totalPages={pendingTotalPages}
          />
        </div>

        {/* Payment History card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 flex flex-col gap-5">
          <div>
            <h3 className="text-lg font-semibold text-[#1F2937] font-figtree">
              Payment History
            </h3>
            <p className="text-[14px] text-[#6B7280] mt-1 font-figtree">
              All balance top-ups, card payments and bank transfers
            </p>
          </div>

          {/* Payment History Filters Card */}
          <FiltersCard onClearFilters={handleClearPayFilters}>
            {/* Types dropdown */}
            <Dropdown
              value={paySelectedType}
              onChange={(val) => {
                setPaySelectedType(val);
                setPayCurrentPage(1);
              }}
              options={PAY_TYPE_OPTIONS}
              widthClass="w-60"
              triggerWidthClass="w-[220px]"
            />

            {/* Status dropdown */}
            <Dropdown
              value={paySelectedStatus}
              onChange={(val) => {
                setPaySelectedStatus(val);
                setPayCurrentPage(1);
              }}
              options={PAY_STATUS_OPTIONS}
              widthClass="w-44"
              triggerWidthClass="w-[180px]"
            />

            {/* Divider */}
            <div className="hidden sm:block h-11 w-[2px] bg-[#E5E7EB] mx-1.5" />

            {/* Date controls */}
            <div className="flex items-center gap-2">
              <DatePicker
                value={payStartDate}
                onChange={(val) => {
                  setPayStartDate(val);
                  setPayCurrentPage(1);
                }}
                placeholder="Start Date"
              />
              <div className="ml-1.5">
                <DatePicker
                  value={payEndDate}
                  onChange={(val) => {
                    setPayEndDate(val);
                    setPayCurrentPage(1);
                  }}
                  placeholder="End Date"
                  align="right"
                />
              </div>
            </div>
          </FiltersCard>

          {/* Payments Table */}
          <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">
                    <SortHeader
                      label="Payment Date"
                      field="date"
                      sortField={paySortField}
                      sortOrder={paySortOrder}
                      onSort={handlePaySort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[130px]">
                    <SortHeader
                      label="Type"
                      field="type"
                      sortField={paySortField}
                      sortOrder={paySortOrder}
                      onSort={handlePaySort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[140px]">
                    <SortHeader
                      label="Hotel Booking"
                      field="hotelBookingId"
                      sortField={paySortField}
                      sortOrder={paySortOrder}
                      onSort={handlePaySort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[100px]">
                    <SortHeader
                      label="PNR"
                      field="pnr"
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
                  <TableHead className="min-w-[120px]">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="px-6 py-12 text-center text-gray-500 font-figtree">
                      No payment history transactions.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedPayments.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="text-[#6B7280]">
                        {tx.date}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 font-figtree whitespace-nowrap">
                          {tx.type || "Hotel Booking Payment"}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium text-[#1F2937]">
                        {tx.hotelBookingId}
                      </TableCell>
                      <TableCell className="text-[#6B7280]">
                        {tx.pnr}
                      </TableCell>
                      <TableCell className="text-[#6B7280]">
                        {tx.method}
                      </TableCell>
                      <TableCell className="text-gray-900">
                        ${tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={tx.status} />
                      </TableCell>
                      <TableCell className="text-[#6B7280]">
                        {tx.id}
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
      </div>

      {/* Add Card Modal */}
      {isAddCardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop matching admin portal */}
          <div
            className="fixed inset-0 bg-black/40 transition-opacity duration-300"
            onClick={() => setIsAddCardOpen(false)}
          />
          <form
            onSubmit={handleAddCard}
            className="relative w-full max-w-[480px] bg-white rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 z-10"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#1F2937] font-figtree">Add Card</h3>
                <p className="text-xs text-gray-500 mt-0.5 font-figtree">Debit or credit card for automatic settlements</p>
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

      {/* Pay Hotel Booking Drawer */}
      <PaymentDrawer
        isOpen={isPaymentDrawerOpen}
        onClose={() => {
          setIsPaymentDrawerOpen(false);
          setSelectedPendingPayment(null);
        }}
        balance={selectedPendingPayment ? selectedPendingPayment.amount : balance}
        pendingPayment={selectedPendingPayment}
        savedCards={cards}
        onAddCard={(newCard) => {
          setCards((prev) => {
            const updated = newCard.isDefault
              ? prev.map((c) => ({ ...c, isDefault: false }))
              : [...prev];
            return [...updated, newCard];
          });
        }}
        onPaymentComplete={handlePaymentComplete}
      />
    </div>
  );
}
