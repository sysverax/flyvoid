"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Minus, Plus, Trash2, Users } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { describeRooms } from "@/src/lib/hotels-csv";
import type { HotelAvailabilityRoom } from "@/src/services/hotel-availability.service";

// Supplier limits (RateHawk): 1–9 rooms, 1–6 adults and up to 4 children per room.
const MAX_ROOMS = 9;
const MAX_ADULTS = 6;
const MAX_CHILDREN = 4;
const DEFAULT_CHILD_AGE = 8;
const CHILD_AGES = Array.from({ length: 18 }, (_, age) => age);

interface RoomsGuestsPickerProps {
  value: HotelAvailabilityRoom[];
  onChange: (rooms: HotelAvailabilityRoom[]) => void;
  /** Several rooms need a supplier with multiroom search. */
  maxRooms?: number;
}

function Counter({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const buttonClass =
    "flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#D1D5DB] text-[#1F2937] transition-colors hover:bg-[#F3F4F6] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer";
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[15px] text-[#1F2937]">{label}</span>
      <div className="flex items-center gap-3">
        <button type="button" className={buttonClass} disabled={value <= min} onClick={() => onChange(value - 1)} aria-label={`Fewer ${label.toLowerCase()}`}>
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-5 text-center text-[15px] font-medium tabular-nums">{value}</span>
        <button type="button" className={buttonClass} disabled={value >= max} onClick={() => onChange(value + 1)} aria-label={`More ${label.toLowerCase()}`}>
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/** "1 room · 2 adults" button with a popover to edit rooms, adults and child ages. */
export function RoomsGuestsPicker({ value, onChange, maxRooms = MAX_ROOMS }: RoomsGuestsPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState<HotelAvailabilityRoom[]>(value);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const updateRoom = (index: number, room: HotelAvailabilityRoom) =>
    setDraft((rooms) => rooms.map((current, i) => (i === index ? room : current)));

  const setChildren = (index: number, count: number) => {
    const room = draft[index];
    const ages = room.childrenAges.slice(0, count);
    while (ages.length < count) ages.push(DEFAULT_CHILD_AGE);
    updateRoom(index, { ...room, childrenAges: ages });
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          // Edit a copy; Done applies it, Cancel or clicking away drops it.
          if (!isOpen) setDraft(value);
          setIsOpen(!isOpen);
        }}
        className="flex h-11 w-[260px] items-center justify-between gap-2 rounded-[8px] border border-[#D1D5DB] bg-[#F3F4F6] px-3.5 text-[15px] text-[#1F2937] transition-colors hover:bg-slate-100 cursor-pointer"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-[#6B7280]" />
          <span className="truncate">{describeRooms(value)}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[#6B7280] transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute left-0 z-30 mt-2 w-[340px] max-w-[calc(100vw-2rem)] rounded-[12px] border border-[#E5E7EB] bg-white p-4 shadow-lg">
          <div className="max-h-[360px] space-y-4 overflow-y-auto pr-1">
            {draft.map((room, index) => (
              <div key={index} className={cn("space-y-3", index > 0 && "border-t border-[#E5E7EB] pt-4")}>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-[#1F2937]">Room {index + 1}</span>
                  {draft.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDraft((rooms) => rooms.filter((_, i) => i !== index))}
                      className="flex items-center gap-1 text-[13px] text-[#6B7280] hover:text-red-600 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  )}
                </div>
                <Counter
                  label="Adults"
                  value={room.adults}
                  min={1}
                  max={MAX_ADULTS}
                  onChange={(adults) => updateRoom(index, { ...room, adults })}
                />
                <Counter
                  label="Children"
                  value={room.childrenAges.length}
                  min={0}
                  max={MAX_CHILDREN}
                  onChange={(count) => setChildren(index, count)}
                />
                {room.childrenAges.map((age, childIndex) => (
                  <div key={childIndex} className="flex items-center justify-between gap-4 pl-3">
                    <span className="text-[14px] text-[#6B7280]">Child {childIndex + 1} age</span>
                    <select
                      value={age}
                      onChange={(event) => {
                        const ages = [...room.childrenAges];
                        ages[childIndex] = Number(event.target.value);
                        updateRoom(index, { ...room, childrenAges: ages });
                      }}
                      className="h-8 rounded-[8px] border border-[#D1D5DB] bg-[#F3F4F6] px-2 text-[14px] cursor-pointer"
                    >
                      {CHILD_AGES.map((option) => (
                        <option key={option} value={option}>
                          {option === 0 ? "Under 1" : option}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-[#E5E7EB] pt-3">
            <button
              type="button"
              disabled={draft.length >= maxRooms}
              onClick={() => setDraft((rooms) => [...rooms, { adults: 1, childrenAges: [] }])}
              className="flex items-center gap-1.5 text-[14px] font-medium text-primary hover:underline disabled:cursor-not-allowed disabled:text-[#9CA3AF] disabled:no-underline cursor-pointer"
              title={draft.length >= maxRooms ? `This provider allows up to ${maxRooms} room${maxRooms === 1 ? "" : "s"} per search` : undefined}
            >
              <Plus className="h-4 w-4" />
              Add room
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-9 rounded-[8px] px-3 text-[14px] text-[#6B7280] hover:bg-[#F3F4F6] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(draft);
                  setIsOpen(false);
                }}
                className="h-9 rounded-[8px] bg-primary px-4 text-[14px] font-medium text-white hover:bg-primary-hover cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
