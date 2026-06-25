"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Eye,
  AlertTriangle,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  SortHeader,
} from "../../components/ui/table";
import { Pagination } from "@/src/components/ui/pagination";
import { cn, sortData } from "@/src/lib/utils";
import { Airline } from "@/src/types/airlines";
import { TableEmptyState } from "@/src/components/ui/EmptyState";
import { FiltersCard } from "@/src/components/ui/FiltersCard";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { EditAirlineModal } from "@/src/components/airlines/EditAirlineModal";
import { SuspendAirlineDialog } from "@/src/components/airlines/SuspendAirlineDialog";
import { AirlineDetailsView } from "@/src/components/airlines/AirlineDetailsView";
import { useAuth } from "@/src/hooks/useAuth";

const INITIAL_AIRLINES: Airline[] = [
  {
    id: "1",
    airlineName: "Pacific Airways",
    airlineCode: "PA",
    country: "United States",
    companyReg: "REG-PAC-1001",
    website: "https://www.pacific.example.com",
    contactEmail: "ops.north@pacific.com",
    contactPhone: "+1 555 020 0001",
    timezone: "PST",
    currency: "USD",
    address: "100 Airport Rd, Seattle, WA",
    onboardingDate: "10/05/2023",
    status: "Active",
    flightsCount: 12,
    passengersCount: 1847,
    spend: 245000,
    revenue: 19600,
    stripeConnection: "Connected",
    adminFirstName: "John",
    adminLastName: "Doe",
    adminEmail: "john@pacific.com",
    adminJobTitle: "Ops Director",
    creditLimit: 250000,
    totalCancelledFlights: 12,
    totalPassengersMetric: 1847,
    avgCostPerPassenger: 132,
    totalSpendMetric: 245000,
    platformFeesMetric: 12250,
    allowanceBalanceMetric: 150000,
    failedPaymentsCount: 0,
    allocationFailuresCount: 1,
  },
  {
    id: "2",
    airlineName: "SkyLine Airways",
    airlineCode: "SKY",
    country: "United States",
    companyReg: "REG-SKY-1001",
    website: "https://www.sky.example.com",
    contactEmail: "ops@skyline.com",
    contactPhone: "+1 555 010 0000",
    timezone: "UTC",
    currency: "USD",
    address: "1 Aviation Way, Terminal 1",
    onboardingDate: "15/01/2024",
    status: "Active",
    flightsCount: 12,
    passengersCount: 1847,
    spend: 245000,
    revenue: 19600,
    stripeConnection: "Connected",
    adminFirstName: "Operations",
    adminLastName: "Admin",
    adminEmail: "ops@skyline.com",
    adminJobTitle: "Operations Manager",
    creditLimit: 100000,
    totalCancelledFlights: 12,
    totalPassengersMetric: 1847,
    avgCostPerPassenger: 132,
    totalSpendMetric: 245000,
    platformFeesMetric: 12250,
    allowanceBalanceMetric: 150000,
    failedPaymentsCount: 0,
    allocationFailuresCount: 0,
  },
  {
    id: "3",
    airlineName: "SkyLine Airways",
    airlineCode: "SKY",
    country: "United States",
    companyReg: "REG-PAC-1003",
    website: "https://www.pacific.example.com",
    contactEmail: "ops.east@pacific.com",
    contactPhone: "+1 555 020 0003",
    timezone: "EST",
    currency: "USD",
    address: "300 Airport Rd, New York, NY",
    onboardingDate: "15/07/2023",
    status: "Suspended",
    flightsCount: 12,
    passengersCount: 1847,
    spend: 245000,
    revenue: 19600,
    stripeConnection: "Pending",
    adminFirstName: "Bob",
    adminLastName: "Johnson",
    adminEmail: "bob@pacific.com",
    adminJobTitle: "East Coordinator",
    creditLimit: 150000,
    totalCancelledFlights: 24,
    totalPassengersMetric: 2350,
    avgCostPerPassenger: 145,
    totalSpendMetric: 340000,
    platformFeesMetric: 17000,
    allowanceBalanceMetric: 80000,
    failedPaymentsCount: 1,
    allocationFailuresCount: 3,
  },
  {
    id: "4",
    airlineName: "SkyLine Airways",
    airlineCode: "PA",
    country: "United States",
    companyReg: "REG-PAC-1004",
    website: "https://www.pacific.example.com",
    contactEmail: "ops.west@pacific.com",
    contactPhone: "+1 555 020 0004",
    timezone: "PST",
    currency: "USD",
    address: "400 Airport Rd, Los Angeles, CA",
    onboardingDate: "20/08/2023",
    status: "Disabled",
    flightsCount: 12,
    passengersCount: 1847,
    spend: 245000,
    revenue: 19600,
    stripeConnection: "Failed",
    adminFirstName: "Alice",
    adminLastName: "Williams",
    adminEmail: "alice@pacific.com",
    adminJobTitle: "West Lead",
    creditLimit: 100000,
    totalCancelledFlights: 50,
    totalPassengersMetric: 4500,
    avgCostPerPassenger: 150,
    totalSpendMetric: 675000,
    platformFeesMetric: 33750,
    allowanceBalanceMetric: 20000,
    failedPaymentsCount: 3,
    allocationFailuresCount: 8,
  },
];
export default function AirlinesPage() {
  const [airlines, setAirlines] = useState<Airline[]>(INITIAL_AIRLINES);
  const { hasPermission } = useAuth();

  // Navigation State
  const [selectedAirlineId, setSelectedAirlineId] = useState<string | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [selectedCountry, setSelectedCountry] = useState("All Countries");

  // Pagination States
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Sorting States
  const [sortField, setSortField] = useState<keyof Airline | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Modals & Confirmation States
  const [editTarget, setEditTarget] = useState<Airline | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Airline | null>(null);

  // Form states for Edit modal removed (handled internally by EditAirlineModal component)

  const statusOptions = [
    { value: "All Status", label: "All Status" },
    { value: "Active", label: "Active" },
    { value: "Inactive", label: "Inactive" },
    { value: "Suspended", label: "Suspended" },
  ];

  const countryOptions = [
    { value: "All Countries", label: "All Countries" },
    { value: "United States", label: "United States" },
    { value: "United Kingdom", label: "United Kingdom" },
    { value: "Germany", label: "Germany" },
    { value: "France", label: "France" },
    { value: "India", label: "India" },
    { value: "Canada", label: "Canada" },
    { value: "Australia", label: "Australia" },
  ];

  // Current selected airline object
  const selectedAirline = useMemo(() => {
    return airlines.find((a) => a.id === selectedAirlineId) || null;
  }, [airlines, selectedAirlineId]);

  // Filtration logic
  const filteredAirlines = useMemo(() => {
    return airlines.filter((airline) => {
      const matchesSearch =
        airline.airlineName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        airline.airlineCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        airline.contactEmail.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        selectedStatus === "All Status" ||
        airline.status === selectedStatus ||
        (selectedStatus === "Inactive" && airline.status === "Disabled");

      const matchesCountry =
        selectedCountry === "All Countries" || airline.country === selectedCountry;

      return matchesSearch && matchesStatus && matchesCountry;
    });
  }, [airlines, searchQuery, selectedStatus, selectedCountry]);

  // Sort Data
  const sortedAirlines = useMemo(() => {
    return sortData(filteredAirlines, sortField, sortOrder, []);
  }, [filteredAirlines, sortField, sortOrder]);

  // Paginated Data
  const totalPages = Math.max(
    1,
    Math.ceil(sortedAirlines.length / resultsPerPage)
  );

  const paginatedAirlines = useMemo(() => {
    const startIndex = (currentPage - 1) * resultsPerPage;
    return sortedAirlines.slice(startIndex, startIndex + resultsPerPage);
  }, [sortedAirlines, currentPage, resultsPerPage]);

  const handleClearAll = () => {
    setSearchQuery("");
    setSelectedStatus("All Status");
    setSelectedCountry("All Countries");
    setSortField(null);
    setSortOrder("asc");
    setCurrentPage(1);
  };

  const handleSort = (field: keyof Airline) => {
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

  // Toggle active/disable status from the toggle switch in the table
  const handleToggleStatus = (airline: Airline) => {
    setAirlines((prev) =>
      prev.map((item) => {
        if (item.id === airline.id) {
          const newStatus = item.status === "Disabled" ? "Active" : "Disabled";
          return { ...item, status: newStatus };
        }
        return item;
      })
    );
  };

  // Trigger suspend flow
  const handleOpenSuspendConfirm = (airline: Airline) => {
    setSuspendTarget(airline);
  };

  const handleConfirmSuspend = () => {
    if (!suspendTarget) return;
    setAirlines((prev) =>
      prev.map((item) => {
        if (item.id === suspendTarget.id) {
          return { ...item, status: "Suspended" };
        }
        return item;
      })
    );
    setSuspendTarget(null);
  };

  // Trigger edit modal
  const handleOpenEditModal = (airline: Airline) => {
    setEditTarget(airline);
  };

  const handleSaveEdit = (updatedFields: Partial<Airline>) => {
    if (!editTarget) return;

    setAirlines((prev) =>
      prev.map((item) => {
        if (item.id === editTarget.id) {
          return {
            ...item,
            ...updatedFields,
          };
        }
        return item;
      })
    );
    setEditTarget(null);
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      {selectedAirline ? (
        <AirlineDetailsView
          airline={selectedAirline}
          onBack={() => setSelectedAirlineId(null)}
          onEditClick={() => handleOpenEditModal(selectedAirline)}
        />
      ) : (
        <div className="space-y-7">
          {/* Header */}
          <div>
            <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%]">
              Airlines Management
            </h1>
            <p className="text-[14px] text-[#6B7280] mt-1">
              Manage all registered airlines
            </p>
          </div>

          {/* Filters card */}
          <FiltersCard
            searchQuery={searchQuery}
            setSearchQuery={(q) => {
              setSearchQuery(q);
              setCurrentPage(1);
            }}
            searchPlaceholder="Search airlines..."
            onClearFilters={handleClearAll}
          >
            {/* Status Selector */}
            <Dropdown
              value={selectedStatus}
              onChange={(val) => {
                setSelectedStatus(val);
                setCurrentPage(1);
              }}
              options={statusOptions}
              widthClass="w-44"
              triggerWidthClass="w-[180px]"
            />

            {/* Country Selector */}
            <Dropdown
              value={selectedCountry}
              onChange={(val) => {
                setSelectedCountry(val);
                setCurrentPage(1);
              }}
              options={countryOptions}
              widthClass="w-44"
              triggerWidthClass="w-[180px]"
            />
          </FiltersCard>

          {/* Airlines Table */}
          <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white mb-6">
            <Table>
              <TableHeader className="pt-1">
                <TableRow>
                  <TableHead className="min-w-[130px]">
                    <SortHeader label="Airline" field="airlineName" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="min-w-[68px]">
                    <SortHeader label="Iata" field="airlineCode" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="min-w-[126px]">
                    <SortHeader label="Status" field="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="min-w-[90px]">
                    <SortHeader label="Flights" field="flightsCount" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="min-w-[121px] relative -left-1">
                    <SortHeader label="Passengers" field="passengersCount" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="min-w-[124px] relative -left-1">
                    <SortHeader label="Spend" field="spend" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="min-w-[115px] relative -left-1.5">
                    <SortHeader label="Revenue" field="revenue" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="min-w-[128px] relative left-1">
                    <SortHeader label="Stripe" field="stripeConnection" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  </TableHead>
                  {hasPermission("edit") && (
                    <TableHead className="whitespace-nowrap min-w-[143px] relative left-1">
                      <SortHeader label="Enable/Disable" field="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    </TableHead>
                  )}
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedAirlines.length === 0 ? (
                  <TableEmptyState
                    colSpan={10}
                    icon={Search}
                    title="No airlines found"
                    message="Try adjusting your filters or search query."
                  />
                ) : (
                  paginatedAirlines.map((airline) => (
                    <TableRow key={airline.id}>
                      <TableCell className="font-medium text-[#1F2937]">
                        {airline.airlineName}
                      </TableCell>
                      <TableCell>
                        <span className="rounded-[4px] bg-[#E5E7EB] text-[#1F2937] font-inter text-[12px] px-2.5 py-1.5 font-medium h-[28px]">
                          {airline.airlineCode}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={airline.status} />
                      </TableCell>
                      <TableCell className="text-[#6B7280]">
                        {airline.flightsCount}
                      </TableCell>
                      <TableCell className="text-[#1F2937]">
                        {airline.passengersCount.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-[#6B7280] relative -left-1">
                        ${airline.spend.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-[#6B7280] relative -left-1">
                        ${airline.revenue.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium relative left-1.5",
                            airline.stripeConnection === "Connected" && "bg-green-100 text-green-800",
                            airline.stripeConnection === "Pending" && "bg-yellow-100 text-yellow-800",
                            airline.stripeConnection === "Failed" && "bg-red-100 text-red-800"
                          )}
                        >
                          {airline.stripeConnection}
                        </span>
                      </TableCell>
                      {hasPermission("edit") && (
                        <TableCell>
                          {/* Enable/Disable Toggle Switch */}
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(airline)}
                            className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none relative left-1 bg-emerald-500"
                            style={{
                              backgroundColor: airline.status === "Active" ? "#10B981" : "#E5E7EB"
                            }}
                          >
                            <span
                              className={cn(
                                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                airline.status === "Active" ? "translate-x-5" : "translate-x-0"
                              )}
                            />
                          </button>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center justify-start gap-2.5">
                          <button
                            onClick={() => setSelectedAirlineId(airline.id)}
                            className="p-1 text-[#6B7280] hover:text-primary transition-colors cursor-pointer"
                            title="View Profile"
                          >
                            <Eye className="h-[20px] w-[20px]" />
                          </button>
                          {hasPermission("edit") && (
                            <button
                              onClick={() => handleOpenSuspendConfirm(airline)}
                              className="p-1 text-gray-400 hover:text-rose-600 cursor-pointer transition-colors"
                              title="Suspend Airline"
                            >
                              <img
                                src="/icons/spam.svg"
                                alt="Spam"
                                className="h-[20px] w-[20px]"
                              />
                            </button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination
            totalResults={filteredAirlines.length}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            resultsPerPage={resultsPerPage}
            setResultsPerPage={setResultsPerPage}
            totalPages={totalPages}
          />
        </div>
      )}

      <EditAirlineModal
        isOpen={!!editTarget}
        airline={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleSaveEdit}
      />

      <SuspendAirlineDialog
        isOpen={!!suspendTarget}
        airline={suspendTarget}
        onClose={() => setSuspendTarget(null)}
        onConfirm={handleConfirmSuspend}
      />
    </div>
  );
}
