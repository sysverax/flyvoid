"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import {
  Plane,
  Building2,
  DollarSign,
  TrendingUp,
  Award,
} from "lucide-react";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { cn } from "@/src/lib/utils";
import { useAuth } from "@/src/hooks/useAuth";
import {
  ResponsiveContainer,
  BarChart,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Line,
} from "recharts";

interface KpiCardData {
  title: string;
  value: string;
  trend: string;
  trendType: "up" | "down" | "neutral";
  subtext: string;
  icon: React.ComponentType<{ className?: string }> | string;
}

interface ChartBarData {
  month: string;
  value: number;
}

interface LinePoint {
  month: string;
  val: string;
  x: number;
  y: number;
}

interface DashboardState {
  kpiCards: KpiCardData[];
  cancellations: ChartBarData[];
  revenuePoints: LinePoint[];
  revenuePath: string;
  revenueAreaPath: string;
  ratios: {
    revenueToSpend: string;
    avgRevenuePerAirline: string;
    topAirline: string;
  };
}

// Data configurations for different time periods
const PERIOD_DATA: Record<string, DashboardState> = {
  "Today": {
    kpiCards: [
      {
        title: "Total Airlines",
        value: "24",
        trend: "+4% vs yesterday",
        trendType: "up",
        subtext: "Today",
        icon: Plane,
      },
      {
        title: "Active Airlines",
        value: "18",
        trend: "75% of onboarded",
        trendType: "neutral",
        subtext: "Adoption & retention",
        icon: Building2,
      },
      {
        title: "Cancelled Flights",
        value: "3",
        trend: "-50% vs yesterday",
        trendType: "down",
        subtext: "Today",
        icon: "/icons/plane.svg",
      },
      {
        title: "Platform Revenue",
        value: "$9.2K",
        trend: "+12% vs yesterday",
        trendType: "up",
        subtext: "Platform fees only",
        icon: DollarSign,
      },
    ],
    cancellations: [
      { month: "02:00", value: 0 },
      { month: "04:00", value: 1 },
      { month: "06:00", value: 0 },
      { month: "08:00", value: 2 },
      { month: "10:00", value: 3 },
      { month: "12:00", value: 1 },
      { month: "14:00", value: 2 },
      { month: "16:00", value: 1 },
      { month: "18:00", value: 0 },
      { month: "20:00", value: 1 },
      { month: "22:00", value: 2 },
      { month: "00:00", value: 0 },
    ],
    revenuePoints: [
      { month: "02:00", val: "0.5", x: 40, y: 0 },
      { month: "04:00", val: "1.2", x: 83, y: 0 },
      { month: "06:00", val: "0.8", x: 123, y: 0 },
      { month: "08:00", val: "2.5", x: 164, y: 0 },
      { month: "10:00", val: "4.8", x: 205, y: 0 },
      { month: "12:00", val: "5.5", x: 245, y: 0 },
      { month: "14:00", val: "6.2", x: 286, y: 0 },
      { month: "16:00", val: "5.0", x: 326, y: 0 },
      { month: "18:00", val: "4.5", x: 367, y: 0 },
      { month: "20:00", val: "6.8", x: 408, y: 0 },
      { month: "22:00", val: "8.2", x: 448, y: 0 },
      { month: "00:00", val: "8.5", x: 488, y: 0 },
    ],
    revenuePath: "",
    revenueAreaPath: "",
    ratios: {
      revenueToSpend: "5.5%",
      avgRevenuePerAirline: "$4.8K",
      topAirline: "Northern Star Airlines",
    },
  },
  "This Week": {
    kpiCards: [
      {
        title: "Total Airlines",
        value: "24",
        trend: "+8% vs last week",
        trendType: "up",
        subtext: "This Week",
        icon: Plane,
      },
      {
        title: "Active Airlines",
        value: "19",
        trend: "79% of onboarded",
        trendType: "neutral",
        subtext: "Adoption & retention",
        icon: Building2,
      },
      {
        title: "Cancelled Flights",
        value: "18",
        trend: "-12% vs last week",
        trendType: "down",
        subtext: "This Week",
        icon: "/icons/plane.svg",
      },
      {
        title: "Platform Revenue",
        value: "$58.2K",
        trend: "+15% vs last week",
        trendType: "up",
        subtext: "Platform fees only",
        icon: DollarSign,
      },
    ],
    cancellations: [
      { month: "Mon", value: 2 },
      { month: "Tue", value: 4 },
      { month: "Wed", value: 1 },
      { month: "Thu", value: 3 },
      { month: "Fri", value: 5 },
      { month: "Sat", value: 2 },
      { month: "Sun", value: 1 },
    ],
    revenuePoints: [
      { month: "Mon", val: "7.2", x: 0, y: 0 },
      { month: "Tue", val: "8.5", x: 0, y: 0 },
      { month: "Wed", val: "6.8", x: 0, y: 0 },
      { month: "Thu", val: "9.5", x: 0, y: 0 },
      { month: "Fri", val: "10.2", x: 0, y: 0 },
      { month: "Sat", val: "8.8", x: 0, y: 0 },
      { month: "Sun", val: "7.2", x: 0, y: 0 },
    ],
    revenuePath: "",
    revenueAreaPath: "",
    ratios: {
      revenueToSpend: "5.1%",
      avgRevenuePerAirline: "$2.4K",
      topAirline: "Northern Star Airlines",
    },
  },
  "This Month": {
    kpiCards: [
      {
        title: "Total Airlines",
        value: "24",
        trend: "+12% vs prior period",
        trendType: "up",
        subtext: "This Month",
        icon: Plane,
      },
      {
        title: "Active Airlines",
        value: "21",
        trend: "0% 60% of onboarded",
        trendType: "neutral",
        subtext: "Adoption & retention",
        icon: Building2,
      },
      {
        title: "Cancelled Flights",
        value: "84",
        trend: "-36% vs prior period",
        trendType: "down",
        subtext: "This Month",
        icon: "/icons/plane.svg",
      },
      {
        title: "Platform Revenue",
        value: "$234K",
        trend: "18% vs prior period",
        trendType: "up",
        subtext: "Platform fees only",
        icon: DollarSign,
      },
    ],
    cancellations: [
      { month: "Jan", value: 46 },
      { month: "Feb", value: 55 },
      { month: "Mar", value: 37 },
      { month: "Apr", value: 69 },
      { month: "May", value: 56 },
      { month: "Jun", value: 74 },
      { month: "Jul", value: 84 },
      { month: "Aug", value: 76 },
      { month: "Sep", value: 64 },
      { month: "Oct", value: 54 },
      { month: "Nov", value: 72 },
      { month: "Dec", value: 80 },
    ],
    revenuePoints: [
      { month: "Jan", val: "130", x: 40, y: 112 },
      { month: "Feb", val: "148", x: 83, y: 94 },
      { month: "Mar", val: "115", x: 123, y: 124 },
      { month: "Apr", val: "185", x: 164, y: 59 },
      { month: "May", val: "155", x: 205, y: 85 },
      { month: "Jun", val: "198", x: 245, y: 48 },
      { month: "Jul", val: "245", x: 286, y: 11 },
      { month: "Aug", val: "220", x: 326, y: 29 },
      { month: "Sep", val: "188", x: 367, y: 57 },
      { month: "Oct", val: "168", x: 408, y: 74 },
      { month: "Nov", val: "176", x: 448, y: 66 },
      { month: "Dec", val: "216", x: 488, y: 33 },
    ],
    revenuePath: "M 40,112 C 60,103 63,94 83,94 C 103,94 103,124 123,124 C 143,124 144,59 164,59 C 184,59 185,85 205,85 C 225,85 225,48 245,48 C 265,48 266,11 286,11 C 306,11 306,29 326,29 C 346,29 347,57 367,57 C 387,57 388,74 408,74 C 428,74 428,66 448,66 C 468,66 468,33 488,33",
    revenueAreaPath: "M 40,112 C 60,103 63,94 83,94 C 103,94 103,124 123,124 C 143,124 144,59 164,59 C 184,59 185,85 205,85 C 225,85 225,48 245,48 C 265,48 266,11 286,11 C 306,11 306,29 326,29 C 346,29 347,57 367,57 C 387,57 388,74 408,74 C 428,74 428,66 448,66 C 468,66 468,33 488,33 L 488,224 L 40,224 Z",
    ratios: {
      revenueToSpend: "5.0%",
      avgRevenuePerAirline: "$95.2K",
      topAirline: "Northern Star Airlines",
    },
  },
  "This Year": {
    kpiCards: [
      {
        title: "Total Airlines",
        value: "28",
        trend: "+40% vs prior period",
        trendType: "up",
        subtext: "This Year",
        icon: Plane,
      },
      {
        title: "Active Airlines",
        value: "25",
        trend: "72% of onboarded",
        trendType: "neutral",
        subtext: "Adoption & retention",
        icon: Building2,
      },
      {
        title: "Cancelled Flights",
        value: "920",
        trend: "-12% vs prior period",
        trendType: "down",
        subtext: "This Year",
        icon: "/icons/plane.svg",
      },
      {
        title: "Platform Revenue",
        value: "$2.4M",
        trend: "32% vs prior period",
        trendType: "up",
        subtext: "Platform fees only",
        icon: DollarSign,
      },
    ],
    cancellations: [
      { month: "Jan", value: 50 },
      { month: "Feb", value: 52 },
      { month: "Mar", value: 26 },
      { month: "Apr", value: 58 },
      { month: "May", value: 48 },
      { month: "Jun", value: 66 },
      { month: "Jul", value: 76 },
      { month: "Aug", value: 68 },
      { month: "Sep", value: 58 },
      { month: "Oct", value: 46 },
      { month: "Nov", value: 64 },
      { month: "Dec", value: 72 },
    ],
    revenuePoints: [
      { month: "Jan", val: "115", x: 40, y: 125 },
      { month: "Feb", val: "130", x: 83, y: 110 },
      { month: "Mar", val: "95", x: 123, y: 140 },
      { month: "Apr", val: "165", x: 164, y: 75 },
      { month: "May", val: "135", x: 205, y: 102 },
      { month: "Jun", val: "180", x: 245, y: 62 },
      { month: "Jul", val: "220", x: 286, y: 28 },
      { month: "Aug", val: "190", x: 326, y: 48 },
      { month: "Sep", val: "170", x: 367, y: 72 },
      { month: "Oct", val: "150", x: 408, y: 90 },
      { month: "Nov", val: "160", x: 448, y: 82 },
      { month: "Dec", val: "195", x: 488, y: 50 },
    ],
    revenuePath: "M 40,125 C 60,117 63,110 83,110 C 103,110 103,140 123,140 C 143,140 144,75 164,75 C 184,75 185,102 205,102 C 225,102 225,62 245,62 C 265,62 266,28 286,28 C 306,28 306,48 326,48 C 346,48 347,72 367,72 C 387,72 388,90 408,90 C 428,90 428,82 448,82 C 468,82 468,50 488,50",
    revenueAreaPath: "M 40,125 C 60,117 63,110 83,110 C 103,110 103,140 123,140 C 143,140 144,75 164,75 C 184,75 185,102 205,102 C 225,102 225,62 245,62 C 265,62 266,28 286,28 C 306,28 306,48 326,48 C 346,48 347,72 367,72 C 387,72 388,90 408,90 C 428,90 428,82 448,82 C 468,82 468,50 488,50 L 488,224 L 40,224 Z",
    ratios: {
      revenueToSpend: "5.2%",
      avgRevenuePerAirline: "$102.5K",
      topAirline: "Pacific Airways",
    },
  },
  "All": {
    kpiCards: [
      {
        title: "Total Airlines",
        value: "32",
        trend: "+15% vs prior year",
        trendType: "up",
        subtext: "Overall",
        icon: Plane,
      },
      {
        title: "Active Airlines",
        value: "28",
        trend: "87% of onboarded",
        trendType: "neutral",
        subtext: "Adoption & retention",
        icon: Building2,
      },
      {
        title: "Cancelled Flights",
        value: "2,450",
        trend: "-18% vs prior year",
        trendType: "down",
        subtext: "Overall",
        icon: "/icons/plane.svg",
      },
      {
        title: "Platform Revenue",
        value: "$8.4M",
        trend: "+35% vs prior year",
        trendType: "up",
        subtext: "Platform fees only",
        icon: DollarSign,
      },
    ],
    cancellations: [
      { month: "Jan", value: 65 },
      { month: "Feb", value: 78 },
      { month: "Mar", value: 45 },
      { month: "Apr", value: 85 },
      { month: "May", value: 68 },
      { month: "Jun", value: 92 },
      { month: "Jul", value: 95 },
      { month: "Aug", value: 88 },
      { month: "Sep", value: 74 },
      { month: "Oct", value: 62 },
      { month: "Nov", value: 80 },
      { month: "Dec", value: 85 },
    ],
    revenuePoints: [
      { month: "Jan", val: "450", x: 0, y: 0 },
      { month: "Feb", val: "520", x: 0, y: 0 },
      { month: "Mar", val: "410", x: 0, y: 0 },
      { month: "Apr", val: "680", x: 0, y: 0 },
      { month: "May", val: "590", x: 0, y: 0 },
      { month: "Jun", val: "720", x: 0, y: 0 },
      { month: "Jul", val: "840", x: 0, y: 0 },
      { month: "Aug", val: "790", x: 0, y: 0 },
      { month: "Sep", val: "690", x: 0, y: 0 },
      { month: "Oct", val: "610", x: 0, y: 0 },
      { month: "Nov", val: "670", x: 0, y: 0 },
      { month: "Dec", val: "810", x: 0, y: 0 },
    ],
    revenuePath: "",
    revenueAreaPath: "",
    ratios: {
      revenueToSpend: "5.8%",
      avgRevenuePerAirline: "$120K",
      topAirline: "Pacific Airways",
    },
  },
};

