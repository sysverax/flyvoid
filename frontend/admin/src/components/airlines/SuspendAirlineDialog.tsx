"use client";

import { Dialog } from "@/src/components/ui/Dialog";
import { Airline } from "@/src/types/airlines";

interface SuspendAirlineDialogProps {
  isOpen: boolean;
  airline: Airline | null;
  isSuspending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function SuspendAirlineDialog({
  isOpen,
  airline,
  isSuspending = false,
  onClose,
  onConfirm,
}: SuspendAirlineDialogProps) {
  return (
    <Dialog.Root isOpen={isOpen} onClose={isSuspending ? () => {} : onClose}>
      <Dialog.Header title="Suspend Airline?" onClose={isSuspending ? () => {} : onClose} />
      <Dialog.Body>
        Are you sure you want to suspend <span>{airline?.airlineName}</span>? This will disable all their operations and require manual review to reactivate.
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Cancel onClick={onClose} disabled={isSuspending} />
        <Dialog.Action variant="danger" onClick={onConfirm} disabled={isSuspending}>
          {isSuspending ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Suspending...</span>
            </>
          ) : (
            "Suspend"
          )}
        </Dialog.Action>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
