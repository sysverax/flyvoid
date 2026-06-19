"use client";

import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import { cn } from "@/src/lib/utils";
import { Dropdown } from "@/src/components/ui/Dropdown";

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

export default function PaymentsPage() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "detailed" | "treasury"
  >("overview");
  const [timePeriod, setTimePeriod] = useState("This Month");

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

        {/* Time period selection dropdown */}
        <Dropdown
          value={timePeriod}
          onChange={setTimePeriod}
          options={PERIOD_OPTIONS}
          heightClass="h-[48px]"
        />
      </div>

      {/* Main content body */}
      <div className="self-stretch flex flex-col justify-start items-start gap-6">
        {/* Navigation Tabs bar */}
        <div className="pb-2 border-b border-gray-300 inline-flex justify-start items-center gap-1">
          {TABS_CONFIG.map((tab) => {
            const isActive = activeTab === tab.id;
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "h-[37px] w-[160px] p-2.5 rounded-md flex justify-center items-center gap-1.5 transition-all duration-150 cursor-pointer",
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
                  ({timePeriod})
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
        {activeTab === "detailed" && <div></div>}

        {/* Tab 3: Platform Treasury */}
        {activeTab === "treasury" && <div></div>}
      </div>
    </div>
  );
}
