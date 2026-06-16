"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  SortHeader,
} from "@/src/components/ui/table";
import { Pagination } from "@/src/components/ui/pagination";
import { cn } from "@/src/lib/utils";

interface AuditLog {
  id: string;
  timestamp: string;
  admin: string;
  action: string;
  entity: string;
  details: string;
}

const INITIAL_LOGS: AuditLog[] = [
  {
    id: "1",
    timestamp: "01/02/2025, 15:30:00",
    admin: "john.admin@airadmin.com",
    action: "Airline Enabled",
    entity: "Pacific Airways (PA)",
    details: "Enabled airline account",
  },
  {
    id: "2",
    timestamp: "01/02/2025, 15:30:00",
    admin: "sarah.ops@airadmin.com",
    action: "Settings Updated",
    entity: "System Settings",
    details: "Changed platform fee from 7% to 8%",
  },
  {
    id: "3",
    timestamp: "01/02/2025, 15:30:00",
    admin: "john.admin@airadmin.com",
    action: "Invite Sent",
    entity: "Pacific Airways (PA)",
    details: "Sent onboarding invitation",
  },
  {
    id: "4",
    timestamp: "01/02/2025, 15:30:00",
    admin: "john.admin@airadmin.com",
    action: "Airline Suspended",
    entity: "Pacific Airways (PA)",
    details: "Suspended due to payment failures",
  },
  {
    id: "5",
    timestamp: "01/02/2025, 15:30:00",
    admin: "john.admin@airadmin.com",
    action: "Invite Revoked",
    entity: "Pacific Airways (PA)",
    details: "Revoked pending invitation",
  },
  {
    id: "6",
    timestamp: "01/02/2025, 15:30:00",
    admin: "john.admin@airadmin.com",
    action: "Password Changed",
    entity: "Pacific Airways (PA)",
    details: "Updated account password",
  },
  {
    id: "7",
    timestamp: "01/02/2025, 15:30:00",
    admin: "john.admin@airadmin.com",
    action: "Airline Created",
    entity: "Pacific Airways (PA)",
    details: "New airline onboarded via invitation",
  },
  {
    id: "8",
    timestamp: "01/02/2025, 15:30:00",
    admin: "john.admin@airadmin.com",
    action: "Backup Completed",
    entity: "Pacific Airways (PA)",
    details: "Daily backup completed successfully",
  },
];

function getActionColor(action: string) {
  const lower = action.toLowerCase();
  if (lower.includes("enabled") || lower.includes("created")) {
    return "text-emerald-600";
  }
  if (lower.includes("updated") || lower.includes("changed")) {
    return "text-amber-500";
  }
  if (lower.includes("sent")) {
    return "text-blue-600";
  }
  if (lower.includes("suspended") || lower.includes("revoked")) {
    return "text-rose-600";
  }
  return "text-gray-500";
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>(INITIAL_LOGS);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<keyof AuditLog | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Pagination states
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);

  // Search logic
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const q = searchQuery.toLowerCase();
      return (
        log.timestamp.toLowerCase().includes(q) ||
        log.admin.toLowerCase().includes(q) ||
        log.action.toLowerCase().includes(q) ||
        log.entity.toLowerCase().includes(q) ||
        log.details.toLowerCase().includes(q)
      );
    });
  }, [logs, searchQuery]);

  // Sort logic
  const sortedLogs = useMemo(() => {
    if (!sortField) return filteredLogs;

    return [...filteredLogs].sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === "timestamp") {
        const parseTimestamp = (tStr: string) => {
          const [datePart, timePart] = tStr.split(", ");
          if (!datePart) return 0;
          const [day, month, year] = datePart.split("/").map(Number);
          const [hours, minutes, seconds] = (timePart || "00:00:00").split(":").map(Number);
          return new Date(year, month - 1, day, hours, minutes, seconds).getTime();
        };
        valA = parseTimestamp(valA);
        valB = parseTimestamp(valB);
      }

      if (typeof valA === "number" && typeof valB === "number") {
        return sortOrder === "asc" ? valA - valB : valB - valA;
      }

      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();

      if (strA < strB) return sortOrder === "asc" ? -1 : 1;
      if (strA > strB) return sortOrder === "asc" ? 1 : -1;
      return 0;
    });
  }, [filteredLogs, sortField, sortOrder]);

  // Pagination logic
  const totalPages = Math.max(1, Math.ceil(sortedLogs.length / resultsPerPage));
  const paginatedLogs = useMemo(() => {
    const startIndex = (currentPage - 1) * resultsPerPage;
    return sortedLogs.slice(startIndex, startIndex + resultsPerPage);
  }, [sortedLogs, currentPage, resultsPerPage]);

  const handleSort = (field: keyof AuditLog) => {
    if (sortField === field) {
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else {
        setSortField(null);
      }
    } else {
      setSortField(field);
      sortOrder === "asc" ? setSortOrder("asc") : setSortOrder("asc");
      setSortOrder("asc");
    }
    setCurrentPage(1);
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      {/* Header */}
      <div className="mb-7 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%]">
            Audit Logs
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            Track all administrative actions on the platform
          </p>
        </div>
      </div>

      {/* Search Input Box */}
      <div className="rounded-[12px] border border-[#E5E7EB] bg-white p-[17px] mb-6">
        <div className="relative">
          <span className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-[#6B7280]" />
          </span>
          <input
            type="text"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="block h-11 w-full rounded-[8px] border border-[#D1D5DB] bg-[#F3F4F6] py-[14px] pl-11 pr-4 text-[16px] text-slate-950 placeholder-[#6B7280] transition-all hover:bg-slate-100/50 focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[180px] uppercase text-xs font-semibold text-gray-500">
                <SortHeader
                  label="Timestamp"
                  field="timestamp"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="min-w-[200px] uppercase text-xs font-semibold text-gray-500">
                <SortHeader
                  label="Admin"
                  field="admin"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="min-w-[160px] uppercase text-xs font-semibold text-gray-500">
                <SortHeader
                  label="Action"
                  field="action"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="min-w-[180px] uppercase text-xs font-semibold text-gray-500">
                <SortHeader
                  label="Entity"
                  field="entity"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              </TableHead>
              <TableHead className="min-w-[240px] uppercase text-xs font-semibold text-gray-500">
                <SortHeader
                  label="Details"
                  field="details"
                  sortField={sortField}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedLogs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-10 text-gray-500">
                  No logs found matching your search.
                </TableCell>
              </TableRow>
            ) : (
              paginatedLogs.map((log) => (
                <TableRow key={log.id} className="hover:bg-gray-50/50">
                  <TableCell className="text-[#1F2937] font-normal font-mono text-xs">
                    {log.timestamp}
                  </TableCell>
                  <TableCell className="text-[#1F2937] font-normal">
                    {log.admin}
                  </TableCell>
                  <TableCell className={cn("font-medium", getActionColor(log.action))}>
                    {log.action}
                  </TableCell>
                  <TableCell className="text-[#1F2937] font-normal">
                    {log.entity}
                  </TableCell>
                  <TableCell className="text-gray-500 font-normal">
                    {log.details}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <Pagination
        totalResults={filteredLogs.length}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        resultsPerPage={resultsPerPage}
        setResultsPerPage={setResultsPerPage}
        totalPages={totalPages}
      />
    </div>
  );
}
