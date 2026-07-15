"use client";

import { useState, useMemo, useEffect } from "react";
import Image from "next/image";
import { Send, Search, Loader2 } from "lucide-react";
import { Dropdown } from "@/src/components/ui/Dropdown";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  SortHeader,
} from "../../components/ui/table";
import { Invitation, InviteFormState } from "@/src/types/onboarding";
import { FiltersCard } from "@/src/components/ui/FiltersCard";
import { Pagination } from "@/src/components/ui/pagination";
import { InviteModal } from "@/src/components/onboarding/InviteModal";
import { useAuth } from "@/src/hooks/useAuth";
import { ViewInvitationModal } from "@/src/components/onboarding/ViewInvitationModal";
import {
  ResendDialog,
  RevokeDialog,
} from "@/src/components/onboarding/RevokeConfirmModal";
import { cn, sortData } from "@/src/lib/utils";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import { TableEmptyState } from "@/src/components/ui/EmptyState";
import { Button } from "@/src/components/ui/button";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@radix-ui/react-tooltip";
import { toast } from "react-toastify";
import { onboardingService } from "@/src/services/onboarding.service";

const STATUSES = ["Pending", "Expired", "Accepted", "Revoked"] as const;
const ALL_STATUSES = ["pending", "expired", "accepted", "revoked"];


