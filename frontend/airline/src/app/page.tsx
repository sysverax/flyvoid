"use client";

import { useState, useEffect, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  DollarSign,
  CreditCard,
  Percent,
  HandCoins,
  Plane,
  TrendingUp,
  Wallet,
  ArrowRight,
} from "lucide-react";
import { toast } from "react-toastify";
import { Header } from "@/src/components/layout/Header";
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
import {
  ResponsiveContainer,
  LineChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Line,
} from "recharts";

interface KpiCardData {
  title: string;
  value: string;
  subtext: string;
  icon: React.ComponentType<{ className?: string }> | string;
}

const DASHBOARD_CARDS: KpiCardData[] = [
  {
    title: "Outstanding Balance",
    value: "$6,287",
    subtext: "Platform fees payable",
    icon: DollarSign,
  },
  {
    title: "Remaining Credit",
    value: "$18,713",
    subtext: "of $25,000 limit",
    icon: CreditCard,
  },
  {
    title: "Platform Fee Rate",
    value: "5%",
    subtext: "Of each hotel booking",
    icon: Percent,
  },
  {
    title: "Platform Fees (Last 30 Days)",
    value: "$4,112",
    subtext: "Fees charged to your balance",
    icon: DollarSign,
  },
  {
    title: "Payments Made (Last 30 Days)",
    value: "$3,500",
    subtext: "Paid against your balance",
    icon: HandCoins,
  },
  {
    title: "Booking Count",
    value: "1,847",
    subtext: "Total hotel bookings",
    icon: Plane,
  },
];

interface RecentCancellation {
  id: string;
  flight: string;
  route: string;
  date: string;
  bookings: number;
  passengers: number;
  cost: string;
  status: string;
}

const RECENT_CANCELLATIONS: RecentCancellation[] = [
  {
    id: "1",
    flight: "PA1234",
    route: "LAX → JFK",
    date: "01/02/2025",
    bookings: 42,
    passengers: 189,
    cost: "$245,000",
    status: "Published",
  },
  {
    id: "2",
    flight: "PA5678",
    route: "SFO → ORD",
    date: "12/02/2025",
    bookings: 35,
    passengers: 150,
    cost: "$180,000",
    status: "In Progress",
  },
  {
    id: "3",
    flight: "PA9012",
    route: "ATL → LGA",
    date: "20/02/2025",
    bookings: 28,
    passengers: 120,
    cost: "$130,000",
    status: "Allocated",
  },
  {
    id: "4",
    flight: "PA3456",
    route: "MIA → DFW",
    date: "25/02/2025",
    bookings: 22,
    passengers: 100,
    cost: "$110,000",
    status: "In Progress",
  },
  {
    id: "5",
    flight: "PA7890",
    route: "ORD → SEA",
    date: "28/02/2025",
    bookings: 18,
    passengers: 85,
    cost: "$95,000",
    status: "Published",
  },
];

