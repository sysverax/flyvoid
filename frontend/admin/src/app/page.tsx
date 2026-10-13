"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import {
  Plane,
  Building2,
  DollarSign,
  TrendingUp,
  Award,
  Wallet,
} from "lucide-react";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { cn } from "@/src/lib/utils";
import { useAuth } from "@/src/hooks/useAuth";
import {
  ResponsiveContainer,
  BarChart,
  LineChart,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
  Line,
  Area,
} from "recharts";

interface KpiCardData {
  title: string;
  value: string;
  trend?: string;
  trendType?: "up" | "down" | "neutral";
  subtext?: string;
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
      { title: "Total Revenue", value: "$320K", icon: DollarSign },
      { title: "Total Cancelled Flights", value: "3", icon: "/icons/plane.svg" },
      { title: "Total Earnings", value: "$16.5K", icon: TrendingUp },
      { title: "Total Airlines", value: "5", icon: Plane },
      { title: "Total Credit Issued", value: "$410K", icon: "/icons/card.svg" },
      { title: "Total Wallet Balance", value: "$139.2K", icon: Wallet },
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
      { title: "Total Revenue", value: "$2.1M", icon: DollarSign },
      { title: "Total Cancelled Flights", value: "12", icon: "/icons/plane.svg" },
      { title: "Total Earnings", value: "$112K", icon: TrendingUp },
      { title: "Total Airlines", value: "5", icon: Plane },
      { title: "Total Credit Issued", value: "$410K", icon: "/icons/card.svg" },
      { title: "Total Wallet Balance", value: "$139.2K", icon: Wallet },
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
      { title: "Total Revenue", value: "$9.5M", icon: DollarSign },
      { title: "Total Cancelled Flights", value: "47", icon: "/icons/plane.svg" },
      { title: "Total Earnings", value: "$476K", icon: TrendingUp },
      { title: "Total Airlines", value: "5", icon: Plane },
      { title: "Total Credit Issued", value: "$410K", icon: "/icons/card.svg" },
      { title: "Total Wallet Balance", value: "$139.2K", icon: Wallet },
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
      { title: "Total Revenue", value: "$38.2M", icon: DollarSign },
      { title: "Total Cancelled Flights", value: "184", icon: "/icons/plane.svg" },
      { title: "Total Earnings", value: "$1.9M", icon: TrendingUp },
      { title: "Total Airlines", value: "5", icon: Plane },
      { title: "Total Credit Issued", value: "$410K", icon: "/icons/card.svg" },
      { title: "Total Wallet Balance", value: "$139.2K", icon: Wallet },
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
      { title: "Total Revenue", value: "$95.4M", icon: DollarSign },
      { title: "Total Cancelled Flights", value: "462", icon: "/icons/plane.svg" },
      { title: "Total Earnings", value: "$4.8M", icon: TrendingUp },
      { title: "Total Airlines", value: "5", icon: Plane },
      { title: "Total Credit Issued", value: "$410K", icon: "/icons/card.svg" },
      { title: "Total Wallet Balance", value: "$139.2K", icon: Wallet },
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

  // Dynamic chart revenue data matching the shared monthly curve
  const chartRevenueData = useMemo(() => {
    return [
      { month: "Jan", revenue: 26 },
      { month: "Feb", revenue: 46 },
      { month: "Mar", revenue: 40 },
      { month: "Apr", revenue: 31 },
      { month: "May", revenue: 53 },
      { month: "Jun", revenue: 52 },
      { month: "Jul", revenue: 42 },
      { month: "Aug", revenue: 24 },
      { month: "Sep", revenue: 51 },
      { month: "Oct", revenue: 38 },
      { month: "Nov", revenue: 47 },
      { month: "Dec", revenue: 25 },
    ];
  }, []);

  // Cancelled flights trend data matching the shared screenshot (Jan-Dec alternate labels)
  const cancelledFlightsTrendData = useMemo(() => {
    return [
      { month: "", count: 4 },
      { month: "Feb", count: 5 },
      { month: "", count: 2 },
      { month: "Apr", count: 2 },
      { month: "", count: 4 },
      { month: "Jun", count: 6 },
      { month: "", count: 6 },
      { month: "Aug", count: 6 },
      { month: "", count: 4 },
      { month: "Oct", count: 3 },
      { month: "", count: 3 },
      { month: "Dec", count: 2 },
    ];
  }, []);