const formatDate = (dateStr?: string) => {
  if (!dateStr) return "N/A";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "N/A";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

const mapStatus = (status?: string): "Pending" | "Accepted" | "Revoked" | "Expired" => {
  switch (status?.toUpperCase()) {
    case "ACCEPTED":
      return "Accepted";
    case "REVOKED":
      return "Revoked";
    case "EXPIRED":
      return "Expired";
    case "PENDING":
    default:
      return "Pending";
  }
};

export default function OnboardingPage() {
  const { hasPermission } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [isViewingDetail, setIsViewingDetail] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("All Countries");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    new Set(["Pending", "Expired"]),
  );

  const showActionsColumn = hasPermission("edit") || selectedStatuses.has("Accepted") || selectedStatuses.size === 0;

  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  const [sortField, setSortField] = useState<keyof Invitation | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<Invitation | null>(null);
  const [revokeConfirmTarget, setRevokeConfirmTarget] =
    useState<Invitation | null>(null);
  const [resendConfirmTarget, setResendConfirmTarget] =
    useState<Invitation | null>(null);

  const [inviteForm, setInviteForm] = useState<InviteFormState>({
    airlineName: "",
    airlineCode: "",
    contactEmail: "",
    country: "",
    creditLimit: "",
    expiryDate: "",
    companyReg: "",
    website: "",
    phone: "",
    timezone: "UTC",
    logoUrl: "",
    currency: "USD",
    address: "",
    adminFirstName: "",
    adminLastName: "",
    adminEmail: "",
    adminJobTitle: "",
  });

  const countries = [
    "All Countries",
    "France",
    "Japan",
    "Switzerland",
    "Sweden",
    "United States",
    "Australia",
    "United Kingdom",
    "Germany",
    "India",
    "Canada"
  ];

  const fetchInvitations = async (page = currentPage, limit = resultsPerPage) => {
    setIsLoading(true);
    try {
      const res = await onboardingService.getInvitations(page, limit);
      const mapped = res.invitations.map((inv: any) => ({
        id: String(inv.invitationId),
        airlineName: inv.airlineName,
        airlineCode: inv.airlineCode,
        contactEmail: inv.email, // falling back to admin email since contactEmail is not in invitation list DTO
        country: "N/A",
        invitedBy: `Admin #${inv.invitedByAdminId}`,
        invitedDate: formatDate(inv.createdAt),
        expiryDate: formatDate(inv.expiresAt),
        creditLimit: 0,
        status: mapStatus(inv.status),
      }));
      setInvitations(mapped);
      setTotalResults(res.total);
    } catch (err: any) {
      toast.error(err.message || "Failed to load invitations");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations(currentPage, resultsPerPage);
  }, [currentPage, resultsPerPage]);

  const filteredInvitations = useMemo(() => {
    return invitations.filter((inv) => {
      const matchesSearch =
        inv.airlineName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.airlineCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.contactEmail.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCountry =
        selectedCountry === "All Countries" || inv.country === selectedCountry;
      const matchesStatus =
        selectedStatuses.size === 0 || selectedStatuses.has(inv.status);
      return matchesSearch && matchesCountry && matchesStatus;
    });
  }, [invitations, searchQuery, selectedCountry, selectedStatuses]);

  const sortedInvitations = useMemo(() => {
    return sortData(filteredInvitations, sortField, sortOrder, ["invitedDate", "expiryDate"]);
  }, [filteredInvitations, sortField, sortOrder]);

  const totalPages = Math.max(
    1,
    Math.ceil(totalResults / resultsPerPage),
  );

  const filterDescriptionText = useMemo(() => {
    if (
      selectedStatuses.size === 0 ||
      selectedStatuses.size === ALL_STATUSES.length
    ) {
      return "Showing all invitations.";
    }
    const statuses = Array.from(selectedStatuses).map((s) => s.toLowerCase());
    if (statuses.length === 1)
      return `Showing ${statuses[0]} invitations that require action.`;
    return `Showing ${statuses.join(" and ")} invitations that require action.`;
  }, [selectedStatuses]);

  const toggleStatusFilter = (status: string) => {
    const next = new Set(selectedStatuses);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    setSelectedStatuses(next);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCountry("All Countries");
    setSelectedStatuses(new Set());
    setCurrentPage(1);
    setSortField(null);
    setSortOrder("asc");
  };

  const handleSort = (field: keyof Invitation) => {
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

  const handleViewDetails = async (inv: Invitation) => {
    if (isViewingDetail === inv.id) return;
    setIsViewingDetail(inv.id);
    try {
      const details = await onboardingService.getInvitationDetail(Number(inv.id));
      const fullInvitation: Invitation = {
        id: String(details.invitationId),
        airlineName: details.airlineName,
        airlineCode: details.airlineCode,
        contactEmail: details.email,
        country: "N/A",
        invitedBy: `Admin #${details.invitedByAdminId}`,
        invitedDate: formatDate(details.createdAt),
        expiryDate: formatDate(details.expiresAt),
        creditLimit: 0,
        status: mapStatus(details.status),
        companyReg: details.companyRegistrationNumber,
        website: "",
        phone: "",
        timezone: "",
        logoUrl: "",
        currency: "",
        address: "",
        adminFirstName: details.firstName,
        adminLastName: details.lastName,
        adminEmail: details.email,
        adminJobTitle: details.jobTitle,
      };
      setViewTarget(fullInvitation);
    } catch (err: any) {
      toast.error(err.message || "Failed to load invitation details");
    } finally {
      setIsViewingDetail(null);
    }
  };

  const handleResendInvite = async (inv: Invitation) => {
    setIsResending(true);
    try {
      const response = await onboardingService.resendInvitation(Number(inv.id));
      toast.success(response.message || `Invitation resent to ${inv.airlineName}`);
      setResendConfirmTarget(null);
      fetchInvitations(currentPage, resultsPerPage);
    } catch (err: any) {
      toast.error(err.message || "Failed to resend invitation");
    } finally {
      setIsResending(false);
    }
  };

  const handleRevokeConfirm = async () => {
    if (!revokeConfirmTarget) return;
    setIsRevoking(true);
    try {
      const response = await onboardingService.revokeInvitation(Number(revokeConfirmTarget.id));
      toast.success(response.message || `Invitation for ${revokeConfirmTarget.airlineName} revoked`);
      setRevokeConfirmTarget(null);
      fetchInvitations(currentPage, resultsPerPage);
    } catch (err: any) {
      toast.error(err.message || "Failed to revoke invitation");
    } finally {
      setIsRevoking(false);
    }
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !inviteForm.airlineName ||
      !inviteForm.airlineCode ||
      !inviteForm.contactEmail ||
      !inviteForm.country ||
      !inviteForm.adminFirstName ||
      !inviteForm.adminLastName ||
      !inviteForm.adminEmail ||
      !inviteForm.adminJobTitle ||
      !inviteForm.address ||
      !inviteForm.currency ||
      !inviteForm.timezone ||
      !inviteForm.phone ||
      !inviteForm.companyReg
    ) {
      toast.warn("Please fill in all required fields");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteForm.contactEmail)) {
      toast.warn("Please enter a valid contact email address");
      return;
    }
    if (!emailRegex.test(inviteForm.adminEmail)) {
      toast.warn("Please enter a valid admin email address");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        airlineName: inviteForm.airlineName,
        airlineCode: inviteForm.airlineCode.toUpperCase(),
        countryCode: inviteForm.country,
        companyRegistrationNumber: inviteForm.companyReg,
        website: inviteForm.website || undefined,
        contactEmail: inviteForm.contactEmail,
        contactPhone: inviteForm.phone,
        timezone: inviteForm.timezone,
        logo: inviteForm.logoUrl || undefined,
        address: inviteForm.address,
        currency: inviteForm.currency,
        adminFirstName: inviteForm.adminFirstName,
        adminLastName: inviteForm.adminLastName,
        adminEmail: inviteForm.adminEmail,
        jobTitle: inviteForm.adminJobTitle,
        creditLimit: inviteForm.creditLimit ? Number(inviteForm.creditLimit) : 0,
      };

      const response = await onboardingService.inviteAirline(payload);
      toast.success(response.message || `Successfully invited ${inviteForm.airlineName}!`);
      setIsInviteModalOpen(false);
      fetchInvitations(currentPage, resultsPerPage);

      setInviteForm({
        airlineName: "",
        airlineCode: "",
        contactEmail: "",
        country: "",
        creditLimit: "",
        expiryDate: "",
        companyReg: "",
        website: "",
        phone: "",
        timezone: "UTC",
        logoUrl: "",
        currency: "USD",
        address: "",
        adminFirstName: "",
        adminLastName: "",
        adminEmail: "",
        adminJobTitle: "",
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to create invitation");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      <div className="space-y-7">
        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center lg:h-[50px]">
          <div>
            <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%]">
              Invites & Onboarding
            </h1>
            <p className="text-[14px] text-[#6B7280] mt-1">
              Manage airline onboarding invitations
            </p>
          </div>
          {hasPermission("edit") && (
            <button
              onClick={() => setIsInviteModalOpen(true)}
              className="group flex h-[50px] items-center justify-center gap-2 rounded-[10px] bg-primary px-4 py-[9px] text-[16px] font-medium text-white transition-colors duration-200 hover:bg-primary-hover cursor-pointer"
            >
              <Send className="h-5 w-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              <span>Invite Airline</span>
            </button>
          )}
        </div>

        {/* Filters */}
        <FiltersCard
          searchQuery={searchQuery}
          setSearchQuery={(q) => {
            setSearchQuery(q);
            setCurrentPage(1);
          }}
          searchPlaceholder="Search airlines..."
          onClearFilters={handleClearFilters}
          filterDescriptionText={filterDescriptionText}
        >
          {/* Country dropdown */}
          <Dropdown
            value={selectedCountry}
            onChange={(val) => {
              setSelectedCountry(val);
              setCurrentPage(1);
            }}
            options={countries.map((c) => ({ value: c, label: c }))}
            widthClass="w-44"
            triggerWidthClass="w-[180px]"
          />

          {/* Status pills */}
          <div className="flex h-11 items-center gap-1.5 rounded-[8px] border border-[#D1D5DB] bg-white px-[6px] py-2">
            {STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatusFilter(status)}
                className={cn(
                  "flex h-[33px] items-center justify-center rounded-[6px] px-[10px] py-2 text-[14px] leading-[17px] transition-all duration-150 cursor-pointer",
                  selectedStatuses.has(status)
                    ? "bg-primary text-white shadow-sm"
                    : "text-[#1F2937] hover:text-primary hover:bg-[#F3F4F6]",
                )}
              >
                {status}
              </button>
            ))}
          </div>
        </FiltersCard>

        {/* Table card */}
        <div className="hidden overflow-hidden rounded-[12px] border border-[#E5E7EB] lg:block mb-6 pt-1.5 bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[130px]">
                  <SortHeader label="Airline" field="airlineName" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </TableHead>
                <TableHead className="min-w-[146px]">
                  <SortHeader label="Contact Email" field="contactEmail" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </TableHead>
                <TableHead className="min-w-[114px]">
                  <SortHeader label="Country" field="country" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </TableHead>
                <TableHead className="min-w-[130px] whitespace-nowrap">
                  <SortHeader label="Invited By" field="invitedBy" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </TableHead>
                <TableHead className="min-w-[105px] whitespace-nowrap">
                  <SortHeader label="Invited Date" field="invitedDate" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </TableHead>
                <TableHead className="min-w-[90px] whitespace-nowrap">
                  <SortHeader label="Expiry Date" field="expiryDate" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </TableHead>
                <TableHead className="whitespace-nowrap min-w-[110px]">
                  <SortHeader label="Credit Limit" field="creditLimit" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </TableHead>
                <TableHead className="min-w-[100px]">
                  <SortHeader label="Status" field="status" sortField={sortField} sortOrder={sortOrder} onSort={handleSort} />
                </TableHead>
                {showActionsColumn && <TableHead>Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={showActionsColumn ? 9 : 8} className="px-6 py-12 text-center text-gray-500 font-figtree">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Loading invitations...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sortedInvitations.length === 0 ? (
                <TableEmptyState
                  colSpan={showActionsColumn ? 9 : 8}
                  icon={Search}
                  title="No invitations found"
                  message="Try adjusting your filters or search query."
                />
              ) : (
                sortedInvitations.map((inv) => (
                  <TableRow
                    key={inv.id}
                    className={cn("relative", "mt-1")}
                  >
                    <TableCell className={cn("w-[170px]", inv.status === "Revoked" && "opacity-50")}>
                      <p className="truncate" title={inv.airlineName}>
                        {inv.airlineName}
                      </p>
                      <p
                        className="text-xs text-[#807F94] font-mono mt-0.5 truncate"
                        title={inv.airlineCode}
                      >
                        {inv.airlineCode}
                      </p>
                    </TableCell>
                    <TableCell className={cn(inv.status === "Revoked" && "opacity-50")}>
                      <span
                        className="block max-w-[120px] truncate"
                        title={inv.contactEmail}
                      >
                        {inv.contactEmail}
                      </span>
                    </TableCell>
                    <TableCell className={cn(inv.status === "Revoked" && "opacity-50")}>{inv.country || "N/A"}</TableCell>
                    <TableCell className={cn(inv.status === "Revoked" && "opacity-50")}>{inv.invitedBy}</TableCell>
                    <TableCell className={cn("whitespace-nowrap", inv.status === "Revoked" && "opacity-50")}>
                      {inv.invitedDate}
                    </TableCell>
                    <TableCell className={cn("whitespace-nowrap", inv.status === "Revoked" && "opacity-50")}>
                      {inv.expiryDate}
                    </TableCell>
                    <TableCell className={cn(inv.status === "Revoked" && "opacity-50")}>
                      {inv.creditLimit > 0 ? `$${inv.creditLimit.toLocaleString()}` : "N/A"}
                    </TableCell>
                    <TableCell className={cn(inv.status === "Revoked" && "opacity-50")}>
                      <StatusBadge status={inv.status} />
                    </TableCell>
                    {showActionsColumn && (
                      <TableCell>
                        <div className="flex items-center justify-start min-w-[60px] gap-3">
                          <Button
                            variant="ghost"
                            className="h-5 w-5 cursor-pointer p-0 hover:bg-transparent"
                            size="icon"
                            onClick={() => handleViewDetails(inv)}
                            disabled={isViewingDetail === inv.id}
                          >
                            {isViewingDetail === inv.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-[#6B7280]" />
                            ) : (
                              <Image
                                src={inv.status === "Accepted" ? "/icons/view.svg" : "/icons/edit.svg"}
                                alt={inv.status === "Accepted" ? "View" : "Edit"}
                                width={20}
                                height={20}
                              />
                            )}
                          </Button>

                          {(inv.status === "Pending" ||
                            inv.status === "Expired" ||
                            inv.status === "Revoked") && hasPermission("edit") && (
                              <>
                                <Button
                                  variant="ghost"
                                  className="h-5 w-5 cursor-pointer p-0 hover:bg-transparent"
                                  size="icon"
                                  onClick={() => setResendConfirmTarget(inv)}
                                >
                                  <Image
                                    src="/icons/resend.svg"
                                    alt="Resend"
                                    width={20}
                                    height={20}
                                  />
                                </Button>
                                <Button
                                  variant="ghost"
                                  className="h-5 w-5 cursor-pointer p-0 hover:bg-transparent"
                                  size="icon"
                                  onClick={() => setRevokeConfirmTarget(inv)}
                                >
                                  <Image
                                    src="/icons/revoke.svg"
                                    alt="Revoke"
                                    width={20}
                                    height={20}
                                  />
                                </Button>
                              </>
                            )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        {totalResults > 0 && (
          <div className="mb-6">
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
      </div>

      <InviteModal
        isOpen={isInviteModalOpen}
        isLoading={isSaving}
        onClose={() => {
          if (!isSaving) {
            setIsInviteModalOpen(false);
            setInviteForm({
              airlineName: "",
              airlineCode: "",
              contactEmail: "",
              country: "",
              creditLimit: "",
              expiryDate: "",
              companyReg: "",
              website: "",
              phone: "",
              timezone: "UTC",
              logoUrl: "",
              currency: "USD",
              address: "",
              adminFirstName: "",
              adminLastName: "",
              adminEmail: "",
              adminJobTitle: "",
            });
          }
        }}
        onSubmit={handleCreateInvitation}
        formState={inviteForm}
        setFormState={setInviteForm}
      />

      <ViewInvitationModal
        invitation={viewTarget}
        onClose={() => setViewTarget(null)}
      />

      <RevokeDialog
        target={revokeConfirmTarget}
        isRevoking={isRevoking}
        onClose={() => !isRevoking && setRevokeConfirmTarget(null)}
        onConfirm={handleRevokeConfirm}
      />

      <ResendDialog
        target={resendConfirmTarget}
        isResending={isResending}
        onClose={() => !isResending && setResendConfirmTarget(null)}
        onConfirm={() => {
          handleResendInvite(resendConfirmTarget!);
        }}
      />
    </div>
  );
}
