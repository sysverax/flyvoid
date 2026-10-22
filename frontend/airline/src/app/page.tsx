"use client";

import { useState, useEffect, useMemo } from "react";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { cn } from "@/src/lib/utils";
import {
  dashboardService,
  HotelSpendTrendData,
  AffectedPassengersTrendData,
  CancelledFlightsTrendData,
  CancelledFlightsSummaryData,
  TrendTimeFrame,
} from "@/src/services/dashboard.service";
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

const FILTER_OPTIONS = [
  { value: "Today", label: "Today" },
  { value: "Yesterday", label: "Yesterday" },
  { value: "This Week", label: "This Week" },
  { value: "This Month", label: "This Month" },
  { value: "This Year", label: "This Year" },
];

const TIME_FRAME_MAP: Record<string, TrendTimeFrame> = {
  Today: "today",
  Yesterday: "yesterday",
  "This Week": "week",
  "This Month": "month",
  "This Year": "year",
  today: "today",
  yesterday: "yesterday",
  week: "week",
  month: "month",
  year: "year",
};

const formatGranularity = (granularity?: string) => {
  switch (granularity) {
    case "hour":
      return "(Hourly)";
    case "day":
      return "(Daily)";
    case "month":
      return "(Monthly)";
    case "year":
      return "(Yearly)";
    default:
      return "(Monthly)";
  }
};

const formatXAxisTick = (label: string) => {
  if (!label) return "";
  if (label.length > 3 && isNaN(Number(label)) && !label.includes(":")) {
    return label.slice(0, 3);
  }
  return label;
};

