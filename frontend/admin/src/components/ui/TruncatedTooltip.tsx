"use client";

import React, { useState, useRef } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";

export function TruncatedTooltip({ text, children, side = "top" }: { text: string; children: React.ReactElement; side?: "top" | "right" | "bottom" | "left" }) {
  const textRef = useRef<HTMLElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  const checkTruncation = () => {
    if (textRef.current) {
      setIsTruncated(textRef.current.scrollWidth > textRef.current.clientWidth);
    }
  };

  const childWithRef = React.cloneElement(children as React.ReactElement<any>, {
    ref: textRef,
  });

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild onMouseEnter={checkTruncation}>
          {childWithRef}
        </Tooltip.Trigger>
        <Tooltip.Portal>
          {isTruncated && (
            <Tooltip.Content side={side} sideOffset={5} className="bg-gray-100 border border-gray-200 text-gray-800 text-[13px] font-medium px-3 py-1.5 rounded-md shadow-lg max-w-xs break-words z-[100] animate-in fade-in-0 zoom-in-95 font-figtree">
              {text}
              <Tooltip.Arrow className="fill-gray-100" />
            </Tooltip.Content>
          )}
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
