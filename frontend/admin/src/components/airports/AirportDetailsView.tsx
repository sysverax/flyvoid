"use client";

import { useState, useRef } from "react";
import * as Tooltip from "@radix-ui/react-tooltip";
import React from "react";
import { X } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { Airport } from "@/src/types/airports";
import { useLockBodyScroll } from "@/src/hooks/useLockBodyScroll";
import { useAuth } from "@/src/hooks/useAuth";
import { TruncatedTooltip } from "@/src/components/ui/TruncatedTooltip";

interface AirportDetailsViewProps {
  isOpen: boolean;
  airport: Airport;
  onClose: () => void;
  onEditClick: () => void;
}

export function AirportDetailsView({
  isOpen,
  airport,
  onClose,
  onEditClick,
}: AirportDetailsViewProps) {
  useLockBodyScroll(isOpen);
  const { hasPermission } = useAuth();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center transition-opacity duration-300"
        onClick={onClose}
      >
        {/* Modal Container */}
        <div
          className="w-[540px] max-w-[calc(100vw-32px)] bg-white rounded-3xl flex flex-col justify-start items-start gap-4 overflow-hidden shadow-2xl transition-all duration-300"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="self-stretch px-6 py-5 border-b border-gray-300 flex justify-between items-center">
            <div className="flex justify-start items-center gap-2">
              <h2 className="text-gray-900 text-2xl font-semibold font-figtree translate-y-0.5">
                Airport Details
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5 text-gray-955" />
            </button>
          </div>

          {/* Body */}
          <div className="self-stretch px-6 pb-5 flex flex-col justify-start items-start gap-6">
            <div className="self-stretch flex flex-col gap-3.5">
              {[
                ["Name", airport.name],
                ["IATA", airport.iataCode],
                ["Country", airport.country],
                ["Latitude", airport.latitude],
                ["Longitude", airport.longitude],
                ["Timezone", airport.timezone],
                ["Type", airport.type.toLowerCase()],
              ].map(([label, value]) => (
                <div key={String(label)} className="self-stretch flex justify-between items-center">
                  <div className="text-gray-500 text-[16px] font-normal font-figtree leading-normal shrink-0">{label}</div>
                  <TruncatedTooltip text={String(value)} side="top">
                    <div className="text-right text-gray-900 text-[16px] font-medium font-figtree leading-normal capitalize max-w-[300px] truncate cursor-default">
                      {value}
                    </div>
                  </TruncatedTooltip>
                </div>
              ))}

              {/* Status */}
              <div className="self-stretch flex justify-between items-center">
                <div className="text-gray-500 text-[16px] font-normal font-figtree h-[19px] leading-normal">Status</div>
                <div
                  className={cn(
                    "px-2.5 py-0.5 rounded-2xl flex items-center h-[20px]",
                    airport.isActive
                      ? "bg-green-100 text-green-800"
                      : "bg-gray-200 text-gray-800"
                  )}
                >
                  <span className="text-sm font-medium font-figtree leading-none">
                    {airport.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>
            </div>

            {hasPermission("edit") && (
              <>
                {/* Divider */}
                <div className="self-stretch h-0 border-t border-gray-300"></div>

                {/* Footer Edit Button */}
                <div className="self-stretch inline-flex justify-end items-center gap-2.5 translate-y-0.5">
                  <button
                    type="button"
                    onClick={onEditClick}
                    className="h-[42px] w-[128px] flex items-center justify-center bg-primary hover:bg-[#1A3B75] text-white text-lg font-normal font-figtree rounded-[10px] transition-colors cursor-pointer"
                  >
                    Edit Details
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
