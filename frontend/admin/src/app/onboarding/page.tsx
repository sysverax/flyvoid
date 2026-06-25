"use client";

import { useState, useMemo } from "react";
import Image from "next/image";
import { Send, Search } from "lucide-react";
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
import { Invitation, Toast, InviteFormState } from "@/src/types/onboarding";
import { ToastList } from "@/src/components/ui/ToastList";
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

const INITIAL_INVITATIONS: Invitation[] = [
  {
    id: "1",
    airlineName: "EuroJet Airways",
    airlineCode: "EJA",
    contactEmail: "onboard.eja@eurojet.com",
    country: "France",
    invitedBy: "John Smith",
    invitedDate: "30/01/2025",
    expiryDate: "28/02/2025",
    creditLimit: 100000,
    status: "Pending",
  },
  {
    id: "2",
    airlineName: "EuroJet Airways",
    airlineCode: "EJA",
    contactEmail: "onboard.eja@eurojet.com",
    country: "France",
    invitedBy: "John Smith",
    invitedDate: "30/01/2025",
    expiryDate: "28/02/2025",
    creditLimit: 100000,
    status: "Accepted",
  },
  {
    id: "3",
    airlineName: "EuroJet Airways",
    airlineCode: "EJA",
    contactEmail: "onboard.eja@eurojet.com",
    country: "France",
    invitedBy: "John Smith",
    invitedDate: "30/01/2025",
    expiryDate: "28/02/2025",
    creditLimit: 100000,
    status: "Revoked",
  },
  {
    id: "4",
    airlineName: "EuroJet Airways",
    airlineCode: "EJA",
    contactEmail: "onboard.eja@eurojet.com",
    country: "France",
    invitedBy: "John Smith",
    invitedDate: "30/01/2025",
    expiryDate: "28/02/2025",
    creditLimit: 100000,
    status: "Expired",
  },
  // {
  //   id: "5",
  //   airlineName: "TransAsia Link",
  //   airlineCode: "TAL",
  //   contactEmail: "onboard.tal@transasia.net",
  //   country: "Japan",
  //   invitedBy: "John Smith",
  //   invitedDate: "15/02/2025",
  //   expiryDate: "15/03/2025",
  //   creditLimit: 150000,
  //   status: "Accepted",
  // },
  // {
  //   id: "6",
  //   airlineName: "Alpine Airways",
  //   airlineCode: "ALA",
  //   contactEmail: "onboard.ala@alpine.ch",
  //   country: "Switzerland",
  //   invitedBy: "John Smith",
  //   invitedDate: "10/01/2025",
  //   expiryDate: "10/02/2025",
  //   creditLimit: 120000,
  //   status: "Revoked",
  // },
  // {
  //   id: "7",
  //   airlineName: "Nordic Flight",
  //   airlineCode: "NDF",
  //   contactEmail: "onboard.ndf@nordic.se",
  //   country: "Sweden",
  //   invitedBy: "Sarah Connor",
  //   invitedDate: "05/01/2025",
  //   expiryDate: "05/02/2025",
  //   creditLimit: 80000,
  //   status: "Expired",
  // },
];

const STATUSES = ["Pending", "Expired", "Accepted", "Revoked"] as const;
const ALL_STATUSES = ["pending", "expired", "accepted", "revoked"];

