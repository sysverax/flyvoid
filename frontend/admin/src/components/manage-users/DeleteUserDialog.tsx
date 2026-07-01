"use client";

import { Dialog } from "@/src/components/ui/Dialog";

interface User {
  id: string;
  name: string;
  email: string;
  status: "Active" | "Inactive";
}

interface DeleteUserDialogProps {
  isOpen: boolean;
  user: User | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function DeleteUserDialog({
  isOpen,
  user,
  onClose,
  onConfirm,
}: DeleteUserDialogProps) {
  return (
    <Dialog.Root isOpen={isOpen} onClose={onClose}>
      <Dialog.Header title="Delete User?" onClose={onClose} />
      <Dialog.Body>
        Are you sure you want to delete <span className="font-semibold text-gray-800">{user?.name}</span>? This action is permanent and cannot be undone.
      </Dialog.Body>
      <Dialog.Footer>
        <Dialog.Cancel onClick={onClose} />
        <Dialog.Action variant="danger" onClick={onConfirm}>
          Delete
        </Dialog.Action>
      </Dialog.Footer>
    </Dialog.Root>
  );
}
