"use client";

import { Dialog } from "@/src/components/ui/Dialog";
import { Airline } from "@/src/types/airlines";

interface SuspendAirlineDialogProps {
  isOpen: boolean;
  airline: Airline | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function SuspendAirlineDialog({
  isOpen,
  airline,
  onClose,
  onConfirm,
}: SuspendAirlineDialogProps) {
  return (
    <Dialog.Root isOpen={isOpen} onClose={onClose}>
      <Dialog.Header title="Suspend Airline?" onClose={onClose} />
      <Dialog.Body>
        Are you sure you want to suspend <span>{airline?.airlineName}</span>? This will disable all their operations and require manual review to reactivate.
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Cancel onClick={onClose} />
        <Dialog.Action variant="danger" onClick={onConfirm}>
          Suspend
        </Dialog.Action>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