const SPENDING_DATA = [
  { month: "Jul", val: 38 },
  { month: "Aug", val: 55 },
  { month: "Sep", val: 42 },
  { month: "Oct", val: 78 },
  { month: "Nov", val: 95 },
  { month: "Dec", val: 125 },
  { month: "Jan", val: 108 },
];

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [sortField, setSortField] = useState<keyof RecentCancellation | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Payment state
  const [outstandingBalance, setOutstandingBalance] = useState(6287);
  const [isPaymentDrawerOpen, setIsPaymentDrawerOpen] = useState(false);

  const creditLimit = 25000;
  const remainingCredit = creditLimit - outstandingBalance;
  const utilizationPercent = (outstandingBalance / creditLimit) * 100;

  const dashboardCards = useMemo<KpiCardData[]>(() => [
    {
      title: "Outstanding Balance",
      value: `$${outstandingBalance.toLocaleString()}`,
      subtext: "Platform fees payable",
      icon: DollarSign,
    },
    {
      title: "Remaining Credit",
      value: `$${remainingCredit.toLocaleString()}`,
      subtext: `of $${creditLimit.toLocaleString()} limit`,
      icon: CreditCard,
    },
    {
      title: "Platform Fee Rate",
      value: "5%",
      subtext: "Of each hotel booking",
      icon: Percent,
    },
    {
      title: "Platform Fees (Last 30 Days)",
      value: "$4,112",
      subtext: "Fees charged to your balance",
      icon: DollarSign,
    },
    {
      title: "Payments Made (Last 30 Days)",
      value: "$3,500",
      subtext: "Paid against your balance",
      icon: HandCoins,
    },
    {
      title: "Booking Count",
      value: "1,847",
      subtext: "Total hotel bookings",
      icon: Plane,
    },
  ], [outstandingBalance, remainingCredit]);

  const handlePaymentComplete = (amount: number, method: "card" | "bank", title: string, description: string) => {
    if (method === "card") {
      setOutstandingBalance((prev) => Math.max(0, prev - amount));
    }
    toast.success(title);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSort = (field: keyof RecentCancellation) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const sortedCancellations = useMemo(() => {
    if (!sortField) return RECENT_CANCELLATIONS;
    return [...RECENT_CANCELLATIONS].sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      if (valA == null) return 1;
      if (valB == null) return -1;
      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [sortField, sortOrder]);

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">

      <div className="space-y-4.5">

        {/* Header Title Section */}
        <Header
          title="Dashboard"
          subtitle="Platform health and operational overview"
        />

        {/* 6 KPI Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dashboardCards.map((card, index) => {
            const isImageIcon = typeof card.icon === "string";
            const IconComponent = !isImageIcon
              ? (card.icon as React.ComponentType<{ className?: string }>)
              : null;

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

                    {/* Icon Box matching Admin Portal */}
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
                        IconComponent && (
                          <IconComponent className="h-5.5 w-6 text-blue-950 stroke-[1.8]" />
                        )
                      )}
                    </div>
                  </div>
                </div>

                <div className="self-stretch flex flex-col justify-start items-start gap-2">
                  <div className="justify-start text-gray-500 text-sm font-normal font-figtree leading-[100%] tracking-[0%]">
                    {card.subtext}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-1.5">
          {/* Monthly Hotel Allocation Spending Line Chart Card */}
          <div className="self-stretch pl-6 pr-9 pt-6 pb-3 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-4.5">
            <div className="self-stretch justify-start text-gray-800 text-xl font-semibold font-figtree leading-[150%] tracking-[0%] relative -left-0.5">
              Monthly hotel allocation spending
            </div>
            <div className="w-full h-[256px]">
              {mounted && (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={SPENDING_DATA}
                    margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                    style={{ overflow: "visible" }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
                    <XAxis
                      dataKey="month"
                      stroke="#6B7280"
                      fontSize={12}
                      axisLine={false}
                      tickLine={false}
                      tickMargin={6}
                    />
                    <YAxis
                      stroke="#6B7280"
                      fontSize={12}
                      axisLine={false}
                      tickLine={false}
                      domain={[0, 140]}
                      ticks={[0, 35, 70, 105, 140]}
                      width={52}
                      tickFormatter={(val: number) => `$${val}K`}
                      textAnchor="start"
                      dx={-45}
                    />
                    <Tooltip
                      cursor={false}
                      contentStyle={{
                        backgroundColor: "#FFFFFF",
                        border: "1px solid #E5E7EB",
                        borderRadius: "8px",
                        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                      }}
                      formatter={(value: any) => [`$${value}K`, "Spending"]}
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
              )}
            </div>
          </div>

          {/* Outstanding Platform Balance Card */}
          <div className="self-stretch p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-between items-start gap-6">
            <div className="w-full flex flex-col gap-4">
              {/* Header with Title and Wallet Icon */}
              <div className="w-full flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 font-figtree">
                    Outstanding Platform Balance
                  </h2>
                </div>
                <div className="size-11 p-2.5 bg-gray-100 rounded-lg flex justify-center items-center shrink-0">
                  <Wallet className="h-5.5 w-5.5 text-blue-950 stroke-[1.8]" />
                </div>
              </div>

              {/* Amount and Subtext */}
              <div className="flex flex-col gap-1 mt-1">
                <div className="text-4xl font-bold text-gray-900 font-figtree">
                  ${outstandingBalance.toLocaleString()}
                </div>
                <div className="text-sm text-gray-500 font-figtree">
                  of ${creditLimit.toLocaleString()} credit limit used
                </div>
              </div>

              {/* Progress Bar & Legend */}
              <div className="flex flex-col gap-2.5 mt-2">
                <div className="w-full bg-gray-100 h-2.5 rounded-full overflow-hidden">
                  <div
                    className="bg-[#203764] h-full rounded-full transition-all duration-500"
                    style={{ width: `${utilizationPercent}%` }}
                  />
                </div>
                <div className="flex justify-between items-center text-sm font-figtree">
                  <span className="text-gray-500">{Math.round(utilizationPercent)}% of limit</span>
                  <span className="font-semibold text-gray-900">${remainingCredit.toLocaleString()} remaining</span>
                </div>
              </div>
            </div>

            {/* Pay Now Button */}
            <button
              onClick={() => setIsPaymentDrawerOpen(true)}
              className="w-full bg-[#203764] hover:bg-[#162747] text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center text-base cursor-pointer"
            >
              Pay Now
            </button>
          </div>
        </div>

        {/* Recent Cancellations Table Card */}
        <div className="p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col gap-6 mt-2">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold text-gray-900 font-figtree">
              Recent Cancellations
            </h2>
            <Link
              href="/cancellation"
              className="text-sm font-semibold text-[#0F2757] hover:text-[#162259] transition-colors flex items-center gap-1 group"
            >
              View all
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>

          <div className="w-full overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[110px]">
                    <SortHeader
                      label="FLIGHT"
                      field="flight"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[130px]">
                    <SortHeader
                      label="ROUTE"
                      field="route"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    <SortHeader
                      label="DATE"
                      field="date"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[120px]">
                    <SortHeader
                      label="BOOKINGS"
                      field="bookings"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[130px]">
                    <SortHeader
                      label="PASSENGERS"
                      field="passengers"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[110px]">
                    <SortHeader
                      label="COST"
                      field="cost"
                      sortField={sortField}
                      sortOrder={sortOrder}
                      onSort={handleSort}
                    />
                  </TableHead>
                  <TableHead className="min-w-[120px]">
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
                {sortedCancellations.map((row) => (
                  <TableRow key={row.id} className="h-16 hover:bg-gray-50/50">
                    <TableCell className="text-gray-900">{row.flight}</TableCell>
                    <TableCell className="text-gray-600">{row.route}</TableCell>
                    <TableCell className="text-gray-500 text-sm">{row.date}</TableCell>
                    <TableCell className="text-gray-700">{row.bookings}</TableCell>
                    <TableCell className="text-gray-700">{row.passengers}</TableCell>
                    <TableCell className="text-gray-900">{row.cost}</TableCell>
                    <TableCell>
                      <StatusBadge status={row.status} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

      </div>

      <PaymentDrawer
        isOpen={isPaymentDrawerOpen}
        onClose={() => setIsPaymentDrawerOpen(false)}
        balance={outstandingBalance}
        onPaymentComplete={handlePaymentComplete}
      />
    </div>
  );
}
