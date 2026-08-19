"use client";

import { useState } from "react";
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
  const [isSigningOut, setIsSigningOut] = useState(false);

  const handleConfirm = () => {
    setIsSigningOut(true);
    // Simulate API call for signing out before confirming
    setTimeout(() => {
      setIsSigningOut(false);
      onConfirm();
    }, 1500);
  };

  return (
    <Dialog.Root isOpen={isOpen} onClose={isSigningOut ? () => {} : onClose}>
      <Dialog.Header title="Sign Out?" onClose={isSigningOut ? () => {} : onClose} />
      <Dialog.Body>
        You&rsquo;re about to sign out of your Airline Portal account.
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Cancel onClick={onClose} disabled={isSigningOut} />
        <Dialog.Action variant="danger" onClick={handleConfirm} disabled={isSigningOut}>
          {isSigningOut ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Signing out...</span>
            </>
          ) : (
            "Sign out"
          )}
        </Dialog.Action>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