const formatSpendYAxis = (val: number) => {
  if (val >= 1_000_000) {
    return `$${(val / 1_000_000).toFixed(val % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  if (val >= 1_000) {
    return `$${(val / 1_000).toFixed(val % 1_000 === 0 ? 0 : 1)}k`;
  }
  return `$${val}`;
};

function ChartLoadingState({ height = "h-[260px]" }: { height?: string }) {
  return (
    <div
      className={`w-full ${height} flex flex-col items-center justify-center gap-2 text-gray-500 font-figtree`}
    >
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
      <span>Loading chart data...</span>
    </div>
  );
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("This Month");
  const [hotelSpendData, setHotelSpendData] = useState<HotelSpendTrendData | null>(null);
  const [affectedPassengersData, setAffectedPassengersData] = useState<AffectedPassengersTrendData | null>(null);
  const [cancelledFlightsData, setCancelledFlightsData] = useState<CancelledFlightsTrendData | null>(null);
  const [summaryData, setSummaryData] = useState<CancelledFlightsSummaryData | null>(null);

  const [isLoadingSpend, setIsLoadingSpend] = useState<boolean>(true);
  const [isLoadingPassengers, setIsLoadingPassengers] = useState<boolean>(true);
  const [isLoadingCancelledFlights, setIsLoadingCancelledFlights] = useState<boolean>(true);
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    setIsLoadingSpend(true);
    setIsLoadingPassengers(true);
    setIsLoadingCancelledFlights(true);
    setIsLoadingSummary(true);

    const timeFrame = TIME_FRAME_MAP[selectedPeriod] || "month";

    dashboardService
      .getHotelSpendTrend(timeFrame)
      .then((data) => {
        if (!isCancelled) setHotelSpendData(data);
      })
      .catch((err) => {
        console.error("Failed to load hotel spend trend:", err);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingSpend(false);
      });

    dashboardService
      .getAffectedPassengersTrend(timeFrame)
      .then((data) => {
        if (!isCancelled) setAffectedPassengersData(data);
      })
      .catch((err) => {
        console.error("Failed to load affected passengers trend:", err);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingPassengers(false);
      });

    dashboardService
      .getCancelledFlightsTrend(timeFrame)
      .then((data) => {
        if (!isCancelled) setCancelledFlightsData(data);
      })
      .catch((err) => {
        console.error("Failed to load cancelled flights trend:", err);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingCancelledFlights(false);
      });

    dashboardService
      .getCancelledFlightsSummary({ timeFrame })
      .then((data) => {
        if (!isCancelled) setSummaryData(data);
      })
      .catch((err) => {
        console.error("Failed to load cancelled flights summary:", err);
      })
      .finally(() => {
        if (!isCancelled) setIsLoadingSummary(false);
      });

    return () => {
      isCancelled = true;
    };
  }, [selectedPeriod]);

  const kpiCards = useMemo<KpiCard[]>(() => {
    return [
      {
        title: "Total Hotel Booking Cost",
        value: summaryData
          ? `$${Number(summaryData.totalCost || 0).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : "$0.00",
        isGreen: true,
      },
      {
        title: "Platform Fee Rate",
        value:
          summaryData?.platformFeePercentage != null
            ? `${summaryData.platformFeePercentage}%`
            : "0%",
      },
      {
        title: "Total Hotel Bookings",
        value: summaryData
          ? (summaryData.totalBookings || 0).toLocaleString("en-US")
          : "0",
      },
      {
        title: "Total Cancelled Flights",
        value: summaryData
          ? (summaryData.totalCancelFlights || 0).toLocaleString("en-US")
          : "0",
      },
    ];
  }, [summaryData]);

  const chartHotelSpend = useMemo(() => {
    if (hotelSpendData?.points && hotelSpendData.points.length > 0) {
      return hotelSpendData.points.map((pt) => ({
        bucket: pt.bucket,
        label: pt.label,
        month: pt.label,
        spend: Number(pt.spend) || 0,
      }));
    }
    return [];
  }, [hotelSpendData]);

  const chartPassengers = useMemo(() => {
    if (
      affectedPassengersData?.points &&
      affectedPassengersData.points.length > 0
    ) {
      return affectedPassengersData.points.map((pt) => ({
        bucket: pt.bucket,
        label: pt.label,
        month: pt.label,
        passengers: Number(pt.passengers) || 0,
      }));
    }
    return [];
  }, [affectedPassengersData]);

  const yAxisConfig = useMemo(() => {
    const maxVal = Math.max(
      ...(chartHotelSpend.map((d) => d.spend) || [0]),
      0
    );

    if (maxVal === 0) {
      return {
        domain: [0, 100] as [number, number],
        ticks: [0, 25, 50, 75, 100],
      };
    }

    const rawStep = maxVal / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
    const normalized = rawStep / (magnitude || 1);

    let niceStepNormalized = 1;
    if (normalized > 5) niceStepNormalized = 10;
    else if (normalized > 2) niceStepNormalized = 5;
    else if (normalized > 1) niceStepNormalized = 2;

    const niceStep = niceStepNormalized * magnitude;
    const niceMax = niceStep * 4;
    const finalMax = niceMax >= maxVal ? niceMax : niceStep * 5;
    const stepCount = Math.round(finalMax / niceStep);

    const ticks: number[] = [];
    for (let i = 0; i <= stepCount; i++) {
      ticks.push(i * niceStep);
    }

    return {
      domain: [0, finalMax] as [number, number],
      ticks,
    };
  }, [chartHotelSpend]);

  const passengersYAxisConfig = useMemo(() => {
    const maxVal = Math.max(
      ...(chartPassengers.map((d) => d.passengers) || [0]),
      0
    );

    if (maxVal === 0) {
      return {
        domain: [0, 100] as [number, number],
        ticks: [0, 25, 50, 75, 100],
      };
    }

    const rawStep = maxVal / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
    const normalized = rawStep / (magnitude || 1);

    let niceStepNormalized = 1;
    if (normalized > 5) niceStepNormalized = 10;
    else if (normalized > 2) niceStepNormalized = 5;
    else if (normalized > 1) niceStepNormalized = 2;

    const niceStep = Math.max(1, Math.round(niceStepNormalized * magnitude));
    const niceMax = niceStep * 4;
    const finalMax = niceMax >= maxVal ? niceMax : niceStep * 5;
    const stepCount = Math.round(finalMax / niceStep);

    const ticks: number[] = [];
    for (let i = 0; i <= stepCount; i++) {
      ticks.push(i * niceStep);
    }

    return {
      domain: [0, finalMax] as [number, number],
      ticks,
    };
  }, [chartPassengers]);

  const chartCancelledFlights = useMemo(() => {
    if (
      cancelledFlightsData?.points &&
      cancelledFlightsData.points.length > 0
    ) {
      return cancelledFlightsData.points.map((pt) => ({
        bucket: pt.bucket,
        label: pt.label,
        month: pt.label,
        flights: Number(pt.flights) || 0,
      }));
    }
    return [];
  }, [cancelledFlightsData]);

  const cancelledFlightsYAxisConfig = useMemo(() => {
    const maxVal = Math.max(
      ...(chartCancelledFlights.map((d) => d.flights) || [0]),
      0
    );

    if (maxVal === 0) {
      return {
        domain: [0, 4] as [number, number],
        ticks: [0, 1, 2, 3, 4],
      };
    }

    const rawStep = maxVal / 4;
    const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep || 1)));
    const normalized = rawStep / (magnitude || 1);

    let niceStepNormalized = 1;
    if (normalized > 5) niceStepNormalized = 10;
    else if (normalized > 2) niceStepNormalized = 5;
    else if (normalized > 1) niceStepNormalized = 2;

    const niceStep = Math.max(1, Math.round(niceStepNormalized * magnitude));
    const niceMax = niceStep * 4;
    const finalMax = niceMax >= maxVal ? niceMax : niceStep * 5;
    const stepCount = Math.round(finalMax / niceStep);

    const ticks: number[] = [];
    for (let i = 0; i <= stepCount; i++) {
      ticks.push(i * niceStep);
    }

    return {
      domain: [0, finalMax] as [number, number],
      ticks,
    };
  }, [chartCancelledFlights]);

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
          {kpiCards.map((card, index) => (
            <div
              key={index}
              className="w-full px-5 py-4 bg-white rounded-xl border border-gray-200 flex flex-col justify-start items-start hover:shadow-sm transition-shadow"
            >
              <span className="text-gray-500 text-[14px] sm:text-[15px] font-normal font-figtree">
                {card.title}
              </span>
              {isLoadingSummary ? (
                <div className="h-7 w-28 bg-gray-100 rounded animate-pulse mt-2" />
              ) : (
                <span
                  className={cn(
                    "text-[24px] sm:text-[26px] font-bold font-figtree mt-2",
                    card.isGreen ? "text-[#278D68]" : "text-gray-900"
                  )}
                >
                  {card.value}
                </span>
              )}
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
              Hotel allocation spending · {selectedPeriod} {hotelSpendData?.granularity ? formatGranularity(hotelSpendData.granularity) : "(Monthly)"}
            </div>
          </div>
          <div className="w-full h-[260px]">
            {isLoadingSpend ? (
              <ChartLoadingState height="h-[260px]" />
            ) : mounted ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartHotelSpend}
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
                    dataKey="label"
                    stroke="#9CA3AF"
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                    tickMargin={12}
                    tickFormatter={formatXAxisTick}
                  />
                  <YAxis
                    stroke="#9CA3AF"
                    fontSize={12}
                    axisLine={false}
                    tickLine={false}
                    domain={yAxisConfig.domain}
                    ticks={yAxisConfig.ticks}
                    tickFormatter={formatSpendYAxis}
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
                    formatter={(value: any) => [
                      `$${Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                      "Spend",
                    ]}
                    labelFormatter={(label: any) => label}
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
            ) : null}
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
                Passengers affected · {affectedPassengersData?.granularity ? formatGranularity(affectedPassengersData.granularity).replace(/[()]/g, "") : "Monthly"}
              </div>
            </div>
            <div className="w-full h-[280px]">
              {isLoadingPassengers ? (
                <ChartLoadingState height="h-[280px]" />
              ) : mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={chartPassengers}
                    margin={{ top: 15, right: 10, left: -15, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="#E5E7EB"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      stroke="#9CA3AF"
                      fontSize={12}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={12}
                      tickFormatter={formatXAxisTick}
                    />
                    <YAxis
                      stroke="#9CA3AF"
                      fontSize={12}
                      axisLine={false}
                      tickLine={false}
                      domain={passengersYAxisConfig.domain}
                      ticks={passengersYAxisConfig.ticks}
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
                      formatter={(value: any) => [
                        Number(value).toLocaleString("en-US"),
                        "Affected Passengers",
                      ]}
                      labelFormatter={(label: any) => label}
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
              ) : null}
            </div>
          </div>

          {/* Cancelled Flights Trend Card */}
          <div className="self-stretch px-6 py-5 bg-white rounded-xl border border-gray-200 flex flex-col justify-start items-start gap-4">
            <div>
              <div className="text-gray-800 text-lg font-semibold font-figtree">
                Cancelled Flights Trend
              </div>
              <div className="text-sm text-gray-500 font-figtree mt-0.5">
                Cancelled flights handled · {cancelledFlightsData?.granularity ? formatGranularity(cancelledFlightsData.granularity).replace(/[()]/g, "") : "Monthly"}
              </div>
            </div>
            <div className="w-full h-[280px]">
              {isLoadingCancelledFlights ? (
                <ChartLoadingState height="h-[280px]" />
              ) : mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartCancelledFlights}
                    barSize={18}
                    margin={{ top: 15, right: 10, left: -22, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke="#E5E7EB"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      stroke="#9CA3AF"
                      fontSize={12}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={12}
                      tickFormatter={formatXAxisTick}
                    />
                    <YAxis
                      stroke="#9CA3AF"
                      fontSize={12}
                      axisLine={false}
                      tickLine={false}
                      domain={cancelledFlightsYAxisConfig.domain}
                      ticks={cancelledFlightsYAxisConfig.ticks}
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
                      formatter={(value: any) => [
                        Number(value).toLocaleString("en-US"),
                        "Cancelled Flights",
                      ]}
                      labelFormatter={(label: any) => label}
                    />
                    <Bar
                      dataKey="flights"
                      fill="#203663"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
