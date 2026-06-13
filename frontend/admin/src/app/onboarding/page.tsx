"use client";

import { useState, useMemo } from "react";
import {
  Send,
  ChevronDown,
  Search,
} from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "../../components/ui/table";
import { Invitation, Toast, InviteFormState } from "@/src/types/onboarding";
import { ToastList } from "@/src/components/ui/ToastList";
import { FiltersCard } from "@/src/components/ui/FiltersCard";
import { Pagination } from "@/src/components/ui/pagination";
import { InviteModal } from "@/src/components/onboarding/InviteModal";
import {
  ResendDialog,
  RevokeDialog,
} from "@/src/components/onboarding/RevokeConfirmModal";
import { cn } from "@/src/lib/utils";
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
  {
    id: "5",
    airlineName: "TransAsia Link",
    airlineCode: "TAL",
    contactEmail: "onboard.tal@transasia.net",
    country: "Japan",
    invitedBy: "John Smith",
    invitedDate: "15/02/2025",
    expiryDate: "15/03/2025",
    creditLimit: 150000,
    status: "Accepted",
  },
  {
    id: "6",
    airlineName: "Alpine Airways",
    airlineCode: "ALA",
    contactEmail: "onboard.ala@alpine.ch",
    country: "Switzerland",
    invitedBy: "John Smith",
    invitedDate: "10/01/2025",
    expiryDate: "10/02/2025",
    creditLimit: 120000,
    status: "Revoked",
  },
  {
    id: "7",
    airlineName: "Nordic Flight",
    airlineCode: "NDF",
    contactEmail: "onboard.ndf@nordic.se",
    country: "Sweden",
    invitedBy: "Sarah Connor",
    invitedDate: "05/01/2025",
    expiryDate: "05/02/2025",
    creditLimit: 80000,
    status: "Expired",
  },
];

const STATUSES = ["Pending", "Expired", "Accepted", "Revoked"] as const;
const ALL_STATUSES = ["pending", "expired", "accepted", "revoked"];

