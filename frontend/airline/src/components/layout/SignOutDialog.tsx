"use client";

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fadeIn p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl border border-gray-200 flex flex-col gap-4 text-left">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <h3 className="text-lg font-semibold text-gray-900">Sign Out?</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md cursor-pointer"
          >
            ✕
          </button>
        </div>
        <p className="text-sm text-gray-600">
          You&rsquo;re about to sign out of your Airline Portal account.
        </p>
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="h-9 px-4 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 text-sm font-medium transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="h-9 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors cursor-pointer"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
