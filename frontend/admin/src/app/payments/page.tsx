"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import {
  Wallet,
  Lock,
  CreditCard,
  TrendingDown,
  TrendingUp,
  DollarSign,
  LineChart as LineChartIcon,
  BarChart3,
  Landmark,
  Check,
  Settings,
  Plane,
  X,
  Calendar,
} from "lucide-react";
import { cn, sortData } from "@/src/lib/utils";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, SortHeader } from "@/src/components/ui/table";
import { Pagination } from "@/src/components/ui/pagination";
import { StatusBadge } from "@/src/components/ui/StatusBadge";

interface AirlineRevenue {
  name: string;
  code: string;
  country: string;
  amount: string;
  percentage: string;
  widthClass: string;
}

interface CountryRevenue {
  country: string;
  amount: string;
  percentage: string;
  widthClass: string;
}

const AIRLINE_REVENUE_DATA: AirlineRevenue[] = [
  {
    name: "Pacific Airways",
    code: "PA",
    country: "Canada",
    amount: "$19,600",
    percentage: "(20.1%)",
    widthClass: "w-80",
  },
  {
    name: "Global Airlines",
    code: "GA",
    country: "United States",
    amount: "$24,300",
    percentage: "(25.3%)",
    widthClass: "w-[466px]",
  },
  {
    name: "AeroTravel Co.",
    code: "AT",
    country: "France",
    amount: "$22,450",
    percentage: "(22.8%)",
    widthClass: "w-96",
  },
  {
    name: "Skyline Flights",
    code: "SF",
    country: "German",
    amount: "$19,600",
    percentage: "(18.7%)",
    widthClass: "w-72",
  },
  {
    name: "Atlantic Express",
    code: "AE",
    country: "United Kingdom",
    amount: "$19,200",
    percentage: "(18.2%)",
    widthClass: "w-64",
  },
];

const COUNTRY_REVENUE_DATA: CountryRevenue[] = [
  {
    country: "Canada",
    amount: "$19,600",
    percentage: "(20.1%)",
    widthClass: "w-80",
  },
  {
    country: "United States",
    amount: "$24,300",
    percentage: "(25.3%)",
    widthClass: "w-[466px]",
  },
  {
    country: "France",
    amount: "$22,450",
    percentage: "(22.8%)",
    widthClass: "w-96",
  },
  {
    country: "German",
    amount: "$19,600",
    percentage: "(18.7%)",
    widthClass: "w-72",
  },
  {
    country: "Switzerland",
    amount: "$19,200",
    percentage: "(18.2%)",
    widthClass: "w-64",
  },
];

interface AirlineHealth {
  id: string;
  airline: string;
  country: string;
  topups: number;
  bookingSpend: number;
  revenue: number;
  walletBalance: number;
  creditLimit: number;
  creditUsed: number;
  remaining: number;
}

interface Transaction {
  id: string;
  date: string;
  airline: string;
  airport: string;
  country: string;
  type: string;
  amount: number;
  status: "Completed" | "Pending" | "Failed";
  reference: string;
  description: string;
}

const DETAILED_AIRLINE_HEALTH_DATA: AirlineHealth[] = [
  {
    id: "AH001",
    airline: "SkyLine Airways",
    country: "United States",
    topups: 800000,
    bookingSpend: 2450000,
    revenue: 122500,
    walletBalance: 80000,
    creditLimit: 50000,
    creditUsed: 25000,
    remaining: 50000,
  },
  {
    id: "AH002",
    airline: "SkyLine Airways",
    country: "United States",
    topups: 500000,
    bookingSpend: 2450000,
    revenue: 122500,
    walletBalance: 80000,
    creditLimit: 50000,
    creditUsed: 25000,
    remaining: 50000,
  },
  {
    id: "AH003",
    airline: "SkyLine Airways",
    country: "United States",
    topups: 800000,
    bookingSpend: 2450000,
    revenue: 122500,
    walletBalance: 80000,
    creditLimit: 50000,
    creditUsed: 25000,
    remaining: 50000,
  },
  {
    id: "AH004",
    airline: "SkyLine Airways",
    country: "United States",
    topups: 800000,
    bookingSpend: 2450000,
    revenue: 122500,
    walletBalance: 80000,
    creditLimit: 50000,
    creditUsed: 25000,
    remaining: 50000,
  },
];

const TRANSACTIONS_DATA: Transaction[] = [
  {
    id: "TX001",
    date: "01/02/2025",
    airline: "Northern Star Airlines",
    airport: "YYC",
    country: "Canada",
    type: "Airline Top-up",
    amount: 150000,
    status: "Completed",
    reference: "TOP-2025-001238",
    description: "Wallet top-up via credit card",
  },
  {
    id: "TX002",
    date: "01/02/2025",
    airline: "Northern Star Airlines",
    airport: "YYC",
    country: "Canada",
    type: "Hotel Booking",
    amount: 150000,
    status: "Completed",
    reference: "TOP-2025-001236",
    description: "Wallet top-up via credit card",
  },
  {
    id: "TX003",
    date: "02/15/2025",
    airline: "Southern Brze Airways",
    airport: "LAX",
    country: "United States",
    type: "Platform Fee",
    amount: 200000,
    status: "Completed",
    reference: "TOP-2025-001237",
    description: "Wallet top-up via debit card",
  },
  {
    id: "TX004",
    date: "03/10/2025",
    airline: "Eastern Wings Flight",
    airport: "JFK",
    country: "United States",
    type: "Airline Top-up",
    amount: 120000,
    status: "Completed",
    reference: "TOP-2025-001238",
    description: "Wallet top-up via bank transfer",
  },
  {
    id: "TX005",
    date: "04/01/2025",
    airline: "Western Sky Airways",
    airport: "SFO",
    country: "United States",
    type: "Hotel Booking",
    amount: 180000,
    status: "Completed",
    reference: "TOP-2025-001239",
    description: "Wallet top-up via online checkout",
  },
  {
    id: "TX006",
    date: "04/15/2025",
    airline: "Sky High Airlines",
    airport: "ORD",
    country: "United States",
    type: "Refund",
    amount: 220000,
    status: "Completed",
    reference: "TOP-2025-001240",
    description: "Wallet top-up via phone booking",
  },
  {
    id: "TX007",
    date: "05/05/2025",
    airline: "AeroQuest Airlines",
    airport: "YYZ",
    country: "Canada",
    type: "Airline Top-up",
    amount: 130000,
    status: "Completed",
    reference: "TOP-2025-001241",
    description: "Wallet top-up via third party",
  },
  {
    id: "TX008",
    date: "08/20/2025",
    airline: "Air Frontier Services",
    airport: "PHX",
    country: "United States",
    type: "Platform Credit",
    amount: 110000,
    status: "Completed",
    reference: "TOP-2025-001242",
    description: "Wallet top-up via master balance",
  },
  {
    id: "TX009",
    date: "07/15/2025",
    airline: "Cloud Nine Airways",
    airport: "MIA",
    country: "United States",
    type: "Hotel Booking",
    amount: 160000,
    status: "Completed",
    reference: "TOP-2025-001243",
    description: "Wallet top-up via credit card",
  },
];

