"use client";

import { Dialog } from "@/src/components/ui/Dialog";

import { User } from "@/src/services/users.service";

interface DeleteUserDialogProps {
  isOpen: boolean;
  user: User | null;
  isDeleting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteUserDialog({
  isOpen,
  user,
  isDeleting,
  onClose,
  onConfirm,
}: DeleteUserDialogProps) {
  return (
    <Dialog.Root isOpen={isOpen} onClose={isDeleting ? () => {} : onClose}>
      <Dialog.Header title="Delete User?" onClose={isDeleting ? () => {} : onClose} />
      <Dialog.Body>
        Are you sure you want to delete <span className="font-semibold text-gray-800">{user ? `${user.firstName} ${user.lastName}` : ""}</span>? This action is permanent and cannot be undone.
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Cancel onClick={onClose} disabled={isDeleting} />
        <Dialog.Action variant="danger" onClick={onConfirm} disabled={isDeleting}>
          {isDeleting ? (
            <>
              <svg className="animate-spin h-5 w-5 text-white animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Deleting...</span>
            </>
          ) : (
            "Delete"
          )}
        </Dialog.Action>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
