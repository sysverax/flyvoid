"use client";

import { useEffect } from "react";

export function useLockBodyScroll(isOpen: boolean) {
  useEffect(() => {
    if (!isOpen) return;

    // Save original body overflow inline style
    const originalOverflow = document.body.style.overflow;

    // Prevent scrolling on mount / open
    document.body.style.overflow = "hidden";

    // Restore original overflow style on cleanup / close
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);
}
