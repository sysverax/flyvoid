"use client";

import { useState, useEffect, useMemo } from "react";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { cn } from "@/src/lib/utils";
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

interface KpiCard {
  title: string;
  value: string;
  isGreen?: boolean;
}

interface PeriodDashboardData {
  kpiCards: KpiCard[];
  hotelSpend: { month: string; spend: number }[];
  passengers: { month: string; passengers: number }[];
  cancelledFlights: { month: string; flights: number }[];
}

const PERIOD_DATA: Record<string, PeriodDashboardData> = {
  "Today": {
    kpiCards: [
      { title: "Total Hotel Booking Cost", value: "$18,420.00", isGreen: true },
      { title: "Platform Fee Rate", value: "5%" },
      { title: "Total Hotel Bookings", value: "74" },
      { title: "Total Cancelled Flights", value: "7" },
    ],
    hotelSpend: [
      { month: "Jan", spend: 10.0 },
      { month: "Feb", spend: 45.0 },
      { month: "Mar", spend: 30.0 },
      { month: "Apr", spend: 28.0 },
      { month: "May", spend: 12.0 },
      { month: "Jun", spend: 35.0 },
      { month: "Jul", spend: 50.0 },
      { month: "Aug", spend: 20.0 },
      { month: "Sep", spend: 25.0 },
      { month: "Oct", spend: 38.0 },
    ],
    passengers: [
      { month: "Jan", passengers: 60 },
      { month: "Feb", passengers: 340 },
      { month: "Mar", passengers: 220 },
      { month: "Apr", passengers: 210 },
      { month: "May", passengers: 95 },
      { month: "Jun", passengers: 250 },
      { month: "Jul", passengers: 360 },
      { month: "Aug", passengers: 120 },
      { month: "Sep", passengers: 190 },
      { month: "Oct", passengers: 260 },
    ],
    cancelledFlights: [
      { month: "Jan", flights: 4 },
      { month: "Feb", flights: 18 },
      { month: "Mar", flights: 10 },
      { month: "Apr", flights: 11 },
      { month: "May", flights: 4 },
      { month: "Jun", flights: 12 },
      { month: "Jul", flights: 18 },
      { month: "Aug", flights: 5 },
      { month: "Sep", flights: 13 },
      { month: "Oct", flights: 16 },
    ],
  },
  "This Week": {
    kpiCards: [
      { title: "Total Hotel Booking Cost", value: "$124,550.00", isGreen: true },
      { title: "Platform Fee Rate", value: "5%" },
      { title: "Total Hotel Bookings", value: "502" },
      { title: "Total Cancelled Flights", value: "48" },
    ],
    hotelSpend: [
      { month: "Jan", spend: 11.5 },
      { month: "Feb", spend: 70.0 },
      { month: "Mar", spend: 48.0 },
      { month: "Apr", spend: 42.0 },
      { month: "May", spend: 15.0 },
      { month: "Jun", spend: 52.0 },
      { month: "Jul", spend: 68.0 },
      { month: "Aug", spend: 28.0 },
      { month: "Sep", spend: 32.0 },
      { month: "Oct", spend: 54.0 },
    ],
    passengers: [
      { month: "Jan", passengers: 90 },
      { month: "Feb", passengers: 510 },
      { month: "Mar", passengers: 330 },
      { month: "Apr", passengers: 320 },
      { month: "May", passengers: 130 },
      { month: "Jun", passengers: 370 },
      { month: "Jul", passengers: 540 },
      { month: "Aug", passengers: 180 },
      { month: "Sep", passengers: 280 },
      { month: "Oct", passengers: 390 },
    ],
    cancelledFlights: [
      { month: "Jan", flights: 6 },
      { month: "Feb", flights: 26 },
      { month: "Mar", flights: 15 },
      { month: "Apr", flights: 16 },
      { month: "May", flights: 6 },
      { month: "Jun", flights: 18 },
      { month: "Jul", flights: 26 },
      { month: "Aug", flights: 8 },
      { month: "Sep", flights: 19 },
      { month: "Oct", flights: 24 },
    ],
  },
  "This Month": {
    kpiCards: [
      { title: "Total Hotel Booking Cost", value: "$537,609.00", isGreen: true },
      { title: "Platform Fee Rate", value: "5%" },
      { title: "Total Hotel Bookings", value: "2,173" },
      { title: "Total Cancelled Flights", value: "215" },
    ],
    hotelSpend: [
      { month: "Jan", spend: 12.5 },
      { month: "Feb", spend: 96.0 },
      { month: "Mar", spend: 61.0 },
      { month: "Apr", spend: 59.0 },
      { month: "May", spend: 17.5 },
      { month: "Jun", spend: 64.0 },
      { month: "Jul", spend: 82.0 },
      { month: "Aug", spend: 34.0 },
      { month: "Sep", spend: 39.0 },
      { month: "Oct", spend: 65.0 },
    ],
    passengers: [
      { month: "Jan", passengers: 120 },
      { month: "Feb", passengers: 685 },
      { month: "Mar", passengers: 440 },
      { month: "Apr", passengers: 445 },
      { month: "May", passengers: 168 },
      { month: "Jun", passengers: 485 },
      { month: "Jul", passengers: 705 },
      { month: "Aug", passengers: 235 },
      { month: "Sep", passengers: 370 },
      { month: "Oct", passengers: 510 },
    ],
    cancelledFlights: [
      { month: "Jan", flights: 8 },
      { month: "Feb", flights: 34 },
      { month: "Mar", flights: 20 },
      { month: "Apr", flights: 21 },
      { month: "May", flights: 8 },
      { month: "Jun", flights: 24 },
      { month: "Jul", flights: 34 },
      { month: "Aug", flights: 10 },
      { month: "Sep", flights: 25 },
      { month: "Oct", flights: 31 },
    ],
  },
  "This Year": {
    kpiCards: [
      { title: "Total Hotel Booking Cost", value: "$2,148,800.00", isGreen: true },
      { title: "Platform Fee Rate", value: "5%" },
      { title: "Total Hotel Bookings", value: "8,690" },
      { title: "Total Cancelled Flights", value: "860" },
    ],
    hotelSpend: [
      { month: "Jan", spend: 15.0 },
      { month: "Feb", spend: 98.0 },
      { month: "Mar", spend: 65.0 },
      { month: "Apr", spend: 62.0 },
      { month: "May", spend: 22.0 },
      { month: "Jun", spend: 70.0 },
      { month: "Jul", spend: 88.0 },
      { month: "Aug", spend: 38.0 },
      { month: "Sep", spend: 45.0 },
      { month: "Oct", spend: 72.0 },
    ],
    passengers: [
      { month: "Jan", passengers: 150 },
      { month: "Feb", passengers: 720 },
      { month: "Mar", passengers: 480 },
      { month: "Apr", passengers: 490 },
      { month: "May", passengers: 200 },
      { month: "Jun", passengers: 530 },
      { month: "Jul", passengers: 750 },
      { month: "Aug", passengers: 280 },
      { month: "Sep", passengers: 420 },
      { month: "Oct", passengers: 560 },
    ],
    cancelledFlights: [
      { month: "Jan", flights: 10 },
      { month: "Feb", flights: 36 },
      { month: "Mar", flights: 24 },
      { month: "Apr", flights: 25 },
      { month: "May", flights: 10 },
      { month: "Jun", flights: 28 },
      { month: "Jul", flights: 36 },
      { month: "Aug", flights: 12 },
      { month: "Sep", flights: 29 },
      { month: "Oct", flights: 35 },
    ],
  },
  "All": {
    kpiCards: [
      { title: "Total Hotel Booking Cost", value: "$5,420,000.00", isGreen: true },
      { title: "Platform Fee Rate", value: "5%" },
      { title: "Total Hotel Bookings", value: "21,800" },
      { title: "Total Cancelled Flights", value: "2,150" },
    ],
    hotelSpend: [
      { month: "Jan", spend: 14.0 },
      { month: "Feb", spend: 95.0 },
      { month: "Mar", spend: 62.0 },
      { month: "Apr", spend: 60.0 },
      { month: "May", spend: 20.0 },
      { month: "Jun", spend: 68.0 },
      { month: "Jul", spend: 85.0 },
      { month: "Aug", spend: 36.0 },
      { month: "Sep", spend: 42.0 },
      { month: "Oct", spend: 68.0 },
    ],
    passengers: [
      { month: "Jan", passengers: 135 },
      { month: "Feb", passengers: 700 },
      { month: "Mar", passengers: 460 },
      { month: "Apr", passengers: 470 },
      { month: "May", passengers: 185 },
      { month: "Jun", passengers: 510 },
      { month: "Jul", passengers: 730 },
      { month: "Aug", passengers: 260 },
      { month: "Sep", passengers: 400 },
      { month: "Oct", passengers: 535 },
    ],
    cancelledFlights: [
      { month: "Jan", flights: 9 },
      { month: "Feb", flights: 35 },
      { month: "Mar", flights: 22 },
      { month: "Apr", flights: 23 },
      { month: "May", flights: 9 },
      { month: "Jun", flights: 26 },
      { month: "Jul", flights: 35 },
      { month: "Aug", flights: 11 },
      { month: "Sep", flights: 27 },
      { month: "Oct", flights: 33 },
    ],
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
  const [mounted, setMounted] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("This Month");

  useEffect(() => {
    setMounted(true);
  }, []);

  const activeData = useMemo(() => {
    return PERIOD_DATA[selectedPeriod] || PERIOD_DATA["This Month"];
  }, [selectedPeriod]);

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      <div className="space-y-4.5">
        {/* Header Title Section matching Admin Portal */}
        <div>
          <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%]">
            Dashboard
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            Overview of your airline operations
          </p>
        </div>

        {/* Date / Metrics Filter Section matching Admin Portal */}
        <div className="self-stretch flex justify-end items-center bg-transparent">
          <Dropdown
            value={selectedPeriod}
            onChange={(val) => setSelectedPeriod(val)}
            options={FILTER_OPTIONS}
            widthClass="w-45"
            triggerWidthClass="w-45"
            heightClass="h-12"
          />
        </div>

        {/* 4 KPI Cards Grid matching requested screenshot */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {activeData.kpiCards.map((card, index) => (
            <div
              key={index}
              className="w-full px-5 py-4 bg-white rounded-xl border border-gray-200 flex flex-col justify-start items-start hover:shadow-sm transition-shadow"
            >
              <span className="text-gray-500 text-[14px] sm:text-[15px] font-normal font-figtree">
                {card.title}
              </span>
              <span
                className={cn(
                  "text-[24px] sm:text-[26px] font-bold font-figtree mt-2",
                  card.isGreen ? "text-[#278D68]" : "text-gray-900"
                )}
              >
                {card.value}
              </span>
            </div>
          ))}
        </div>

        {/* Hotel Spend Trend Full Width Chart Card */}
        <div className="self-stretch px-6 py-5 bg-white rounded-xl border border-gray-200 flex flex-col justify-start items-start gap-4">
          <div>
            <div className="text-gray-800 text-lg font-semibold font-figtree">
              Hotel Spend Trend
            </div>
            <div className="text-sm text-gray-500 font-figtree mt-0.5">
              Hotel allocation spending · {selectedPeriod} (Monthly)
            </div>
          </div>
          <div className="w-full h-[260px]">
            {mounted && (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={activeData.hotelSpend}
                  margin={{ top: 15, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="hotelSpendGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#CBD5E1" stopOpacity={0.65} />
                      <stop offset="100%" stopColor="#CBD5E1" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="4 4"
                    stroke="#E5E7EB"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="month"
                    stroke="#9CA3AF"
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={12}
                  />
                  <YAxis
                    stroke="#9CA3AF"
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                    domain={[0, 100]}
                    ticks={[0, 25, 50, 75, 100]}
                    tickFormatter={(val: number) => `$${val.toFixed(1)}k`}
                    width={52}
                  />
                  <Tooltip
                    cursor={{ stroke: "#0F2757", strokeWidth: 1, strokeDasharray: "3 3" }}
                    contentStyle={{
                      backgroundColor: "#FFFFFF",
                      border: "1px solid #E5E7EB",
                      borderRadius: "8px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                    }}
                    formatter={(value: any) => [`$${Number(value).toFixed(1)}k`, "Spend"]}
                  />
                  <Area
                    type="monotone"
                    dataKey="spend"
                    stroke="#1B2B6B"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#hotelSpendGradient)"
                    dot={false}
                    activeDot={{ r: 5, fill: "#1B2B6B", stroke: "#FFFFFF", strokeWidth: 2 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Bottom Trends: Affected Passengers Trend & Cancelled Flights Trend (2-Column Grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-1">
          {/* Affected Passengers Trend Card */}
          <div className="self-stretch px-6 py-5 bg-white rounded-xl border border-gray-200 flex flex-col justify-start items-start gap-4">
            <div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                Affected Passengers Trend
              </div>
              <div className="text-sm text-gray-500 font-figtree mt-0.5">
                Passengers affected · Monthly
              </div>
            </div>
            <div className="w-full h-[280px]">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={activeData.passengers}
                    margin={{ top: 15, right: 10, left: -15, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="#E5E7EB"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      stroke="#9CA3AF"
                      fontSize={12}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={12}
                    />
                    <YAxis
                      stroke="#9CA3AF"
                      fontSize={12}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, 800]}
                      ticks={[0, 200, 400, 600, 800]}
                      width={42}
                    />
                    <Tooltip
                      cursor={{ stroke: "#0F2757", strokeWidth: 1, strokeDasharray: "3 3" }}
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E5E7EB",
                        borderRadius: "8px",
                        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                      }}
                      formatter={(value: any) => [value, "Affected Passengers"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="passengers"
                      stroke="#1E2B4C"
                      strokeWidth={2}
                      dot={{ fill: "#1E2B4C", r: 3.5, stroke: "#1E2B4C", strokeWidth: 1 }}
                      activeDot={{ r: 5, fill: "#1E2B4C", stroke: "#FFFFFF", strokeWidth: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Cancelled Flights Trend Card */}
          <div className="self-stretch px-6 py-5 bg-white rounded-xl border border-gray-200 flex flex-col justify-start items-start gap-4">
            <div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                Cancelled Flights Trend
              </div>
              <div className="text-sm text-gray-500 font-figtree mt-0.5">
                Cancelled flights handled · Monthly
              </div>
            </div>
            <div className="w-full h-[280px]">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={activeData.cancelledFlights}
                    barSize={18}
                    margin={{ top: 15, right: 10, left: -22, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="#E5E7EB"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="month"
                      stroke="#9CA3AF"
                      fontSize={12}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={12}
                    />
                    <YAxis
                      stroke="#9CA3AF"
                      fontSize={12}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, 36]}
                      ticks={[0, 9, 18, 27, 36]}
                      width={38}
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
                      dataKey="flights"
                      fill="#203663"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
