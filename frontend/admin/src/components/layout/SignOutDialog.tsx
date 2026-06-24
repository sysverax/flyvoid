"use client";

import { Dialog } from "@/src/components/ui/Dialog";

interface SignOutDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function SignOutDialog({
  isOpen,
  onClose,
  onConfirm,
}: SignOutDialogProps) {
  return (
    <Dialog.Root isOpen={isOpen} onClose={onClose}>
      <Dialog.Header title="Sign Out?" onClose={onClose} />
      <Dialog.Body>
        You&rsquo;re about to sign out of your account.
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Cancel onClick={onClose} />
        <Dialog.Action variant="danger" onClick={onConfirm}>
          Sign out
        </Dialog.Action>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
