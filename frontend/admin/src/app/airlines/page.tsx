"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Search,
  Eye,
  AlertTriangle,
  Loader2,
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
import { toast } from "react-toastify";
import { countries } from "countries-list";
import { airlinesService, UpdateAirlineRequest } from "@/src/services/airlines.service";

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
const getCountryCode = (countryName: string): string => {
  const entry = Object.entries(countries).find(
    ([_, c]) => c.name.toLowerCase() === countryName.toLowerCase()
  );
  return entry ? entry[0] : "US";
};

const formatDate = (dateStr?: string) => {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "N/A";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

function mapAirlineDTOToAirline(dto: any): Airline {
  const countryName = countries[dto.countryCode as keyof typeof countries]?.name || dto.countryCode || "N/A";

  const isSuspendedBool = Boolean(dto.isSuspended);
  const isActiveBool = dto.isActive !== undefined ? Boolean(dto.isActive) : true;

  let status: "Active" | "Suspended" | "Disabled" = "Active";
  if (isSuspendedBool) {
    status = "Suspended";
  } else if (!isActiveBool) {
    status = "Disabled";
  }

  return {
    id: String(dto.id),
    airlineName: dto.name,
    airlineCode: dto.code,
    country: countryName,
    companyReg: dto.companyRegistrationNumber,
    website: dto.website || "",
    contactEmail: dto.contactEmail,
    contactPhone: dto.contactPhone,
    timezone: dto.timezone,
    currency: dto.currency,
    address: dto.address,
    onboardingDate: formatDate(dto.createdAt),
    status,
    flightsCount: 0,
    passengersCount: 0,
    spend: 0,
    revenue: 0,
    stripeConnection: "Pending",
    adminFirstName: dto.adminUser?.firstName || "",
    adminLastName: dto.adminUser?.lastName || "",
    adminEmail: dto.adminUser?.email || "",
    adminJobTitle: dto.adminUser?.jobTitle || "",
    creditLimit: 0,
    totalCancelledFlights: 0,
    totalPassengersMetric: 0,
    avgCostPerPassenger: 0,
    totalSpendMetric: 0,
    platformFeesMetric: 0,
    allowanceBalanceMetric: 0,
    failedPaymentsCount: 0,
    allocationFailuresCount: 0,
    logoUrl: dto.logo,
    isActive: isActiveBool,
    isSuspended: isSuspendedBool,
  };
}

export default function AirlinesPage() {
  const [airlines, setAirlines] = useState<Airline[]>([]);
  const { hasPermission } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isViewingDetail, setIsViewingDetail] = useState<string | null>(null);

  // Navigation State / Detailed View Object
  const [selectedAirlineDetail, setSelectedAirlineDetail] = useState<Airline | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All Status");
  const [selectedCountry, setSelectedCountry] = useState("All Countries");

  // Pagination States
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // Sorting States
  const [sortField, setSortField] = useState<keyof Airline | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Modals & Confirmation States
  const [editTarget, setEditTarget] = useState<Airline | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<Airline | null>(null);
  const [isSuspending, setIsSuspending] = useState(false);
  const [togglingAirlineId, setTogglingAirlineId] = useState<string | null>(null);

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

  const fetchAirlines = async (showLoading = true) => {
    if (showLoading) setIsLoading(true);
    try {
      let isActive: boolean | undefined = undefined;
      let isSuspended: boolean | undefined = undefined;

      if (selectedStatus === "Active") {
        isActive = true;
        isSuspended = false;
      } else if (selectedStatus === "Inactive") {
        isActive = false;
        isSuspended = false;
      } else if (selectedStatus === "Suspended") {
        isSuspended = true;
      }

      const res = await airlinesService.getAirlines({
        search: searchQuery || undefined,
        isActive,
        isSuspended,
        page: currentPage,
        limit: resultsPerPage,
      });

      const mapped = res.airlines.map(mapAirlineDTOToAirline);
      setAirlines(mapped);
      setTotalResults(res.total);
    } catch (err: any) {
      toast.error(err.message || "Failed to load airlines");
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAirlines();
  }, [searchQuery, selectedStatus, currentPage, resultsPerPage]);

  // Filtration logic
  const filteredAirlines = useMemo(() => {
    return airlines.filter((airline) => {
      const matchesCountry =
        selectedCountry === "All Countries" || airline.country === selectedCountry;
      return matchesCountry;
    });
  }, [airlines, selectedCountry]);

  // Sort Data
  const sortedAirlines = useMemo(() => {
    return sortData(filteredAirlines, sortField, sortOrder, ["onboardingDate"]);
  }, [filteredAirlines, sortField, sortOrder]);

  // Paginated Data
  const totalPages = Math.max(
    1,
    Math.ceil(totalResults / resultsPerPage)
  );

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

  const handleViewDetails = async (id: string) => {
    if (isViewingDetail === id) return;
    setIsViewingDetail(id);
    try {
      const dto = await airlinesService.getAirlineDetail(Number(id));
      const mapped = mapAirlineDTOToAirline(dto);
      setSelectedAirlineDetail(mapped);
    } catch (err: any) {
      toast.error(err.message || "Failed to load airline details");
    } finally {
      setIsViewingDetail(null);
    }
  };

  // Toggle active/disable status from the toggle switch in the table
  const handleToggleStatus = async (airline: Airline) => {
    if (togglingAirlineId) return;
    const targetIsActive = !airline.isActive;

    setTogglingAirlineId(airline.id);
    try {
      const response = await airlinesService.updateAirline(Number(airline.id), {
        isActive: targetIsActive,
      });

      toast.success(response.message || `Successfully ${targetIsActive ? "enabled" : "disabled"} ${airline.airlineName}`);

      if (response?.data) {
        const updatedMapped = mapAirlineDTOToAirline(response.data);
        setAirlines((prev) =>
          prev.map((item) => (item.id === airline.id ? updatedMapped : item))
        );
      } else {
        setAirlines((prev) =>
          prev.map((item) =>
            item.id === airline.id
              ? {
                ...item,
                isActive: targetIsActive,
                status: item.isSuspended ? "Suspended" : targetIsActive ? "Active" : "Disabled",
              }
              : item
          )
        );
      }

      fetchAirlines(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update airline status");
    } finally {
      setTogglingAirlineId(null);
    }
  };

  // Trigger suspend flow
  const handleOpenSuspendConfirm = (airline: Airline) => {
    setSuspendTarget(airline);
  };

  const handleConfirmSuspend = async () => {
    if (!suspendTarget) return;

    setIsSuspending(true);
    try {
      const response = await airlinesService.updateAirline(Number(suspendTarget.id), {
        isActive: false,
        isSuspended: true,
      });

      toast.success(response.message || `Successfully suspended ${suspendTarget.airlineName}`);
      setSuspendTarget(null);
      fetchAirlines();
    } catch (err: any) {
      toast.error(err.message || "Failed to suspend airline");
    } finally {
      setIsSuspending(false);
    }
  };

  // Trigger edit modal
  const handleOpenEditModal = (airline: Airline) => {
    setEditTarget(airline);
  };

  const handleSaveEdit = async (updatedFields: Partial<Airline>) => {
    if (!editTarget) return;

    setIsLoading(true);
    try {
      const status = editTarget.status;
      const isActive = status === "Active";
      const isSuspended = status === "Suspended";

      const payload: Partial<UpdateAirlineRequest> = {
        name: updatedFields.airlineName,
        code: updatedFields.airlineCode,
        countryCode: getCountryCode(updatedFields.country || "United States"),
        companyRegistrationNumber: updatedFields.companyReg,
        website: updatedFields.website || undefined,
        contactEmail: updatedFields.contactEmail,
        contactPhone: updatedFields.contactPhone,
        timezone: updatedFields.timezone,
        logo: updatedFields.logoUrl || undefined,
        currency: updatedFields.currency,
        address: updatedFields.address,
        isActive,
        isSuspended,
        adminFirstName: updatedFields.adminFirstName,
        adminLastName: updatedFields.adminLastName,
        adminEmail: updatedFields.adminEmail,
        adminJobTitle: updatedFields.adminJobTitle,
      };

      const response = await airlinesService.updateAirline(Number(editTarget.id), payload);
      toast.success(response.message || "Airline updated successfully");
      setEditTarget(null);

      const mapped = mapAirlineDTOToAirline(response.data);
      if (selectedAirlineDetail && selectedAirlineDetail.id === editTarget.id) {
        setSelectedAirlineDetail(mapped);
      }

      fetchAirlines();
    } catch (err: any) {
      toast.error(err.message || "Failed to update airline");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      {selectedAirlineDetail ? (
        <AirlineDetailsView
          airline={selectedAirlineDetail}
          onBack={() => setSelectedAirlineDetail(null)}
          onEditClick={() => handleOpenEditModal(selectedAirlineDetail)}
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
                  <TableHead className="min-w-[121px] -translate-x-1">
                    <SortHeader label="Passengers" field="passengersCount" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="min-w-[124px] -translate-x-1">
                    <SortHeader label="Spend" field="spend" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="min-w-[115px] -translate-x-1.5">
                    <SortHeader label="Revenue" field="revenue" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  </TableHead>
                  <TableHead className="min-w-[128px] -translate-x-1">
                    <SortHeader label="Stripe" field="stripeConnection" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                  </TableHead>
                  {hasPermission("edit") && (
                    <TableHead className="whitespace-nowrap min-w-[143px] -translate-x-1">
                      <SortHeader label="Enable/Disable" field="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                    </TableHead>
                  )}
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="px-6 py-12 text-center text-gray-500 font-figtree">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Loading airlines...</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : sortedAirlines.length === 0 ? (
                  <TableEmptyState
                    colSpan={10}
                    icon={Search}
                    title="No airlines found"
                    message="Try adjusting your filters or search query."
                  />
                ) : (
                  sortedAirlines.map((airline) => (
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
                            disabled={!hasPermission("edit") || togglingAirlineId === airline.id}
                            onClick={() => handleToggleStatus(airline)}
                            className={cn(
                              "relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none relative left-1",
                              hasPermission("edit") && togglingAirlineId !== airline.id ? "cursor-pointer" : "cursor-not-allowed opacity-70",
                              airline.isActive ? "bg-emerald-500" : "bg-gray-200"
                            )}
                          >
                            <span
                              className={cn(
                                "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out flex items-center justify-center",
                                airline.isActive ? "translate-x-5" : "translate-x-0"
                              )}
                            >
                              {togglingAirlineId === airline.id && (
                                <Loader2 className="h-3 w-3 animate-spin text-gray-500" />
                              )}
                            </span>
                          </button>
                        </TableCell>
                      )}
                      <TableCell>
                        <div className="flex items-center justify-start gap-2.5">
                          <button
                            onClick={() => handleViewDetails(airline.id)}
                            className="p-1 text-[#6B7280] hover:text-primary transition-colors cursor-pointer"
                            disabled={isViewingDetail === airline.id}
                          >
                            {isViewingDetail === airline.id ? (
                              <Loader2 className="h-[20px] w-[20px] animate-spin text-[#6B7280]" />
                            ) : (
                              <Eye className="h-[20px] w-[20px]" />
                            )}
                          </button>
                          {hasPermission("edit") && (
                            <button
                              onClick={() => handleOpenSuspendConfirm(airline)}
                              className="p-1 cursor-pointer transition-colors"
                            >
                              <img
                                src="/icons/spam.svg"
                                alt="Spam"
                                width={20}
                                height={20}
                              // className={airline.status === "Active" ? "opacity-100 hover:brightness-75" : "opacity-50"}
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
            totalResults={totalResults}
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
        isSuspending={isSuspending}
        onClose={() => !isSuspending && setSuspendTarget(null)}
        onConfirm={handleConfirmSuspend}
      />
    </div>
  );
}
