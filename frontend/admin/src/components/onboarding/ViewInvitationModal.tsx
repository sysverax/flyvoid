"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { Invitation } from "@/src/types/onboarding";
import { cn } from "@/src/lib/utils";

interface ViewInvitationModalProps {
  invitation: Invitation | null;
  onClose: () => void;
}

export function ViewInvitationModal({
  invitation,
  onClose,
}: ViewInvitationModalProps) {
  const isOpen = !!invitation;
  useLockBodyScroll(isOpen);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/40 z-40 transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div
        className={cn(
          "fixed top-0 right-0 h-full w-full max-w-[640px] bg-white z-50 shadow-2xl flex flex-col transition-transform duration-300 ease-in-out",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5">
          <div>
            <h2 className="text-[24px] font-semibold text-[#1F2937]">
              Invitation Details
            </h2>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Read-only overview of this onboarding invitation.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-6 h-6 text-[#1F2937]" />
          </button>
        </div>

        {/* Divider */}
        <div className="w-full" style={{ padding: "0px 24px" }}>
          <div className="h-px bg-[#D1D5DB] w-full" />
        </div>

        {/* Scrollable body */}
        {invitation && (
          <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6 scrollbar-hide">

            {/* Airline Details section */}
            <section>
              <h3 className="text-[18px] font-semibold text-[#1F2937] mb-2.5">
                Airline Details
              </h3>
              <div className="grid grid-cols-2 gap-7">
                <Field label="Airline Name">
                  <input
                    disabled
                    value={invitation.airlineName || ""}
                    className={readonlyCls}
                  />
                </Field>
                <Field label="Airline Code">
                  <input
                    disabled
                    value={invitation.airlineCode || ""}
                    className={readonlyCls}
                  />
                </Field>
                <Field label="Country">
                  <input
                    disabled
                    value={invitation.country || ""}
                    className={readonlyCls}
                  />
                </Field>
                <Field label="Company Registration Number">
                  <input
                    disabled
                    value={invitation.companyReg || ""}
                    className={readonlyCls}
                  />
                </Field>
                <Field label="Website">
                  <input
                    disabled
                    value={invitation.website || ""}
                    className={readonlyCls}
                  />
                </Field>
                <Field label="Contact Email">
                  <input
                    disabled
                    value={invitation.contactEmail || ""}
                    className={readonlyCls}
                  />
                </Field>
                <Field label="Contact Phone">
                  <input
                    disabled
                    value={invitation.phone || ""}
                    className={readonlyCls}
                  />
                </Field>
                <Field label="Timezone">
                  <input
                    disabled
                    value={invitation.timezone || ""}
                    className={readonlyCls}
                  />
                </Field>
                <Field label="Logo URL">
                  <input
                    disabled
                    value={invitation.logoUrl || ""}
                    className={readonlyCls}
                  />
                </Field>
                <Field label="Currency">
                  <input
                    disabled
                    value={invitation.currency || ""}
                    className={readonlyCls}
                  />
                </Field>
                <Field label="Address" className="col-span-2">
                  <input
                    disabled
                    value={invitation.address || ""}
                    className={readonlyCls}
                  />
                </Field>
              </div>
            </section>

            {/* Admin Details section */}
            <section>
              <h3 className="text-[18px] font-semibold text-[#1F2937] mb-2.5">
                Admin Details
              </h3>
              <div className="grid grid-cols-2 gap-7">
                <Field label="Admin First Name">
                  <input
                    disabled
                    value={invitation.adminFirstName || ""}
                    className={readonlyCls}
                  />
                </Field>
                <Field label="Admin Last Name">
                  <input
                    disabled
                    value={invitation.adminLastName || ""}
                    className={readonlyCls}
                  />
                </Field>
                <Field label="Admin Email">
                  <input
                    disabled
                    value={invitation.adminEmail || ""}
                    className={readonlyCls}
                  />
                </Field>
                <Field label="Job Title">
                  <input
                    disabled
                    value={invitation.adminJobTitle || ""}
                    className={readonlyCls}
                  />
                </Field>
                <Field label="Credit Limit" className="col-span-2">
                  <input
                    disabled
                    value={`$${invitation.creditLimit.toLocaleString()}`}
                    className={readonlyCls}
                  />
                </Field>
              </div>
            </section>
          </div>
        )}

        {/* Footer */}
        {/* <div className="px-6 py-4 border-t border-[#E5E7EB]">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 px-6 rounded-lg border border-[#D1D5DB] text-[#09090B] text-[18px] hover:bg-[#F9FAFB] transition-colors cursor-pointer"
          >
            Close
          </button>
        </div> */}
      </div>
    </>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

const readonlyCls =
  "w-full px-4 py-3 rounded-lg border border-[#D1D5DB] text-[16px] bg-[#F9FAFB] text-[#1F2937] outline-none cursor-default select-none disabled:opacity-100";

function statusColor(status: string) {
  switch (status) {
    case "Accepted": return "text-green-700";
    case "Pending": return "text-amber-700";
    case "Expired": return "text-gray-500";
    case "Revoked": return "text-rose-700";
    default: return "";
  }
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[16px] font-medium text-[#1F2937] mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}
