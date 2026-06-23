"use client";

import { Dialog } from "@/src/components/ui/Dialog";
import { Invitation } from "@/src/types/onboarding";

// ── Revoke Dialog ──────────────────────────────────────────────────────────

interface RevokeDialogProps {
  target: Invitation | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function RevokeDialog({ target, onClose, onConfirm }: RevokeDialogProps) {
  return (
    <Dialog.Root isOpen={!!target} onClose={onClose}>
      <Dialog.Header title="Revoke Invitation?" onClose={onClose} />
      <Dialog.Body>
        This will permanently revoke the invitation for {target?.airlineName}. The{" "}
        <span
          className="text-[#1F2937]"
          style={{ fontWeight: 600, fontFamily: "Figtree, sans-serif" }}
        >
          airline will no longer be able to use this invite to onboard.
        </span>
        <br />
        <br />
        This action cannot be undone.
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Cancel onClick={onClose} />
        <Dialog.Action variant="danger" onClick={onConfirm}>
          Revoke Invite
        </Dialog.Action>
      </Dialog.Footer>
    </Dialog.Root>
  );
}

// ── Resend Dialog ──────────────────────────────────────────────────────────

interface ResendDialogProps {
  target: Invitation | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function ResendDialog({ target, onClose, onConfirm }: ResendDialogProps) {
  return (
    <Dialog.Root isOpen={!!target} onClose={onClose}>
      <Dialog.Header title="Resend Invitation?" onClose={onClose} />
      <Dialog.Body>
        This will send a new onboarding invitation to {target?.airlineName}{" "}
        <span className="text-[#1F2937]" style={{ fontWeight: 600, fontFamily: "Figtree, sans-serif"  }}>
          ({target?.contactEmail})
        </span>
        . The previous invitation token will be invalidated.
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Cancel onClick={onClose} />
        <Dialog.Action variant="primary" onClick={onConfirm}>
          Resend Invite
        </Dialog.Action>
      </Dialog.Footer>
    </Dialog.Root>
  );
}