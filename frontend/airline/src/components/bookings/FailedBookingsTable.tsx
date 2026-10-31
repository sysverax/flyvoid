"use client";

import { useState, type ReactNode } from "react";
import { countries } from "countries-list";
import { Edit, Trash2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { Pagination } from "@/src/components/ui/pagination";
import { cn } from "@/src/lib/utils";
import { TRAVEL_CLASS_LABELS } from "@/src/lib/booking-fields";
import type {
  BookingField,
  FailedBookingDTO,
} from "@/src/services/cancellation.service";

export interface FailedBookingsTableProps {
  failedBookings: FailedBookingDTO[];
  canEdit: boolean;
  /** Id of the failed row loaded in the form, highlighted. */
  editingId: number | null;
  onEdit: (failed: FailedBookingDTO) => void;
  onDelete: (failed: FailedBookingDTO) => void;
}

const countryLabel = (value: string) =>
  countries[value as keyof typeof countries]?.name ?? value;

/** Failed CSV rows with their values and, under each bad value, its error. */
export function FailedBookingsTable({
  failedBookings,
  canEdit,
  editingId,
  onEdit,
  onDelete,
}: FailedBookingsTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const totalPages = Math.max(1, Math.ceil(failedBookings.length / resultsPerPage));
  const page = Math.min(currentPage, totalPages);

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto border border-gray-200 rounded-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[90px]">PNR</TableHead>
              <TableHead className="min-w-[140px]">Contact Name</TableHead>
              <TableHead className="min-w-[180px]">Email</TableHead>
              <TableHead className="min-w-[130px]">Phone</TableHead>
              <TableHead className="min-w-[130px]">Passport Country</TableHead>
              <TableHead className="min-w-[80px] text-center">Adults</TableHead>
              <TableHead className="min-w-[110px] text-center">Children</TableHead>
              <TableHead className="min-w-[120px] text-center">Class</TableHead>
              <TableHead className="min-w-[160px]">Special Notes</TableHead>
              {canEdit && (
                <TableHead className="min-w-[80px] text-center">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {failedBookings
              .slice((page - 1) * resultsPerPage, page * resultsPerPage)
              .map((failed) => {
                const errorsFor = (...fields: (BookingField | null)[]) =>
                  failed.errors
                    .filter((error) => fields.includes(error.field))
                    .map((error) => error.message);
                const v = failed.values;
                const cell = (
                  value: ReactNode,
                  fields: (BookingField | null)[],
                  className?: string,
                ) => {
                  const messages = errorsFor(...fields);
                  return (
                    <TableCell className={cn("align-top", className)}>
                      <div
                        className={cn(
                          messages.length > 0 && "text-red-600 font-medium",
                        )}
                      >
                        {value === "" || value === null ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          value
                        )}
                      </div>
                      {messages.map((message) => (
                        <p
                          key={message}
                          className="text-[11px] leading-snug text-red-500 mt-1 max-w-[220px] whitespace-normal"
                        >
                          {message}
                        </p>
                      ))}
                    </TableCell>
                  );
                };

                return (
                  <TableRow
                    key={failed.id}
                    className={cn(editingId === failed.id && "bg-amber-50/60")}
                  >
                    {cell(
                      <>
                        <span className="font-medium text-gray-900">
                          {v.pnr || "—"}
                        </span>
                        <span
                          className="block text-xs text-gray-400 font-normal"
                          title={failed.fileName ?? undefined}
                        >
                          Row {failed.rowNumber}
                        </span>
                      </>,
                      ["pnr", null],
                    )}
                    {cell(
                      `${v.firstName} ${v.lastName}`.trim(),
                      ["firstName", "lastName"],
                    )}
                    {cell(v.email, ["email"], "text-gray-550")}
                    {cell(v.phone, ["phone"], "text-gray-550")}
                    {cell(countryLabel(v.residency), ["residency"])}
                    {cell(v.adults, ["adults"], "text-center")}
                    {cell(
                      <>
                        {v.children}
                        {v.childAges.length > 0 && (
                          <span className="block text-xs text-gray-400 font-normal">
                            Ages {v.childAges.join(", ")}
                          </span>
                        )}
                      </>,
                      ["children", "childAges"],
                      "text-center",
                    )}
                    {cell(
                      TRAVEL_CLASS_LABELS[v.travelClass] ?? v.travelClass,
                      ["travelClass"],
                      "text-center",
                    )}
                    {cell(v.specialNotes, ["specialNotes"], "text-gray-550")}
                    {canEdit && (
                      <TableCell className="text-center align-top">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => onEdit(failed)}
                            className="text-gray-400 hover:text-[#0F2757] transition-colors cursor-pointer"
                            title="Fix"
                          >
                            <Edit className="h-[18px] w-[18px]" />
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(failed)}
                            className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="h-[18px] w-[18px]" />
                          </button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
          </TableBody>
        </Table>
      </div>

      <Pagination
        totalResults={failedBookings.length}
        currentPage={page}
        setCurrentPage={setCurrentPage}
        resultsPerPage={resultsPerPage}
        setResultsPerPage={setResultsPerPage}
        totalPages={totalPages}
      />
    </div>
  );
}
