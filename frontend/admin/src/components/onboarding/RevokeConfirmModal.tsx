"use client";

import { Dialog } from "@/src/components/ui/Dialog";
import { Invitation } from "@/src/types/onboarding";

// ── Revoke Dialog ──────────────────────────────────────────────────────────

interface RevokeDialogProps {
  target: Invitation | null;
  isRevoking?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function RevokeDialog({ target, isRevoking = false, onClose, onConfirm }: RevokeDialogProps) {
  return (
    <Dialog.Root isOpen={!!target} onClose={isRevoking ? () => {} : onClose}>
      <Dialog.Header title="Revoke Invitation?" onClose={isRevoking ? () => {} : onClose} />
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
        <Dialog.Cancel onClick={onClose} disabled={isRevoking} />
        <Dialog.Action variant="danger" onClick={onConfirm} disabled={isRevoking}>
          {isRevoking ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Revoking...</span>
            </>
          ) : (
            "Revoke Invite"
          )}
        </Dialog.Action>
      </Dialog.Footer>
    </Dialog.Root>
  );
}

// ── Resend Dialog ──────────────────────────────────────────────────────────

interface ResendDialogProps {
  target: Invitation | null;
  isResending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ResendDialog({ target, isResending = false, onClose, onConfirm }: ResendDialogProps) {
  return (
    <Dialog.Root isOpen={!!target} onClose={isResending ? () => {} : onClose}>
      <Dialog.Header title="Resend Invitation?" onClose={isResending ? () => {} : onClose} />
      <Dialog.Body>
        This will send a new onboarding invitation to {target?.airlineName}{" "}
        <span className="text-[#1F2937]" style={{ fontWeight: 600, fontFamily: "Figtree, sans-serif"  }}>
          ({target?.contactEmail})
        </span>
        . The previous invitation token will be invalidated.
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Cancel onClick={onClose} disabled={isResending} />
        <Dialog.Action variant="primary" onClick={onConfirm} disabled={isResending}>
          {isResending ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Resending...</span>
            </>
          ) : (
            "Resend Invite"
          )}
        </Dialog.Action>
      </Dialog.Footer>
    </Dialog.Root>
  );
}