const FILTER_OPTIONS = [
  { value: "Today", label: "Today" },
  { value: "This Week", label: "This Week" },
  { value: "This Month", label: "This Month" },
  { value: "This Year", label: "This Year" },
  { value: "All", label: "All" },
];

export default function DashboardPage() {
  const { hasPermission } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("This Month");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Get active data based on dropdown selection
  const activeData = useMemo(() => {
    return PERIOD_DATA[selectedPeriod] || PERIOD_DATA["This Month"];
  }, [selectedPeriod]);

  // Hover states for dynamic tooltips
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);
  const [hoveredPointIndex, setHoveredPointIndex] = useState<number | null>(null);

  // Stats computed from activeData for Recharts components
  const stats = useMemo(() => {
    return {
      monthlyCancellations: activeData.cancellations.map((item) => ({
        month: item.month,
        count: item.value,
      })),
    };
  }, [activeData.cancellations]);

  // Dynamic YAxis configuration for cancellations BarChart
  const cancellationsYAxisConfig = useMemo(() => {
    if (selectedPeriod === "Today") {
      return {
        domain: [0, 4] as [number, number],
        ticks: [0, 1, 2, 3, 4],
      };
    }
    if (selectedPeriod === "This Week") {
      return {
        domain: [0, 6] as [number, number],
        ticks: [0, 2, 4, 6],
      };
    }
    return {
      domain: [0, 100] as [number, number],
      ticks: [0, 25, 50, 75, 100],
    };
  }, [selectedPeriod]);

  // Dynamic YAxis configuration for revenue LineChart
  const revenueYAxisConfig = useMemo(() => {
    if (selectedPeriod === "Today") {
      return {
        domain: [0, 10] as [number, number],
        ticks: [0, 2.5, 5, 7.5, 10],
        tickFormatter: (val: any) => `$${val}K`,
      };
    }
    if (selectedPeriod === "This Week") {
      return {
        domain: [0, 12] as [number, number],
        ticks: [0, 3, 6, 9, 12],
        tickFormatter: (val: any) => `$${val}K`,
      };
    }
    if (selectedPeriod === "All") {
      return {
        domain: [0, 1000] as [number, number],
        ticks: [0, 250, 500, 750, 1000],
        tickFormatter: (val: any) => `$${val}K`,
      };
    }
    // This Month / This Year
    return {
      domain: [0, 260] as [number, number],
      ticks: [0, 65, 130, 195, 260],
      tickFormatter: (val: any) => `$${val}K`,
    };
  }, [selectedPeriod]);

  if (!mounted) return null;
  if (!hasPermission("view", "/")) return null;

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      <div className="space-y-4.5">

        {/* Header Title Section */}
        <div>
          <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%]">
            Dashboard
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            Platform health and operational overview
          </p>
        </div>

        {/* Date / Metrics Filter Section */}
        <div className="self-stretch flex justify-between items-center bg-transparent">
          <div className="justify-start text-gray-500 text-sm font-normal font-figtree">
            {selectedPeriod} metrics
          </div>
          <Dropdown
            value={selectedPeriod}
            onChange={(val) => setSelectedPeriod(val)}
            options={FILTER_OPTIONS}
            widthClass="w-45"
            triggerWidthClass="w-45"
            heightClass="h-12"
          />
        </div>

        {/* KPI metrics cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {activeData.kpiCards.map((card, index) => {
            const isImageIcon = typeof card.icon === "string";
            const IconComponent = !isImageIcon ? (card.icon as React.ComponentType<{ className?: string }>) : null;

            return (
              <div
                key={index}
                className="w-full px-4 py-4 leading-[100%] tracking-[0%] bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-4 hover:shadow-md transition-shadow"
              >
                <div className="self-stretch flex flex-col justify-start items-start gap-2">
                  <div className="self-stretch inline-flex justify-between items-start gap-5 relative -left-0.5">
                    <div className="flex-1 inline-flex flex-col justify-start items-start gap-1.5">
                      <div className="self-stretch justify-start text-gray-500 text-base font-normal font-figtree leading-[100%] tracking-[0%]">
                        {card.title}
                      </div>
                      <div className="inline-flex justify-start items-center gap-1.5">
                        <div className="justify-start text-gray-800 text-2xl font-semibold font-figtree">
                          {card.value}
                        </div>
                      </div>
                    </div>

                    {/* Premium Icon box */}
                    <div className="size-11 p-2.5 bg-gray-100 rounded-lg flex justify-center items-center shrink-0">
                      {isImageIcon ? (
                        <Image
                          src={card.icon as string}
                          alt={card.title}
                          width={22}
                          height={22}
                          className="h-5.5 w-5.5 opacity-90"
                        />
                      ) : (
                        IconComponent && <IconComponent className="h-5.5 w-6 text-blue-950 stroke-[1.8]" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="self-stretch flex flex-col justify-start items-start gap-2">
                  <div className="self-stretch inline-flex justify-start items-center gap-1">
                    <div className="flex justify-start items-center gap-1 text-sm font-normal font-figtree">
                      {(() => {
                        const firstSpace = card.trend.indexOf(" ");
                        if (firstSpace === -1) {
                          return (
                            <span
                              className={cn(
                                card.trendType === "up" && "text-emerald-500",
                                card.trendType === "down" && "text-rose-500",
                                card.trendType === "neutral" && "text-gray-500"
                              )}
                            >
                              {card.trend}
                            </span>
                          );
                        }
                        const valuePart = card.trend.substring(0, firstSpace);
                        const textPart = card.trend.substring(firstSpace);
                        return (
                          <>
                            <span
                              className={cn(
                                card.trendType === "up" && "text-emerald-500",
                                card.trendType === "down" && "text-rose-500",
                                card.trendType === "neutral" && "text-gray-500"
                              )}
                            >
                              {valuePart}
                            </span>
                            <span className="text-gray-500">{textPart.trim()}</span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  <div className="justify-start text-gray-500 text-sm font-normal font-figtree leading-[100%] tracking-[0%]">
                    {card.subtext}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-0.5">

          <div className="animate-fade-in self-stretch pl-6 pr-4.5 pt-6 pb-3 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-5">
            <div className="self-stretch justify-start text-gray-800 text-xl font-semibold font-figtree">
              Monthly Flight Cancellations
            </div>
            <div className="w-full h-[256px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={stats.monthlyCancellations}
                  barCategoryGap="3"
                  margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="barHoverBorder" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4797f9" />
                      <stop offset="100%" stopColor="#1e3a8a" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={2}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                    domain={cancellationsYAxisConfig.domain}
                    ticks={cancellationsYAxisConfig.ticks}
                    width={26}
                    textAnchor="end"
                  // dx={0}
                  />
                  <Tooltip
                    cursor={false}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: any) => [value, "Flights"]}
                  />
                  <Bar
                    dataKey="count"
                    fill="#0F2757"
                    radius={[6, 6, 0, 0]}
                    activeBar={{
                      stroke: "url(#barHoverBorder)",
                      strokeWidth: 2,
                      fill: "rgb(8, 41, 109)"
                    }}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monthly Platform Revenue Line Chart Card */}
          <div className="self-stretch pl-6 pr-9 pt-6 pb-3 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-4.5">
            <div className="self-stretch justify-start text-gray-800 text-xl font-semibold font-figtree leading-[150%] tracking-[0%] relative -left-0.5">
              Monthly Platform Revenue
            </div>
            <div className="w-full h-[256px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={activeData.revenuePoints}
                  margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                  style={{ overflow: "visible" }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis
                    dataKey="month"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={2}
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                    domain={revenueYAxisConfig.domain}
                    ticks={revenueYAxisConfig.ticks}
                    width={45}
                    tickFormatter={revenueYAxisConfig.tickFormatter}
                    textAnchor="start"
                    dx={-39}
                  />
                  <Tooltip
                    cursor={false}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                    formatter={(value: any) => [`$${value}K`, "Revenue"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="val"
                    stroke="#059669"
                    strokeWidth={2.5}
                    dot={{ fill: "#10B981", r: 4, strokeWidth: 0 }}
                    activeDot={{ fill: "#10B981", r: 6, strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Bottom Ratio details footer panel */}
        <div className="self-stretch px-6 py-5 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col md:flex-row justify-start items-stretch gap-6">
          {[
            {
              label: "REVENUE TO SPEND RATIO",
              value: activeData.ratios.revenueToSpend,
              icon: TrendingUp,
            },
            {
              label: "AVG REVENUE PER AIRLINE",
              value: activeData.ratios.avgRevenuePerAirline,
              icon: DollarSign,
            },
            {
              label: "TOP AIRLINE (REVENUE)",
              value: activeData.ratios.topAirline,
              icon: Award,
              truncate: true,
            },
          ].map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="flex-1 flex justify-start items-center gap-3 py-1">
                <div className="size-11 p-2.5 bg-gray-100 rounded-lg flex justify-center items-center gap-2.5 shrink-0">
                  <Icon className="h-5 w-5 text-blue-950" />
                </div>
                <div className="flex flex-col justify-start items-start">
                  <div className="justify-start text-gray-500 text-[14px] font-normal uppercase font-figtree">
                    {item.label}
                  </div>
                  <div
                    className={cn(
                      "justify-start text-gray-800 text-lg font-semibold font-figtree -mt-1",
                      item.truncate && "truncate max-w-[200px]"
                    )}
                    title={item.truncate ? item.value : undefined}
                  >
                    {item.value}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </div>
    </div>
  );
}