  // Top 10 Airlines data matching the shared screenshot
  const topAirlinesData = useMemo(() => {
    return [
      {
        rank: 1,
        name: "Northern Star Airlines",
        code: "NSA",
        revenue: "$194.5K",
        cancelledFlights: 234,
      },
      {
        rank: 2,
        name: "SkyLine Airways",
        code: "SKY",
        revenue: "$122.5K",
        cancelledFlights: 156,
      },
      {
        rank: 3,
        name: "Atlantic Express",
        code: "ATX",
        revenue: "$79K",
        cancelledFlights: 89,
      },
      {
        rank: 4,
        name: "Meridian Air",
        code: "MDA",
        revenue: "$46K",
        cancelledFlights: 67,
      },
      {
        rank: 5,
        name: "Pacific Airways",
        code: "PCA",
        revenue: "$38K",
        cancelledFlights: 54,
      },
      {
        rank: 6,
        name: "Global Jet Airways",
        code: "GJA",
        revenue: "$29K",
        cancelledFlights: 41,
      },
      {
        rank: 7,
        name: "Summit Airlines",
        code: "SMA",
        revenue: "$22K",
        cancelledFlights: 33,
      },
      {
        rank: 8,
        name: "AeroVoyage",
        code: "AVG",
        revenue: "$18.5K",
        cancelledFlights: 27,
      },
      {
        rank: 9,
        name: "Horizon Express",
        code: "HZX",
        revenue: "$14K",
        cancelledFlights: 20,
      },
      {
        rank: 10,
        name: "BreezeLine Air",
        code: "BLA",
        revenue: "$9.5K",
        cancelledFlights: 15,
      },
    ];
  }, []);