export default function OnboardingPage() {
  const { hasPermission } = useAuth();
  const [invitations, setInvitations] =
    useState<Invitation[]>(INITIAL_INVITATIONS);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("All Countries");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    new Set(["Pending", "Expired"]),
  );

  const showActionsColumn = hasPermission("edit") || selectedStatuses.has("Accepted") || selectedStatuses.size === 0;

  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [sortField, setSortField] = useState<keyof Invitation | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<Invitation | null>(null);
  const [revokeConfirmTarget, setRevokeConfirmTarget] =
    useState<Invitation | null>(null);

  const [inviteForm, setInviteForm] = useState<InviteFormState>({
    airlineName: "",
    airlineCode: "",
    contactEmail: "",
    country: "France",
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

  const [toasts, setToasts] = useState<Toast[]>([]);

  const [editTarget, setEditTarget] = useState<Invitation | null>(null);
  const [resendConfirmTarget, setResendConfirmTarget] =
    useState<Invitation | null>(null);

  const addToast = (message: string, type: Toast["type"] = "success") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      4000,
    );
  };

  const countries = useMemo(() => {
    const unique = new Set(invitations.map((item) => item.country));
    return ["All Countries", ...Array.from(unique)];
  }, [invitations]);

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
    Math.ceil(sortedInvitations.length / resultsPerPage),
  );

  const paginatedInvitations = useMemo(() => {
    const startIndex = (currentPage - 1) * resultsPerPage;
    return sortedInvitations.slice(startIndex, startIndex + resultsPerPage);
  }, [sortedInvitations, currentPage, resultsPerPage]);

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
    addToast("Filters cleared", "info");
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


  const handleResendInvite = (inv: Invitation) => {
    const today = new Date();
    today.setDate(today.getDate() + 30);
    const newExpiry = [
      String(today.getDate()).padStart(2, "0"),
      String(today.getMonth() + 1).padStart(2, "0"),
      today.getFullYear(),
    ].join("/");

    setInvitations((prev) =>
      prev.map((item) =>
        item.id === inv.id
          ? { ...item, expiryDate: newExpiry, status: "Pending" }
          : item,
      ),
    );
    addToast(`Invitation resent to ${inv.airlineName} (${inv.contactEmail})`);
  };

  const handleRevokeConfirm = () => {
    if (!revokeConfirmTarget) return;
    setInvitations((prev) =>
      prev.map((item) =>
        item.id === revokeConfirmTarget.id
          ? { ...item, status: "Revoked" as const }
          : item,
      ),
    );
    addToast(
      `Invitation for ${revokeConfirmTarget.airlineName} revoked`,
      "warning",
    );
    setRevokeConfirmTarget(null);
  };

  const handleCreateInvitation = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !inviteForm.airlineName ||
      !inviteForm.airlineCode ||
      !inviteForm.contactEmail ||
      !inviteForm.adminFirstName ||
      !inviteForm.adminLastName ||
      !inviteForm.adminEmail ||
      !inviteForm.adminJobTitle
    ) {
      addToast("Please fill in all required fields", "warning");
      return;
    }

    const formattedExpiry = inviteForm.expiryDate
      ? (() => {
        const rawDate = new Date(inviteForm.expiryDate);
        return [
          String(rawDate.getDate()).padStart(2, "0"),
          String(rawDate.getMonth() + 1).padStart(2, "0"),
          rawDate.getFullYear(),
        ].join("/");
      })()
      : editTarget
        ? editTarget.expiryDate
        : (() => {
          const today = new Date();
          today.setDate(today.getDate() + 30);
          return [
            String(today.getDate()).padStart(2, "0"),
            String(today.getMonth() + 1).padStart(2, "0"),
            today.getFullYear(),
          ].join("/");
        })();

    const today = new Date();
    const formattedToday = [
      String(today.getDate()).padStart(2, "0"),
      String(today.getMonth() + 1).padStart(2, "0"),
      today.getFullYear(),
    ].join("/");

    if (editTarget) {
      setInvitations((prev) =>
        prev.map((item) =>
          item.id === editTarget.id
            ? {
              ...item,
              airlineName: inviteForm.airlineName,
              airlineCode: inviteForm.airlineCode.toUpperCase(),
              contactEmail: inviteForm.contactEmail,
              country: inviteForm.country,
              expiryDate: formattedExpiry,
              creditLimit: inviteForm.creditLimit
                ? parseInt(inviteForm.creditLimit)
                : 100000,
              companyReg: inviteForm.companyReg,
              website: inviteForm.website,
              phone: inviteForm.phone,
              timezone: inviteForm.timezone,
              logoUrl: inviteForm.logoUrl,
              currency: inviteForm.currency,
              address: inviteForm.address,
              adminFirstName: inviteForm.adminFirstName,
              adminLastName: inviteForm.adminLastName,
              adminEmail: inviteForm.adminEmail,
              adminJobTitle: inviteForm.adminJobTitle,
            }
            : item
        )
      );
      setEditTarget(null);
      addToast(`Successfully updated invitation for ${inviteForm.airlineName}!`);
    } else {
      const newInvitation: Invitation = {
        id: Math.random().toString(36).substring(2, 9),
        airlineName: inviteForm.airlineName,
        airlineCode: inviteForm.airlineCode.toUpperCase(),
        contactEmail: inviteForm.contactEmail,
        country: inviteForm.country,
        invitedBy: "You (Admin)",
        invitedDate: formattedToday,
        expiryDate: formattedExpiry,
        creditLimit: inviteForm.creditLimit
          ? parseInt(inviteForm.creditLimit)
          : 100000,
        status: "Pending",
        companyReg: inviteForm.companyReg,
        website: inviteForm.website,
        phone: inviteForm.phone,
        timezone: inviteForm.timezone,
        logoUrl: inviteForm.logoUrl,
        currency: inviteForm.currency,
        address: inviteForm.address,
        adminFirstName: inviteForm.adminFirstName,
        adminLastName: inviteForm.adminLastName,
        adminEmail: inviteForm.adminEmail,
        adminJobTitle: inviteForm.adminJobTitle,
      };
      setInvitations((prev) => [newInvitation, ...prev]);
      setIsInviteModalOpen(false);
      addToast(`Successfully invited ${newInvitation.airlineName}!`);
    }

    setInviteForm({
      airlineName: "",
      airlineCode: "",
      contactEmail: "",
      country: "France",
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
  };

  return (
    // <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-[1136px] lg:max-w-[calc(100vw-304px)]">
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      <ToastList toasts={toasts} />

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
              className="group flex h-[50px] items-center justify-center gap-2 rounded-[10px] bg-primary px-4 py-[9px] text-[16px] font-medium text-white transition-colors duration-200 hover:bg-primary-hover"
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
        <div className="hidden overflow-hidden rounded-[12px] border border-[#E5E7EB] lg:block mb-6 pt-1.5">
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
              {paginatedInvitations.length === 0 ? (
                <TableEmptyState
                  colSpan={9}
                  icon={Search}
                  title="No invitations found"
                  message="Try adjusting your filters or search query."
                />
              ) : (
                paginatedInvitations.map((inv) => (
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
                    <TableCell className={cn(inv.status === "Revoked" && "opacity-50")}>{inv.country}</TableCell>
                    <TableCell className={cn(inv.status === "Revoked" && "opacity-50")}>{inv.invitedBy}</TableCell>
                    <TableCell className={cn("whitespace-nowrap pl-5", inv.status === "Revoked" && "opacity-50")}>
                      {inv.invitedDate}
                    </TableCell>
                    <TableCell className={cn("whitespace-nowrap", inv.status === "Revoked" && "opacity-50")}>
                      {inv.expiryDate}
                    </TableCell>
                    <TableCell className={cn("pl-2", inv.status === "Revoked" && "opacity-50")}>
                      ${inv.creditLimit.toLocaleString()}
                    </TableCell>
                    <TableCell className={cn(inv.status === "Revoked" && "opacity-50")}>
                      <StatusBadge status={inv.status} />
                    </TableCell>
                    {showActionsColumn && (
                      <TableCell>
                        <div className="flex items-center justify-start min-w-[60px] gap-3">
                          {inv.status === "Accepted" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="h-5 w-5 cursor-pointer p-0"
                                  size="icon"
                                  onClick={() => setViewTarget(inv)}
                                >
                                  <Image
                                    src="/icons/view.svg"
                                    alt="View"
                                    width={20}
                                    height={20}
                                  />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                View Invitation Details
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {(inv.status === "Pending" ||
                            inv.status === "Expired" ||
                            inv.status === "Revoked") && hasPermission("edit") && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      className="h-5 w-5 cursor-pointer p-0"
                                      size="icon"
                                      onClick={() => {
                                        setEditTarget(inv);
                                        setInviteForm({
                                          airlineName: inv.airlineName,
                                          airlineCode: inv.airlineCode,
                                          contactEmail: inv.contactEmail,
                                          country: inv.country,
                                          creditLimit: String(inv.creditLimit),
                                          expiryDate: inv.expiryDate
                                            ? (() => {
                                              const parts = inv.expiryDate.split("/");
                                              if (parts.length === 3) {
                                                return `${parts[2]}-${parts[1]}-${parts[0]}`;
                                              }
                                              return "";
                                            })()
                                            : "",
                                          companyReg: inv.companyReg || "",
                                          website: inv.website || "",
                                          phone: inv.phone || "",
                                          timezone: inv.timezone || "UTC",
                                          logoUrl: inv.logoUrl || "",
                                          currency: inv.currency || "USD",
                                          address: inv.address || "",
                                          adminFirstName: inv.adminFirstName || "",
                                          adminLastName: inv.adminLastName || "",
                                          adminEmail: inv.adminEmail || "",
                                          adminJobTitle: inv.adminJobTitle || "",
                                        });
                                      }}
                                    >
                                      <Image
                                        src="/icons/edit.svg"
                                        alt="Edit"
                                        width={20}
                                        height={20}
                                      />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Edit Invitation</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      className="h-5 w-5 cursor-pointer p-0"
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
                                  </TooltipTrigger>
                                  <TooltipContent>Resend Invitation</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      className="h-5 w-5 cursor-pointer p-0"
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
                                  </TooltipTrigger>
                                  <TooltipContent>Revoke Invitation</TooltipContent>
                                </Tooltip>
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
        <Pagination
          totalResults={filteredInvitations.length}
          currentPage={currentPage}
          setCurrentPage={setCurrentPage}
          resultsPerPage={resultsPerPage}
          setResultsPerPage={setResultsPerPage}
          totalPages={totalPages}
        />
      </div>

      <InviteModal
        isOpen={isInviteModalOpen || !!editTarget}
        onClose={() => {
          setIsInviteModalOpen(false);
          setEditTarget(null);
        }}
        onSubmit={handleCreateInvitation}
        formState={inviteForm}
        setFormState={setInviteForm}
        editTarget={editTarget}
      />

      <ViewInvitationModal
        invitation={viewTarget}
        onClose={() => setViewTarget(null)}
      />

      <RevokeDialog
        target={revokeConfirmTarget}
        onClose={() => setRevokeConfirmTarget(null)}
        onConfirm={handleRevokeConfirm}
      />

      <ResendDialog
        target={resendConfirmTarget}
        onClose={() => setResendConfirmTarget(null)}
        onConfirm={() => {
          handleResendInvite(resendConfirmTarget!);
          setResendConfirmTarget(null);
        }}
      />
    </div>
  );
}