const PERIOD_OPTIONS = [
  { value: "This Month", label: "This Month" },
  { value: "Last Month", label: "Last Month" },
  { value: "Last 7 Days", label: "Last 7 Days" },
  { value: "Last 30 Days", label: "Last 30 Days" },
  { value: "Last 90 Days", label: "Last 90 Days" },
];

const TABS_CONFIG = [
  {
    id: "overview",
    label: "Platform Overview",
    icon: BarChart3,
  },
  {
    id: "detailed",
    label: "Detailed Analysis",
    icon: LineChartIcon,
  },
  {
    id: "treasury",
    label: "Platform Treasury",
    icon: Landmark,
  },
] as const;

interface ManageReserveDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  widthClass?: string;
  triggerWidthClass?: string;
  heightClass?: string;
  bgClass?: string;
}

function ManageReserveDropdown({
  value,
  onChange,
  options,
  widthClass = "w-48",
  triggerWidthClass = "w-[156px]",
  heightClass = "h-[38px]",
  bgClass = "bg-[#F3F4F6]",
}: ManageReserveDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={cn("relative select-none", heightClass, triggerWidthClass)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full h-full flex items-center justify-start gap-2 rounded-[8px] border border-[#D1D5DB] pl-3 pr-3 text-[#1F2937] outline-none cursor-pointer hover:bg-slate-100/80 transition-colors text-[16px] font-medium",
          bgClass
        )}
      >
        <Settings className="w-3.5 h-3.5 shrink-0 text-gray-700 relative -left-0.5" />
        <span className="truncate text-sm font-normal text-left flex-1">
          Manage Reserve
        </span>
      </button>

      {isOpen && (
        <div
          className={cn(
            "absolute left-0 mt-2 z-50 p-2 bg-white rounded-lg shadow-[0px_4px_8px_0px_rgba(0,0,0,0.12)] outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-0.5",
            widthClass
          )}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleSelect(option.value)}
                className={cn(
                  "self-stretch p-2 rounded-md inline-flex justify-start items-center gap-2.5 text-left transition-colors cursor-pointer",
                  isSelected ? "bg-gray-200" : "hover:bg-gray-100"
                )}
              >
                <div className="size-4 flex items-center justify-center shrink-0">
                  {isSelected && <Check className="h-3.5 w-3.5 text-gray-800 stroke-[2.5px]" />}
                </div>
                <span className="justify-start text-gray-800 text-[16px] font-normal font-figtree truncate leading-[1.5]">
                  {option.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

const AIRPORT_NAMES: Record<string, string> = {
  YYC: "Calgary International Airport",
  LAX: "Los Angeles International Airport",
  JFK: "JFK International Airport",
  SFO: "San Francisco International Airport",
  ORD: "O'Hare International Airport",
  YYZ: "Toronto Pearson International Airport",
  PHX: "Phoenix Sky Harbor International Airport",
  MIA: "Miami International Airport",
  LHR: "Heathrow Airport",
  FRA: "Frankfurt Airport",
  CDG: "Charles de Gaulle Airport",
  DEL: "Indira Gandhi International Airport",
  SYD: "Sydney Kingsford Smith Airport",
};

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "detailed" | "treasury"
  >("overview");
  const [timePeriod, setTimePeriod] = useState("This Month");

  // Global Date range states
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const dateRangeLabel = useMemo(() => {
    if (startDate && endDate) {
      return `${startDate} to ${endDate}`;
    }
    if (startDate) {
      return `From ${startDate}`;
    }
    if (endDate) {
      return `Until ${endDate}`;
    }
    return "This Month";
  }, [startDate, endDate]);

  // Detailed Analysis Filters state
  const [airlineFilter, setAirlineFilter] = useState("All");
  const [airportFilter, setAirportFilter] = useState("All");
  const [countryFilter, setCountryFilter] = useState("All");
  const [txTypeFilter, setTxTypeFilter] = useState("All");

  // Detailed Analysis Sorting state
  const [financialSortField, setFinancialSortField] = useState<keyof AirlineHealth | null>(null);
  const [financialSortOrder, setFinancialSortOrder] = useState<"asc" | "desc">("asc");

  const [transactionSortField, setTransactionSortField] = useState<keyof Transaction | null>(null);
  const [transactionSortOrder, setTransactionSortOrder] = useState<"asc" | "desc">("asc");

  // Detailed Analysis Pagination state
  const [financialCurrentPage, setFinancialCurrentPage] = useState(1);
  const [financialPerPage, setFinancialPerPage] = useState(10);

  const [transactionCurrentPage, setTransactionCurrentPage] = useState(1);
  const [transactionPerPage, setTransactionPerPage] = useState(10);

  // Dynamic filter lists
  const airlineOptions = useMemo(() => {
    const uniqueAirlines = new Set<string>();
    DETAILED_AIRLINE_HEALTH_DATA.forEach((item) => uniqueAirlines.add(item.airline));
    TRANSACTIONS_DATA.forEach((item) => uniqueAirlines.add(item.airline));
    return [
      { value: "All", label: "All Airlines" },
      ...Array.from(uniqueAirlines).map((name) => ({ value: name, label: name })),
    ];
  }, []);

  const airportOptions = useMemo(() => {
    const uniqueAirports = new Set<string>();
    TRANSACTIONS_DATA.forEach((item) => uniqueAirports.add(item.airport));
    return [
      { value: "All", label: "All Airports" },
      ...Array.from(uniqueAirports).map((code) => ({
        value: code,
        label: AIRPORT_NAMES[code] || `${code} Airport`,
      })),
    ];
  }, []);

  const countryOptions = useMemo(() => {
    const uniqueCountries = new Set<string>();
    DETAILED_AIRLINE_HEALTH_DATA.forEach((item) => uniqueCountries.add(item.country));
    TRANSACTIONS_DATA.forEach((item) => uniqueCountries.add(item.country));
    return [
      { value: "All", label: "All Countries" },
      ...Array.from(uniqueCountries).map((name) => ({ value: name, label: name })),
    ];
  }, []);

  const transactionTypeOptions = [
    { value: "All", label: "All Types" },
    { value: "Airline Top-up", label: "Airline Top-up" },
    { value: "Platform Credit", label: "Platform Credit" },
    { value: "Hotel Booking", label: "Hotel Booking" },
  ];

  // Filtering calculations
  const filteredFinancialData = useMemo(() => {
    return DETAILED_AIRLINE_HEALTH_DATA.filter((item) => {
      const matchesAirline = airlineFilter === "All" || item.airline === airlineFilter;
      const matchesCountry = countryFilter === "All" || item.country === countryFilter;
      return matchesAirline && matchesCountry;
    });
  }, [airlineFilter, countryFilter]);

  const filteredTransactions = useMemo(() => {
    return TRANSACTIONS_DATA.filter((tx) => {
      const matchesAirline = airlineFilter === "All" || tx.airline === airlineFilter;
      const matchesAirport = airportFilter === "All" || tx.airport === airportFilter;
      const matchesCountry = countryFilter === "All" || tx.country === countryFilter;
      const matchesType = txTypeFilter === "All" || tx.type === txTypeFilter;

      let matchesDate = true;
      if (startDate || endDate) {
        const parts = tx.date.split("/");
        if (parts.length === 3) {
          const txTime = new Date(
            Number(parts[2]),
            Number(parts[1]) - 1,
            Number(parts[0])
          ).getTime();

          if (startDate) {
            const startLimit = new Date(startDate).getTime();
            if (txTime < startLimit) matchesDate = false;
          }
          if (endDate) {
            const adjustedEndLimit = new Date(endDate);
            adjustedEndLimit.setHours(23, 59, 59, 999);
            if (txTime > adjustedEndLimit.getTime()) matchesDate = false;
          }
        }
      }

      return matchesAirline && matchesAirport && matchesCountry && matchesType && matchesDate;
    });
  }, [airlineFilter, airportFilter, countryFilter, txTypeFilter, startDate, endDate]);

  // KPI summaries
  const { bookingsSum, bookingsCount, topupsSum, topupsCount, revenueSum } = useMemo(() => {
    if (airlineFilter === "All" && airportFilter === "All" && countryFilter === "All" && txTypeFilter === "All") {
      return {
        bookingsSum: 170400,
        bookingsCount: 4,
        topupsSum: 250000,
        topupsCount: 2,
        revenueSum: 476000,
      };
    }

    const bookingTx = filteredTransactions.filter(t => t.type === "Hotel Booking");
    const topupTx = filteredTransactions.filter(t => t.type === "Airline Top-up");
    const feeTx = filteredTransactions.filter(t => t.type === "Platform Fee");

    return {
      bookingsSum: bookingTx.reduce((sum, t) => sum + t.amount, 0),
      bookingsCount: bookingTx.length,
      topupsSum: topupTx.reduce((sum, t) => sum + t.amount, 0),
      topupsCount: topupTx.length,
      revenueSum: feeTx.reduce((sum, t) => sum + t.amount, 0) || (filteredTransactions.length > 0 ? 476000 / 9 * filteredTransactions.length : 0),
    };
  }, [filteredTransactions, airlineFilter, airportFilter, countryFilter, txTypeFilter]);

  // Sorting
  const sortedFinancialData = useMemo(() => {
    return sortData(filteredFinancialData, financialSortField, financialSortOrder, []);
  }, [filteredFinancialData, financialSortField, financialSortOrder]);

  const sortedTransactions = useMemo(() => {
    return sortData(filteredTransactions, transactionSortField, transactionSortOrder, ["date"]);
  }, [filteredTransactions, transactionSortField, transactionSortOrder]);

  // Pagination
  const financialTotalPages = Math.ceil(sortedFinancialData.length / financialPerPage) || 1;
  const paginatedFinancialData = useMemo(() => {
    const start = (financialCurrentPage - 1) * financialPerPage;
    return sortedFinancialData.slice(start, start + financialPerPage);
  }, [sortedFinancialData, financialCurrentPage, financialPerPage]);

  const transactionTotalPages = Math.ceil(sortedTransactions.length / transactionPerPage) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (transactionCurrentPage - 1) * transactionPerPage;
    return sortedTransactions.slice(start, start + transactionPerPage);
  }, [sortedTransactions, transactionCurrentPage, transactionPerPage]);

  const handleClearFilters = () => {
    setAirlineFilter("All");
    setAirportFilter("All");
    setCountryFilter("All");
    setTxTypeFilter("All");
    setStartDate("");
    setEndDate("");
    setFinancialCurrentPage(1);
    setTransactionCurrentPage(1);
  };

  // Platform Reserve state
  const [reserveValue, setReserveValue] = useState(250000);
  const [reservePeriod, setReservePeriod] = useState("This Month");

  // Define KPI Cards data dynamically based on the current state values
  const kpiCardsConfig = [
    {
      id: "topup",
      label: "Total Top-up Balance",
      value: "$480,000",
      subtext: "Real money available",
      icon: Wallet,
    },
    {
      id: "reserve",
      label: "Platform Reserve",
      value: `$${reserveValue.toLocaleString()}`,
      subtext: "Admin-deposited funds",
      icon: Lock,
    },
    {
      id: "credit-issued",
      label: "Total Credit Issued",
      value: "$525,000",
      subtext: "Admin-defined limits",
      icon: CreditCard,
    },
    {
      id: "credit-used",
      label: "Total Credit Used",
      value: "$190,000",
      subtext: "Negative balances",
      icon: TrendingDown,
      valueColor: "text-amber-400",
    },
    {
      id: "exposure",
      label: "Net Exposure",
      value: "$60,000",
      subtext: "Fully covered",
      icon: TrendingUp,
    },
    {
      id: "revenue",
      label: "Platform Revenue",
      value: "$476,000",
      subtext: "Platform fees only",
      icon: DollarSign,
      badge: "+18%",
    },
  ];

  // Define Credit Risk Cards data dynamically
  const creditRiskCardsConfig = [
    {
      id: "allowed",
      value: "$525,000",
      label: "Total Credit Allowed",
      valueColor: "text-gray-800",
    },
    {
      id: "used",
      value: "$190,000",
      label: "Total Credit Allowed",
      valueColor: "text-amber-500",
    },
    {
      id: "utilization",
      value: "36.2%",
      label: "Credit Utilization",
      valueColor: "text-gray-800",
      progressClass: "w-16",
    },
    {
      id: "users",
      value: "3",
      label: "Airlines Using Credit",
      valueColor: "text-gray-800",
    },
  ];

  // Define Revenue Column configurations dynamically for Row 3
  const revenueColumnsConfig = [
    {
      title: "Revenue by Airline",
      progressBarColor: "bg-blue-950",
      data: AIRLINE_REVENUE_DATA.map((item) => ({
        name: item.name,
        amount: item.amount,
        percentage: item.percentage,
        widthClass: item.widthClass,
        badges: [
          { type: "code", value: item.code },
          { type: "country", value: item.country },
        ],
      })),
    },
    {
      title: "Revenue by Country",
      progressBarColor: "bg-emerald-600",
      data: COUNTRY_REVENUE_DATA.map((item) => ({
        name: item.country,
        amount: item.amount,
        percentage: item.percentage,
        widthClass: item.widthClass,
        badges: [],
      })),
    },
  ];

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      {/* Title block */}
      <div className="self-stretch inline-flex justify-between items-center mb-6">
        <div className="inline-flex flex-col justify-start items-start gap-1">
          <div className="self-stretch justify-start text-gray-800 text-2xl font-semibold leading-[100%]">
            Payments & Revenue
          </div>
          <div className="justify-start text-gray-500 text-sm font-normal">
            Track platform revenue, payouts, and financial performance
          </div>
        </div>

        {/* Date filter range in top right */}
        <div className="flex items-center gap-2.5">
          <div className="relative h-11 w-[160px]">
            <input
              type={startDate ? "date" : "text"}
              placeholder="Start Date"
              value={startDate}
              onFocus={(e) => (e.target.type = "date")}
              onBlur={(e) => {
                if (!e.target.value) {
                  e.target.type = "text";
                }
              }}
              onChange={(e) => {
                setStartDate(e.target.value);
                setFinancialCurrentPage(1);
                setTransactionCurrentPage(1);
              }}
              className="h-11 w-full appearance-none rounded-[8px] border border-[#D1D5DB] bg-[#F3F4F6] py-3 px-4 text-gray-600 outline-none cursor-pointer hover:bg-slate-100/80 transition-colors text-[16px] custom-date-input"
            />
            <Calendar className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6B7280]" />
          </div>
          <span className="text-[#6B7280] text-sm font-normal">to</span>
          <div className="relative h-11 w-[160px]">
            <input
              type={endDate ? "date" : "text"}
              placeholder="End Date"
              value={endDate}
              onFocus={(e) => (e.target.type = "date")}
              onBlur={(e) => {
                if (!e.target.value) {
                  e.target.type = "text";
                }
              }}
              onChange={(e) => {
                setEndDate(e.target.value);
                setFinancialCurrentPage(1);
                setTransactionCurrentPage(1);
              }}
              className="h-11 w-full appearance-none rounded-[8px] border border-[#D1D5DB] bg-[#F3F4F6] py-3 px-4 text-gray-600 outline-none cursor-pointer hover:bg-slate-100/80 transition-colors text-[16px] custom-date-input"
            />
            <Calendar className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#6B7280]" />
          </div>
        </div>
      </div>

      {/* Main content body */}
      <div className="self-stretch flex flex-col justify-start items-start gap-6">
        {/* Navigation Tabs bar */}
        <div className="pb-2 border-b border-gray-300 inline-flex justify-start items-center gap-3">
          {TABS_CONFIG.map((tab) => {
            const isActive = activeTab === tab.id;
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "h-[37px] p-[11px] rounded-[6px] flex justify-center items-center gap-1.5 transition-all duration-150 cursor-pointer",
                  isActive
                    ? "bg-blue-950 text-white"
                    : "text-gray-500 hover:text-gray-800 hover:bg-gray-200/50",
                )}
              >
                <div className="size-3.5 relative flex items-center justify-center">
                  <IconComponent className="w-3.5 h-3.5" />
                </div>
                <div className="text-center justify-start text-[14px] font-normal leading-[100%]">
                  {tab.label}
                </div>
              </button>
            );
          })}
        </div>

        {/* Tab 1: Platform Overview */}
        {activeTab === "overview" && (
          <div className="self-stretch flex flex-col justify-start items-start gap-5 animate-fadeIn">
            {/* Overview Header */}
            <div className="self-stretch inline-flex justify-between items-center">
              <div className="flex justify-start items-center gap-2">
                <div className="justify-start text-gray-800 text-lg font-semibold">
                  Platform Overview
                </div>
                <div className="justify-start text-gray-500 text-sm font-normal">
                  ({dateRangeLabel})
                </div>
              </div>
              <div className="h-9 flex justify-start items-center">
                <ManageReserveDropdown
                  value={reservePeriod}
                  onChange={(val) => {
                    setReservePeriod(val);
                    // Dynamically simulate reserve values for different time periods
                    if (val === "This Month") setReserveValue(250000);
                    else if (val === "Last Month") setReserveValue(180000);
                    else if (val === "Last 7 Days") setReserveValue(120000);
                    else if (val === "Last 30 Days") setReserveValue(220000);
                    else if (val === "Last 90 Days") setReserveValue(450000);
                  }}
                  options={PERIOD_OPTIONS}
                  widthClass="w-48"
                  triggerWidthClass="w-[156px]"
                  heightClass="h-[38px]"
                />
              </div>
            </div>

            {/* KPI Cards Row */}
            <div className="self-stretch w-full grid grid-cols-1 md:grid-cols-3 gap-3">
              {kpiCardsConfig.map((card) => {
                const IconComponent = card.icon;

                return (
                  <div
                    key={card.id}
                    className="w-full p-4 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col gap-2.5"
                  >
                    <div className="flex justify-start items-start gap-5">
                      <div className="flex-1 flex flex-col gap-1 text-left">
                        <div className="text-gray-500 text-base font-normal">
                          {card.label}
                        </div>

                        <div className="flex items-center gap-1.5 relative -top-0.5">
                          <div
                            className={cn(
                              "text-2xl font-semibold",
                              card.valueColor || "text-gray-800",
                            )}
                          >
                            {card.value}
                          </div>

                          {card.badge && (
                            <div className="text-emerald-500 text-sm font-normal">
                              {card.badge}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="size-11 p-2.5 bg-gray-100 rounded-lg flex justify-center items-center shrink-0">
                        <IconComponent className="w-5 h-5 text-blue-950" />
                      </div>
                    </div>

                    <div className="text-gray-500 text-sm font-normal text-left">
                      {card.subtext}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Row 3: Airline & Country revenue */}
            <div className="self-stretch inline-flex justify-start items-start gap-5 flex-col lg:flex-row">
              {revenueColumnsConfig.map((col, idx) => (
                <div
                  key={idx}
                  className="flex-1 p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 inline-flex flex-col justify-start items-start gap-6 text-left"
                >
                  <div className="self-stretch justify-start text-gray-800 text-xl font-semibold leading-[100%]">
                    {col.title}
                  </div>
                  <div className="self-stretch flex flex-col justify-start items-start gap-[22px]">
                    {col.data.map((item, itemIdx) => (
                      <div
                        key={itemIdx}
                        className="self-stretch inline-flex justify-start items-center gap-5"
                      >
                        <div className="flex-1 inline-flex flex-col justify-start items-start gap-[11px]">
                          <div className="self-stretch inline-flex justify-between items-center">
                            <div className="flex justify-start items-center gap-2">
                              <div className="justify-start text-gray-800 text-base font-medium leading-[100%]">
                                {item.name}
                              </div>
                              {item.badges.map((badge, bIdx) => (
                                <div key={bIdx}>
                                  {badge.type === "code" ? (
                                    <div className="px-[5px] py-[3px] bg-gray-200 rounded-sm flex justify-center items-center">
                                      <div className="text-center justify-start text-gray-500 text-xs font-medium font-mono">
                                        {badge.value}
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="px-2.5 py-0.5 rounded-[70px] outline outline-1 outline-offset-[-1px] outline-gray-200 flex justify-center items-center">
                                      <div className="justify-start text-gray-800 text-xs font-medium">
                                        {badge.value}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-start items-center gap-2">
                              <div className="justify-start text-gray-800 text-base font-normal">
                                {item.amount}
                              </div>
                              <div className="justify-start text-gray-500 text-xs font-normal">
                                {item.percentage}
                              </div>
                            </div>
                          </div>
                          <div className="self-stretch h-2 bg-gray-100 rounded-[10px] flex flex-col justify-start items-start overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-[10px] max-w-full",
                                col.progressBarColor,
                                item.widthClass,
                              )}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Row 4: Credit Risk Overview */}
            <div className="self-stretch px-6 pb-6 pt-5.5 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-6 text-left">
              <div className="self-stretch justify-start text-gray-800 text-xl font-semibold">
                Credit Risk Overview
              </div>
              <div className="self-stretch inline-flex justify-start items-center gap-6 flex-col md:flex-row md:h-[107px]">
                {creditRiskCardsConfig.map((card) => (
                  <div
                    key={card.id}
                    className={cn(
                      "flex-1 p-4 bg-gray-100 rounded-[10px] inline-flex flex-col justify-start items-center",
                      card.progressClass ? "gap-2.5" : "self-stretch gap-1.5",
                    )}
                  >
                    <div className="flex flex-col justify-start items-center gap-1 relative -top-1 left-[1px]">
                      <div
                        className={cn(
                          "justify-start text-3xl font-semibold",
                          card.valueColor,
                        )}
                      >
                        {card.value}
                      </div>
                      <div className="justify-start text-gray-500 text-sm font-normal">
                        {card.label}
                      </div>
                    </div>
                    {card.progressClass && (
                      <div className="self-stretch h-2 bg-white rounded-[10px] flex flex-col justify-start items-start overflow-hidden relative -top-1">
                        <div
                          className={cn(
                            "h-full bg-emerald-600 rounded-[10px]",
                            card.progressClass,
                          )}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Detailed Analysis */}
        {activeTab === "detailed" && (
          <div className="self-stretch flex flex-col justify-start items-start gap-5 animate-fadeIn">
            {/* Detailed Analysis Title */}
            <div className="self-stretch inline-flex justify-between items-center">
              <div className="flex justify-start items-center gap-2">
                <div className="justify-start text-gray-800 text-lg font-semibold leading-[100%]">
                  Detailed Analysis
                </div>
                <div className="justify-start text-gray-500 text-sm font-normal">
                  ({dateRangeLabel})
                </div>
              </div>
            </div>

            {/* Filter Card */}
            <div className="flex flex-wrap items-center justify-between gap-4 w-full bg-white p-[17px] rounded-xl border border-gray-200">
              <div className="flex flex-wrap items-center gap-[12px]">
                <Dropdown
                  value={airlineFilter}
                  onChange={(val) => {
                    setAirlineFilter(val);
                    setFinancialCurrentPage(1);
                    setTransactionCurrentPage(1);
                  }}
                  options={airlineOptions}
                  triggerWidthClass="w-[180px]"
                  widthClass="w-[200px]"
                />
                <Dropdown
                  value={airportFilter}
                  onChange={(val) => {
                    setAirportFilter(val);
                    setFinancialCurrentPage(1);
                    setTransactionCurrentPage(1);
                  }}
                  options={airportOptions}
                  triggerWidthClass="w-[180px]"
                  widthClass="w-[320px]"
                />
                <Dropdown
                  value={countryFilter}
                  onChange={(val) => {
                    setCountryFilter(val);
                    setFinancialCurrentPage(1);
                    setTransactionCurrentPage(1);
                  }}
                  options={countryOptions}
                  triggerWidthClass="w-[180px]"
                  widthClass="w-[180px]"
                />
              </div>

              <button
                onClick={handleClearFilters}
                className="flex items-center gap-2 rounded-[8px] px-[14px] py-2 text-[16px] text-[#6B7280] transition-colors hover:text-gray-800 hover:bg-gray-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
                <span>Clear All</span>
              </button>
            </div>

            {/* KPI Cards Row */}
            <div className="self-stretch w-full grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Total Bookings Card */}
              <div className="w-full p-4 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col gap-2.5">
                <div className="flex justify-start items-start gap-5">
                  <div className="flex-1 flex flex-col gap-1 text-left">
                    <div className="text-gray-500 text-base font-normal">
                      Total Bookings
                    </div>
                    <div className="flex items-center gap-1.5 relative -top-0.5">
                      <div className="text-2xl font-semibold text-gray-800">
                        ${bookingsSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                  <div className="size-11 p-2.5 bg-gray-100 text-[#0F2757] rounded-lg flex justify-center items-center shrink-0">
                    <Plane className="w-5 h-5" />
                  </div>
                </div>
                <div className="text-gray-500 text-sm font-normal text-left">
                  {bookingsCount} {bookingsCount === 1 ? "booking" : "bookings"}
                </div>
              </div>

              {/* Total Top-ups Card */}
              <div className="w-full p-4 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col gap-2.5">
                <div className="flex justify-start items-start gap-5">
                  <div className="flex-1 flex flex-col gap-1 text-left">
                    <div className="text-gray-500 text-base font-normal">
                      Total Top-ups
                    </div>
                    <div className="flex items-center gap-1.5 relative -top-0.5">
                      <div className="text-2xl font-semibold text-emerald-600">
                        ${topupsSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                  <div className="size-11 p-2.5 bg-gray-100 text-[#0F2757] rounded-lg flex justify-center items-center shrink-0">
                    <TrendingUp className="w-5 h-5 text-[#0F2757]" />
                  </div>
                </div>
                <div className="text-gray-500 text-sm font-normal text-left">
                  {topupsCount} {topupsCount === 1 ? "transaction" : "transactions"}
                </div>
              </div>

              {/* Total Revenue Card */}
              <div className="w-full p-4 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col gap-2.5">
                <div className="flex justify-start items-start gap-5">
                  <div className="flex-1 flex flex-col gap-1 text-left">
                    <div className="text-gray-500 text-base font-normal">
                      Total Revenue
                    </div>
                    <div className="flex items-center gap-1.5 relative -top-0.5">
                      <div className="text-2xl font-semibold text-gray-800">
                        ${revenueSum.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                    </div>
                  </div>
                  <div className="size-11 p-2.5 bg-gray-100 rounded-lg flex justify-center items-center shrink-0">
                    <DollarSign className="w-5 h-5 text-[#0F2757]" />
                  </div>
                </div>
                <div className="text-gray-500 text-sm font-normal text-left">
                  Platform fees
                </div>
              </div>
            </div>

            {/* Airline Financial Health Section */}
            <div className="self-stretch p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start text-left">
              <div className="self-stretch justify-start text-gray-800 relative top-1">
                <span className="text-[20px] font-semibold">
                  Airline Financial Health
                </span>
                <span className="text-[16px] font-normal ml-1">
                  ({filteredFinancialData.length}{" "}
                  {filteredFinancialData.length === 1 ? "airline" : "airlines"})
                </span>
              </div>

              <div className="w-full overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white mt-7">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[110px]">
                        <SortHeader
                          label="Airline"
                          field="airline"
                          sortField={financialSortField}
                          sortOrder={financialSortOrder}
                          onSort={(f) => {
                            if (financialSortField === f) {
                              setFinancialSortOrder(financialSortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setFinancialSortField(f as keyof AirlineHealth);
                              setFinancialSortOrder("asc");
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="min-w-[115px]">
                        <SortHeader
                          label="Country"
                          field="country"
                          sortField={financialSortField}
                          sortOrder={financialSortOrder}
                          onSort={(f) => {
                            if (financialSortField === f) {
                              setFinancialSortOrder(financialSortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setFinancialSortField(f as keyof AirlineHealth);
                              setFinancialSortOrder("asc");
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="min-w-[110px]">
                        <SortHeader
                          label="Top-ups"
                          field="topups"
                          sortField={financialSortField}
                          sortOrder={financialSortOrder}
                          onSort={(f) => {
                            if (financialSortField === f) {
                              setFinancialSortOrder(financialSortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setFinancialSortField(f as keyof AirlineHealth);
                              setFinancialSortOrder("asc");
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="min-w-[130px] whitespace-nowrap">
                        <SortHeader
                          label="Booking Spend"
                          field="bookingSpend"
                          sortField={financialSortField}
                          sortOrder={financialSortOrder}
                          onSort={(f) => {
                            if (financialSortField === f) {
                              setFinancialSortOrder(financialSortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setFinancialSortField(f as keyof AirlineHealth);
                              setFinancialSortOrder("asc");
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="min-w-[105px]">
                        <SortHeader
                          label="Revenue"
                          field="revenue"
                          sortField={financialSortField}
                          sortOrder={financialSortOrder}
                          onSort={(f) => {
                            if (financialSortField === f) {
                              setFinancialSortOrder(financialSortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setFinancialSortField(f as keyof AirlineHealth);
                              setFinancialSortOrder("asc");
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="min-w-[145px] whitespace-nowrap">
                        <SortHeader
                          label="Wallet Balance"
                          field="walletBalance"
                          sortField={financialSortField}
                          sortOrder={financialSortOrder}
                          onSort={(f) => {
                            if (financialSortField === f) {
                              setFinancialSortOrder(financialSortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setFinancialSortField(f as keyof AirlineHealth);
                              setFinancialSortOrder("asc");
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="min-w-[120px] whitespace-nowrap">
                        <SortHeader
                          label="Credit Limit"
                          field="creditLimit"
                          sortField={financialSortField}
                          sortOrder={financialSortOrder}
                          onSort={(f) => {
                            if (financialSortField === f) {
                              setFinancialSortOrder(financialSortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setFinancialSortField(f as keyof AirlineHealth);
                              setFinancialSortOrder("asc");
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="min-w-[120px] whitespace-nowrap">
                        <SortHeader
                          label="Credit Used"
                          field="creditUsed"
                          sortField={financialSortField}
                          sortOrder={financialSortOrder}
                          onSort={(f) => {
                            if (financialSortField === f) {
                              setFinancialSortOrder(financialSortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setFinancialSortField(f as keyof AirlineHealth);
                              setFinancialSortOrder("asc");
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="min-w-[120px]">
                        <SortHeader
                          label="Remaining"
                          field="remaining"
                          sortField={financialSortField}
                          sortOrder={financialSortOrder}
                          onSort={(f) => {
                            if (financialSortField === f) {
                              setFinancialSortOrder(financialSortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setFinancialSortField(f as keyof AirlineHealth);
                              setFinancialSortOrder("asc");
                            }
                          }}
                        />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedFinancialData.length > 0 ? (
                      paginatedFinancialData.map((row) => (
                        <TableRow key={row.id} className="translate-y-1 translate-x-0.5">
                          <TableCell>{row.airline}</TableCell>
                          <TableCell>{row.country}</TableCell>
                          <TableCell>${row.topups.toLocaleString()}</TableCell>
                          <TableCell>${row.bookingSpend.toLocaleString()}</TableCell>
                          <TableCell className="!text-[#059669]">${row.revenue.toLocaleString()}</TableCell>
                          <TableCell>${row.walletBalance.toLocaleString()}</TableCell>
                          <TableCell>${row.creditLimit.toLocaleString()}</TableCell>
                          <TableCell className="!text-[#F59E0B]">${row.creditUsed.toLocaleString()}</TableCell>
                          <TableCell>${row.remaining.toLocaleString()}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="px-6 py-10 text-center text-gray-500">
                          No financial health data matches your filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="w-full mt-5">
                <Pagination
                  totalResults={filteredFinancialData.length}
                  currentPage={financialCurrentPage}
                  setCurrentPage={setFinancialCurrentPage}
                  resultsPerPage={financialPerPage}
                  setResultsPerPage={setFinancialPerPage}
                  totalPages={financialTotalPages}
                />
              </div>
            </div>

            {/* Transactions & Audit Trail Section */}
            <div className="self-stretch p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-5 text-left">
              <div className="self-stretch flex items-center justify-between">
                <div className="text-gray-800 text-[20px] font-semibold">
                  Transactions & Audit Trail
                </div>
                <Dropdown
                  value={txTypeFilter}
                  onChange={(val) => {
                    setTxTypeFilter(val);
                    setTransactionCurrentPage(1);
                  }}
                  options={transactionTypeOptions}
                  triggerWidthClass="w-[160px]"
                  widthClass="w-[160px]"
                  heightClass="h-[40px]"
                />
              </div>

              <div className="w-full overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[108px]">
                        <SortHeader
                          label="Date"
                          field="date"
                          sortField={transactionSortField}
                          sortOrder={transactionSortOrder}
                          onSort={(f) => {
                            if (transactionSortField === f) {
                              setTransactionSortOrder(transactionSortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setTransactionSortField(f as keyof Transaction);
                              setTransactionSortOrder("asc");
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="min-w-[117px]">
                        <SortHeader
                          label="Airline"
                          field="airline"
                          sortField={transactionSortField}
                          sortOrder={transactionSortOrder}
                          onSort={(f) => {
                            if (transactionSortField === f) {
                              setTransactionSortOrder(transactionSortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setTransactionSortField(f as keyof Transaction);
                              setTransactionSortOrder("asc");
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="min-w-[90px]">
                        <SortHeader
                          label="Airport"
                          field="airport"
                          sortField={transactionSortField}
                          sortOrder={transactionSortOrder}
                          onSort={(f) => {
                            if (transactionSortField === f) {
                              setTransactionSortOrder(transactionSortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setTransactionSortField(f as keyof Transaction);
                              setTransactionSortOrder("asc");
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="min-w-[100px]">
                        <SortHeader
                          label="Country"
                          field="country"
                          sortField={transactionSortField}
                          sortOrder={transactionSortOrder}
                          onSort={(f) => {
                            if (transactionSortField === f) {
                              setTransactionSortOrder(transactionSortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setTransactionSortField(f as keyof Transaction);
                              setTransactionSortOrder("asc");
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="min-w-[140px]">
                        <SortHeader
                          label="Type"
                          field="type"
                          sortField={transactionSortField}
                          sortOrder={transactionSortOrder}
                          onSort={(f) => {
                            if (transactionSortField === f) {
                              setTransactionSortOrder(transactionSortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setTransactionSortField(f as keyof Transaction);
                              setTransactionSortOrder("asc");
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="min-w-[120px]">
                        <SortHeader
                          label="Amount"
                          field="amount"
                          sortField={transactionSortField}
                          sortOrder={transactionSortOrder}
                          onSort={(f) => {
                            if (transactionSortField === f) {
                              setTransactionSortOrder(transactionSortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setTransactionSortField(f as keyof Transaction);
                              setTransactionSortOrder("asc");
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="min-w-[110px]">
                        <SortHeader
                          label="Status"
                          field="status"
                          sortField={transactionSortField}
                          sortOrder={transactionSortOrder}
                          onSort={(f) => {
                            if (transactionSortField === f) {
                              setTransactionSortOrder(transactionSortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setTransactionSortField(f as keyof Transaction);
                              setTransactionSortOrder("asc");
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="min-w-[120px]">
                        <SortHeader
                          label="Reference"
                          field="reference"
                          sortField={transactionSortField}
                          sortOrder={transactionSortOrder}
                          onSort={(f) => {
                            if (transactionSortField === f) {
                              setTransactionSortOrder(transactionSortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setTransactionSortField(f as keyof Transaction);
                              setTransactionSortOrder("asc");
                            }
                          }}
                        />
                      </TableHead>
                      <TableHead className="min-w-[168px]">
                        <SortHeader
                          label="Description"
                          field="description"
                          sortField={transactionSortField}
                          sortOrder={transactionSortOrder}
                          onSort={(f) => {
                            if (transactionSortField === f) {
                              setTransactionSortOrder(transactionSortOrder === "asc" ? "desc" : "asc");
                            } else {
                              setTransactionSortField(f as keyof Transaction);
                              setTransactionSortOrder("asc");
                            }
                          }}
                        />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransactions.length > 0 ? (
                      paginatedTransactions.map((tx) => {
                        let typeBadgeStyles = "bg-gray-100 text-gray-700";
                        let typePrefix = "";
                        if (tx.type === "Airline Top-up") {
                          typeBadgeStyles = "bg-emerald-50 text-emerald-700 border border-emerald-200/50";
                          typePrefix = "↗ ";
                        } else if (tx.type === "Hotel Booking") {
                          typeBadgeStyles = "bg-slate-100 text-slate-700 border border-slate-200/50";
                        } else if (tx.type === "Platform Fee") {
                          typeBadgeStyles = "bg-purple-50 text-purple-700 border border-purple-200/50";
                        } else if (tx.type === "Refund") {
                          typeBadgeStyles = "bg-rose-50 text-rose-700 border border-rose-200/50";
                        } else if (tx.type === "Platform Credit") {
                          typeBadgeStyles = "bg-amber-50 text-amber-700 border border-amber-200/50";
                        }

                        return (
                          <TableRow key={tx.id} className="translate-y-[3px] translate-x-0.5">
                            <TableCell>{tx.date}</TableCell>
                            <TableCell>{tx.airline}</TableCell>
                            <TableCell>
                              <span className="h-[28px] px-2.5 py-1.5 bg-gray-100 text-gray-800 rounded-[4px] text-[12px] font-medium uppercase font-figtree">
                                {tx.airport}
                              </span>
                            </TableCell>
                            <TableCell>
                              {tx.country === "United States" ? "USA" : tx.country}
                            </TableCell>
                            <TableCell>
                              <span className={cn("inline-flex items-center px-2.5 py-[3px] h-[20px] rounded-full text-[12px] font-medium", typeBadgeStyles)}>
                                {typePrefix}{tx.type}
                              </span>
                            </TableCell>
                            <TableCell className="!text-[#059669]">
                              +${tx.amount.toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <StatusBadge status={tx.status} />
                            </TableCell>
                            <TableCell >
                              {tx.reference.slice(0, 11)}
                              <br />
                              {tx.reference.slice(11)}
                            </TableCell>
                            <TableCell className="truncate max-w-[120px]">
                              {tx.description}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={9} className="px-6 py-10 text-center text-gray-500">
                          No transactions match your filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="w-full -mt-0.5">
                <Pagination
                  totalResults={filteredTransactions.length}
                  currentPage={transactionCurrentPage}
                  setCurrentPage={setTransactionCurrentPage}
                  resultsPerPage={transactionPerPage}
                  setResultsPerPage={setTransactionPerPage}
                  totalPages={transactionTotalPages}
                />
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Platform Treasury */}
        {activeTab === "treasury" && <div></div>}
      </div>
    </div>
  );
}