  // Vendor Performance data matching the shared screenshot
  const vendorPerformanceData = useMemo(() => {
    return [
      {
        name: "Hotelbeds",
        share: "19.3% of earnings",
        percentage: 19.3,
        dotColor: "bg-[#1E2B4C]",
        barColor: "bg-[#1E2B4C]",
        bookings: "2,327",
        commission: "$50.5K",
      },
      {
        name: "RateHawk",
        share: "39.1% of earnings",
        percentage: 39.1,
        dotColor: "bg-[#16A34A]",
        barColor: "bg-[#16A34A]",
        bookings: "4,709",
        commission: "$102.3K",
      },
      {
        name: "Booking.com",
        share: "41.6% of earnings",
        percentage: 41.6,
        dotColor: "bg-[#EA580C]",
        barColor: "bg-[#EA580C]",
        bookings: "5,016",
        commission: "$109K",
      },
    ];
  }, []);

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeData.kpiCards.map((card, index) => {
            const isImageIcon = typeof card.icon === "string";
            const IconComponent = !isImageIcon ? (card.icon as React.ComponentType<{ className?: string }>) : null;

            return (
              <div
                key={index}
                className="w-full px-5 py-4 bg-white rounded-xl border border-gray-200 flex justify-between items-start hover:shadow-sm transition-shadow"
              >
                <div className="flex flex-col justify-start items-start">
                  <span className="text-gray-500 text-[14px] font-normal font-figtree">
                    {card.title}
                  </span>
                  <span className="text-gray-800 text-[26px] font-semibold font-figtree mt-2">
                    {card.value}
                  </span>
                </div>

                {/* Icon box */}
                <div className="size-11 p-2.5 bg-gray-100 rounded-lg flex justify-center items-center shrink-0 text-[#0F2757]">
                  {isImageIcon ? (
                    <Image
                      src={card.icon as string}
                      alt={card.title}
                      width={22}
                      height={22}
                      className="h-5.5 w-5.5"
                    />
                  ) : (
                    IconComponent && <IconComponent className="h-5.5 w-5.5 stroke-[1.8]" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Platform Revenue — This Month Full Width Chart Card */}
        <div className="self-stretch px-6 py-5 bg-white rounded-xl border border-gray-200 flex flex-col justify-start items-start gap-3">
          <div className="self-stretch justify-start text-gray-800 text-lg font-semibold font-figtree">
            Platform Revenue — This Month
          </div>
          <div className="w-full h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartRevenueData}
                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#CBD5E1" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#CBD5E1" stopOpacity={0.08} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="4 4"
                  stroke="#E5E7EB"
                  vertical={false}
                />
                <XAxis
                  dataKey="month"
                  stroke="#6B7280"
                  fontSize={12}
                  axisLine={false}
                  tickLine={false}
                  tickMargin={12}
                />
                <YAxis
                  stroke="#6B7280"
                  fontSize={12}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, 60]}
                  ticks={[0, 15, 30, 45, 60]}
                  tickFormatter={(val: number) => `$${val}k`}
                  width={45}
                />
                <Tooltip
                  cursor={{ stroke: "#0F2757", strokeWidth: 1, strokeDasharray: "3 3" }}
                  contentStyle={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E5E7EB",
                    borderRadius: "8px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  }}
                  formatter={(value: any) => [`$${value}k`, "Revenue"]}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#1E293B"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#revenueGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: "#1E293B", stroke: "#FFFFFF", strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Bottom Section: Cancelled Flights Trend + Top 10 Airlines */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-1">
          {/* Cancelled Flights Trend Card */}
          <div className="self-stretch px-6 py-5 bg-white rounded-xl border border-gray-200 flex flex-col justify-start items-start gap-4">
            <div className="self-stretch justify-start text-gray-800 text-lg font-semibold font-figtree">
              Cancelled Flights Trend — This Month
            </div>
            <div className="w-full h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={cancelledFlightsTrendData}
                  barSize={16}
                  margin={{ top: 15, right: 10, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="4 4"
                    stroke="#E5E7EB"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    stroke="#6B7280"
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={10}
                    interval={0}
                  />
                  <YAxis
                    stroke="#6B7280"
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 8]}
                    ticks={[0, 2, 4, 6, 8]}
                    width={40}
                  />
                  <Tooltip
                    cursor={{ fill: "transparent" }}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E5E7EB",
                      borderRadius: "8px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    }}
                    formatter={(value: any) => [value, "Cancelled Flights"]}
                  />
                  <Bar
                    dataKey="count"
                    fill="#1E2B4C"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top 10 Airlines Card */}
          <div className="self-stretch px-6 py-5 bg-white rounded-xl border border-gray-200 flex flex-col justify-start items-start gap-4">
            <div className="self-stretch justify-start text-gray-800 text-lg font-semibold font-figtree">
              Top 10 Airlines — This Month
            </div>
            <div className="w-full max-h-[280px] overflow-y-auto pr-1.5 space-y-3">
              {topAirlinesData.map((airline) => (
                <div
                  key={airline.rank}
                  className="w-full p-3 bg-white rounded-xl border border-gray-100 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex justify-between items-center hover:border-gray-200 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-md bg-gray-100 text-gray-600 text-xs font-medium flex items-center justify-center shrink-0">
                      {airline.rank}
                    </span>
                    <div className="flex flex-col">
                      <span className="text-gray-900 text-sm font-medium font-figtree leading-snug">
                        {airline.name}
                      </span>
                      <span className="inline-block px-1.5 py-0.5 mt-1 bg-gray-100 text-gray-500 rounded text-[11px] font-medium tracking-wide w-fit">
                        {airline.code}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-gray-900 text-sm font-semibold font-figtree">
                      {airline.revenue}
                    </span>
                    <span className="text-gray-400 text-xs mt-0.5">
                      {airline.cancelledFlights} cancelled flights
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Vendor Performance — This Month Card */}
        <div className="self-stretch px-6 py-5 bg-white rounded-xl border border-gray-200 flex flex-col justify-start items-start gap-6">
          <div className="self-stretch flex items-center gap-2 text-gray-800 text-lg font-semibold font-figtree">
            <Building2 className="w-5 h-5 text-gray-500" />
            <span>Vendor Performance — This Month</span>
          </div>

          <div className="self-stretch flex flex-col gap-6">
            {vendorPerformanceData.map((vendor, idx) => (
              <div key={idx} className="self-stretch flex flex-col gap-2.5">
                <div className="self-stretch flex justify-between items-start">
                  {/* Left: Vendor Name & Share */}
                  <div className="flex items-start gap-2.5">
                    <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", vendor.dotColor)} />
                    <div className="flex flex-col">
                      <span className="text-gray-900 text-sm font-semibold font-figtree">
                        {vendor.name}
                      </span>
                      <span className="text-gray-400 text-xs font-normal">
                        {vendor.share}
                      </span>
                    </div>
                  </div>

                  {/* Right: Bookings & Commission */}
                  <div className="flex items-center gap-12 sm:gap-16">
                    <div className="flex flex-col items-end">
                      <span className="text-gray-400 text-xs font-normal">
                        Total bookings
                      </span>
                      <span className="text-gray-800 text-sm font-semibold font-figtree mt-0.5">
                        {vendor.bookings}
                      </span>
                    </div>
                    <div className="flex flex-col items-end min-w-[100px]">
                      <span className="text-gray-400 text-xs font-normal">
                        Commission earned
                      </span>
                      <span className="text-emerald-600 text-sm font-semibold font-figtree mt-0.5">
                        {vendor.commission}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all duration-500", vendor.barColor)}
                    style={{ width: `${vendor.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-gray-100" />

          {/* All vendors summary row */}
          <div className="self-stretch flex justify-between items-center pt-1">
            <span className="text-gray-900 text-sm font-semibold font-figtree">
              All vendors (3)
            </span>
            <div className="flex items-center gap-12 sm:gap-16">
              <div className="flex flex-col items-end">
                <span className="text-gray-400 text-xs font-normal">
                  Total bookings
                </span>
                <span className="text-gray-800 text-sm font-semibold font-figtree mt-0.5">
                  12,052
                </span>
              </div>
              <div className="flex flex-col items-end min-w-[100px]">
                <span className="text-gray-400 text-xs font-normal">
                  Commission earned
                </span>
                <span className="text-emerald-600 text-sm font-semibold font-figtree mt-0.5">
                  $261.8K
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