export default function OnboardingPage() {
  const [invitations, setInvitations] =
    useState<Invitation[]>(INITIAL_INVITATIONS);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCountry, setSelectedCountry] = useState("All Countries");
  const [selectedStatuses, setSelectedStatuses] = useState<Set<string>>(
    new Set(["Pending", "Expired"]),
  );

  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [viewDetailsTarget, setViewDetailsTarget] = useState<Invitation | null>(
    null,
  );
  const [revokeConfirmTarget, setRevokeConfirmTarget] =
    useState<Invitation | null>(null);

  const [inviteForm, setInviteForm] = useState<InviteFormState>({
    airlineName: "",
    airlineCode: "",
    contactEmail: "",
    country: "France",
    creditLimit: "",
    expiryDate: "",
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

  const totalPages = Math.max(
    1,
    Math.ceil(filteredInvitations.length / resultsPerPage),
  );

  const paginatedInvitations = useMemo(() => {
    const startIndex = (currentPage - 1) * resultsPerPage;
    return filteredInvitations.slice(startIndex, startIndex + resultsPerPage);
  }, [filteredInvitations, currentPage, resultsPerPage]);

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
    next.has(status) ? next.delete(status) : next.add(status);
    setSelectedStatuses(next);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchQuery("");
    setSelectedCountry("All Countries");
    setSelectedStatuses(new Set());
    setCurrentPage(1);
    addToast("Filters cleared", "info");
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
      !inviteForm.expiryDate
    ) {
      addToast("Please fill in all required fields", "warning");
      return;
    }

    const rawDate = new Date(inviteForm.expiryDate);
    const formattedExpiry = [
      String(rawDate.getDate()).padStart(2, "0"),
      String(rawDate.getMonth() + 1).padStart(2, "0"),
      rawDate.getFullYear(),
    ].join("/");

    const today = new Date();
    const formattedToday = [
      String(today.getDate()).padStart(2, "0"),
      String(today.getMonth() + 1).padStart(2, "0"),
      today.getFullYear(),
    ].join("/");

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
    };

    setInvitations((prev) => [newInvitation, ...prev]);
    setIsInviteModalOpen(false);
    setInviteForm({
      airlineName: "",
      airlineCode: "",
      contactEmail: "",
      country: "France",
      creditLimit: "",
      expiryDate: "",
    });
    addToast(`Successfully invited ${newInvitation.airlineName}!`);
  };

  return (
    <div className="flex flex-col flex-1 min-h-screen pb-16">
      <ToastList toasts={toasts} />

      <div className="space-y-7">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 -mt-2">
          <div>
            <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] tracking-tight">
              Invites & Onboarding
            </h1>
            <p className="text-[14px] text-[#6B7280] mt-1">
              Manage airline onboarding invitations
            </p>
          </div>
          <button
            onClick={() => setIsInviteModalOpen(true)}
            className="flex items-center gap-2 px-4 py-3 rounded-xl bg-primary hover:bg-primary-hover text-white text-[16px] transition-all duration-200 shadow-sm shadow-primary/20 group active:scale-98 cursor-pointer"
          >
            <Send className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            <span>Invite Airline</span>
          </button>
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
          <div className="relative">
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="appearance-none bg-[#F3F4F6] border border-[#D1D5DB] text-gray-800 py-2.5 pl-4 pr-10 rounded-xl text-[16px] font-medium hover:bg-slate-100/80 cursor-pointer focus:outline-none transition-all"
            >
              {countries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          </div>

          {/* Status pills */}
          <div className="flex items-center gap-1 border border-[#D1D5DB] bg-white py-1.5 px-1.5 rounded-xl">
            {STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => toggleStatusFilter(status)}
                className={cn(
                  "px-2.5 py-2 rounded-lg text-[14px] transition-all duration-150 cursor-pointer",
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
        <div className="hidden lg:block border border-[#E5E7EB] rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Airline</TableHead>
                <TableHead>Contact Email</TableHead>
                <TableHead>Country</TableHead>
                <TableHead>Invited By</TableHead>
                <TableHead className="whitespace-nowrap">
                  Invited Date
                </TableHead>
                <TableHead className="whitespace-nowrap">Expiry Date</TableHead>
                <TableHead className="text-right whitespace-nowrap">
                  Credit Limit
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
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
                    className={cn(inv.status === "Revoked" && "opacity-50")}
                  >
                    <TableCell className="max-w-[150px]">
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
                    <TableCell>
                      <span
                        className="block max-w-[160px] truncate"
                        title={inv.contactEmail}
                      >
                        {inv.contactEmail}
                      </span>
                    </TableCell>
                    <TableCell>{inv.country}</TableCell>
                    <TableCell>{inv.invitedBy}</TableCell>
                    <TableCell className="whitespace-nowrap">
                      {inv.invitedDate}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {inv.expiryDate}
                    </TableCell>
                    <TableCell className="text-right">
                      ${inv.creditLimit.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-3">
                        {inv.status === "Accepted" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                className="cursor-pointer"
                                size="icon"
                                onClick={() => setViewDetailsTarget(inv)}
                              >
                                <img src="/icons/view.svg" alt="View" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              View Airline Profile
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {(inv.status === "Pending" ||
                          inv.status === "Expired") && (
                          <>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="cursor-pointer"
                                  size="icon"
                                  onClick={() => {
                                    setEditTarget(inv);
                                  }}
                                >
                                  <img src="/icons/edit.svg" alt="Edit" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Edit Invitation</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="cursor-pointer"
                                  size="icon"
                                  onClick={() => setResendConfirmTarget(inv)}
                                >
                                  <img src="/icons/resend.svg" alt="Resend" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Resend Invitation</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  className="cursor-pointer"
                                  size="icon"
                                  onClick={() => setRevokeConfirmTarget(inv)}
                                >
                                  <img src="/icons/revoke.svg" alt="Revoke" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Revoke Invitation</TooltipContent>
                            </Tooltip>
                          </>
                        )}
                      </div>
                    </TableCell>
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

      {/* Modals */}
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
