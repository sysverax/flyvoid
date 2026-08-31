"use client";

import { useState, useEffect } from "react";
import {
  X,
  Plus,
  Send,
  Calendar,
  Clock,
  ArrowRight,
  Check,
  ShieldCheck,
  FileCheck,
  AlertCircle,
  Settings,
  Plane,
  UploadCloud,
  Users,
  Home,
  Receipt,
  CreditCard,
  Bell,
  ArrowLeft,
  HelpCircle,
  CheckCircle2,
  MapPin,
  Building2,
  Loader2,
  Circle,
  Info,
  Star,
  Upload,
} from "lucide-react";
import { toast } from "react-toastify";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { DatePicker } from "@/src/components/ui/DatePicker";
import { AddCardModal } from "@/src/components/ui/AddCardModal";
import { cn } from "@/src/lib/utils";

const AIRPORT_OPTIONS = [
  { value: "", label: "Select airport" },
  { value: "LAX", label: "LAX - Los Angeles International" },
  { value: "JFK", label: "JFK - John F. Kennedy International" },
  { value: "LHR", label: "LHR - London Heathrow" },
  { value: "HND", label: "HND - Tokyo Haneda" },
  { value: "CDG", label: "CDG - Charles de Gaulle" },
  { value: "SIN", label: "SIN - Changi Airport" },
  { value: "FRA", label: "FRA - Frankfurt Airport" },
];

const TRAVEL_CLASS_OPTIONS = [
  { value: "Economy", label: "Economy" },
  { value: "Business", label: "Business" },
  { value: "First Class", label: "First Class" },
];

interface ManualBooking {
  id: string;
  pnr: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  travelClass: string;
  adults: number;
  children: number;
  notes: string;
  tags: string[];
}

interface Cancellation {
  id: string;
  flight: string;
  route: string;
  cancellationDate: string;
  bookings: number;
  passengers: number;
  totalCost: number;
  status: "Published" | "Draft" | "In Progress";
  reason: string;
}

interface CancellationWizardProps {
  onClose: () => void;
  onSave: (added: Cancellation) => void;
}

function formatDateString(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
}

export default function CancellationWizard({ onClose, onSave }: CancellationWizardProps) {
  const [activeStep, setActiveStep] = useState(1);

  // Flight Details Form Inputs
  const [newFlight, setNewFlight] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newDepartureAirport, setNewDepartureAirport] = useState("");
  const [newArrivalAirport, setNewArrivalAirport] = useState("");
  const [selectedReasonTag, setSelectedReasonTag] = useState("");
  const [newReason, setNewReason] = useState("");

  // Step 2 Manual booking states
  const [bookingTab, setBookingTab] = useState<"upload" | "manual">("manual");
  const [bookingPnr, setBookingPnr] = useState("");
  const [bookingFirstName, setBookingFirstName] = useState("");
  const [bookingLastName, setBookingLastName] = useState("");
  const [bookingEmail, setBookingEmail] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");
  const [bookingClass, setBookingClass] = useState("Economy");
  const [bookingAdults, setBookingAdults] = useState("1");
  const [bookingChildren, setBookingChildren] = useState("0");
  const [bookingNotesText, setBookingNotesText] = useState("");
  const [selectedNoteTags, setSelectedNoteTags] = useState<string[]>([]);
  const [addedBookings, setAddedBookings] = useState<ManualBooking[]>([]);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);

  // Manifest File Upload (Excel simulator)
  const [isManifestUploaded, setIsManifestUploaded] = useState(false);
  const [manifestFileName, setManifestFileName] = useState("");

  // Step 4 Allocation state
  const [selectedHotels, setSelectedHotels] = useState<string[]>([]);
  const [isAutoAllocate, setIsAutoAllocate] = useState(true);
  const [isAllocating, setIsAllocating] = useState(false);
  const [allocationProgress, setAllocationProgress] = useState(0);

  useEffect(() => {
    if (isAllocating) {
      if (allocationProgress < 4) {
        const timer = setTimeout(() => {
          setAllocationProgress(prev => prev + 1);
        }, 1500);
        return () => clearTimeout(timer);
      } else {
        const timer = setTimeout(() => {
          setIsAllocating(false);
          setAllocationProgress(0);
          setActiveStep(5);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [isAllocating, allocationProgress]);

  // Step 6 Payment state
  const [paymentMethod, setPaymentMethod] = useState("visa");
  const [isAddingCard, setIsAddingCard] = useState(false);

  // Step 7 Publish state
  const [notifySMS, setNotifySMS] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyGround, setNotifyGround] = useState(true);

  // Calculated state values
  const totalBookingsCount = addedBookings.length;
  const totalPassengersCount = addedBookings.reduce((sum, b) => sum + b.adults + b.children, 0);
  const hotelRoomsCost = totalBookingsCount * 120;
  const platformFee = Math.round(hotelRoomsCost * 0.05);
  const calculatedTotalCost = hotelRoomsCost + platformFee;

  const handleTagClick = (tag: string) => {
    setSelectedReasonTag(tag);
    if (tag === "Other") {
      setNewReason("");
    } else {
      setNewReason(tag);
    }
  };

  const simulateExcelUpload = () => {
    setIsManifestUploaded(true);
    setManifestFileName("passenger_manifest_" + (newFlight || "SW1234") + ".xlsx");

    // Add mock bookings
    const mockBookings: ManualBooking[] = [
      {
        id: "mock1",
        pnr: "DDJU34",
        firstName: "New",
        lastName: "Admin",
        email: "ops@summitair.com",
        phone: "+1 555 020 0000",
        travelClass: "Economy",
        adults: 1,
        children: 0,
        notes: "Dietary Requirements",
        tags: ["Dietary Requirements"],
      },
      {
        id: "mock2",
        pnr: "PNR992",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@email.com",
        phone: "+1 555 999 1122",
        travelClass: "Business",
        adults: 2,
        children: 1,
        notes: "Wheelchair Assistance",
        tags: ["Wheelchair Assistance"],
      }
    ];
    setAddedBookings(mockBookings);
  };

  const handleNoteTagClick = (tag: string) => {
    if (selectedNoteTags.includes(tag)) {
      setSelectedNoteTags(prev => prev.filter(t => t !== tag));
    } else {
      setSelectedNoteTags(prev => [...prev, tag]);
    }
  };

  const handleEditBooking = (booking: ManualBooking) => {
    setEditingBookingId(booking.id);
    setBookingPnr(booking.pnr);
    setBookingFirstName(booking.firstName);
    setBookingLastName(booking.lastName);
    setBookingEmail(booking.email);
    setBookingPhone(booking.phone);
    setBookingClass(booking.travelClass);
    setBookingAdults(String(booking.adults));
    setBookingChildren(String(booking.children));
    setBookingNotesText(booking.notes);
    setSelectedNoteTags(booking.tags);
  };

  const handleDeleteBooking = (id: string) => {
    setAddedBookings(prev => prev.filter(b => b.id !== id));
  };

  const handleAddBooking = () => {
    if (!bookingPnr.trim()) {
      alert("Booking Reference (PNR) is required.");
      return;
    }
    if (!bookingFirstName.trim()) {
      alert("First Name is required.");
      return;
    }
    if (!bookingLastName.trim()) {
      alert("Last Name is required.");
      return;
    }
    if (!bookingEmail.trim()) {
      alert("Email is required.");
      return;
    }
    if (!bookingPhone.trim()) {
      alert("Phone is required.");
      return;
    }

    if (editingBookingId) {
      setAddedBookings(prev => prev.map(b => b.id === editingBookingId ? {
        ...b,
        pnr: bookingPnr,
        firstName: bookingFirstName,
        lastName: bookingLastName,
        email: bookingEmail,
        phone: bookingPhone,
        travelClass: bookingClass,
        adults: Number(bookingAdults) || 1,
        children: Number(bookingChildren) || 0,
        notes: bookingNotesText,
        tags: selectedNoteTags,
      } : b));
      setEditingBookingId(null);
    } else {
      const newB: ManualBooking = {
        id: String(Date.now()),
        pnr: bookingPnr,
        firstName: bookingFirstName,
        lastName: bookingLastName,
        email: bookingEmail,
        phone: bookingPhone,
        travelClass: bookingClass,
        adults: Number(bookingAdults) || 1,
        children: Number(bookingChildren) || 0,
        notes: bookingNotesText,
        tags: selectedNoteTags,
      };
      setAddedBookings(prev => [...prev, newB]);
    }

    // Reset booking form
    setBookingPnr("");
    setBookingFirstName("");
    setBookingLastName("");
    setBookingEmail("");
    setBookingPhone("");
    setBookingClass("Economy");
    setBookingAdults("1");
    setBookingChildren("0");
    setBookingNotesText("");
    setSelectedNoteTags([]);
  };

  const handlePrevStep = () => {
    if (activeStep === 1) {
      onClose();
    } else {
      setActiveStep((prev) => prev - 1);
    }
  };

  const handleNextStep = () => {
    if (activeStep === 1) {
      if (!newFlight.trim()) {
        alert("Flight number is required.");
        return;
      }
      if (!newDate.trim()) {
        alert("Cancellation date is required.");
        return;
      }
      if (!newDepartureAirport) {
        alert("Departure airport is required.");
        return;
      }
      if (!newArrivalAirport) {
        alert("Arrival airport is required.");
        return;
      }
      if (newDepartureAirport === newArrivalAirport) {
        alert("Departure and Arrival airports cannot be the same.");
        return;
      }
      setActiveStep(2);
    } else if (activeStep === 2) {
      if (addedBookings.length === 0) {
        alert("Please add at least one booking (either manually or by uploading an Excel file).");
        return;
      }
      setActiveStep(3);
    } else if (activeStep === 7) {
      const added: Cancellation = {
        id: String(Date.now()),
        flight: newFlight,
        route: `${newDepartureAirport} ➔ ${newArrivalAirport}`,
        cancellationDate: formatDateString(newDate),
        bookings: totalBookingsCount,
        passengers: totalPassengersCount,
        totalCost: calculatedTotalCost,
        status: "Published",
        reason: newReason || "Not specified",
      };

      onSave(added);
    } else {
      setActiveStep((prev) => prev + 1);
    }
  };

  const renderStepper = () => {
    const steps = [
      { number: 1, label: "Flight Details", desc: "Basic information" },
      { number: 2, label: "Bookings", desc: "Upload passengers" },
      { number: 3, label: "Review", desc: "Verify details" },
      { number: 4, label: "Allocation", desc: "Assign hotels" },
      { number: 5, label: "Preview", desc: "Cost summary" },
      { number: 6, label: "Payment", desc: "Select card" },
      { number: 7, label: "Publish", desc: "Notify passengers" },
    ];

    return (
      <div className="w-full bg-white border border-[#E5E7EB] rounded-2xl p-6 overflow-x-auto">
        <div className="flex items-center justify-between min-w-[800px] px-4">
          {steps.map((step, idx) => {
            const isActive = activeStep === step.number;
            const isCompleted = activeStep > step.number;
            return (
              <div key={step.number} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center text-center">
                  <div
                    className={cn(
                      "size-10 rounded-full flex items-center justify-center text-base font-semibold transition-all duration-200 border",
                      isActive
                        ? "bg-[#0F2757] text-white border-[#0F2757]"
                        : isCompleted
                          ? "bg-[#10B981] text-white border-emerald-500"
                          : "bg-black text-gray-550 border-gray-200"
                    )}
                  >
                    {isCompleted ? <Check className="h-5 w-5" /> : step.number}
                  </div>
                  <span
                    className={cn(
                      "text-[14px] font-semibold mt-2 transition-colors",
                      isActive ? "text-[#1F2937]" : "text-gray-500"
                    )}
                  >
                    {step.label}
                  </span>
                  <span className="text-[12px] text-gray-400 mt-0.5 whitespace-nowrap">
                    {step.desc}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={cn(
                      "h-0.5 flex-1 mx-4 -translate-y-4 transition-all duration-305",
                      isCompleted ? "bg-emerald-500" : "bg-gray-200"
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderActiveStep = () => {
    switch (activeStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
              <div className="size-11 p-2.5 bg-slate-100 text-slate-700 rounded-xl flex justify-center items-center shrink-0">
                <Plane className="h-6 w-6 text-[#0F2757]" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-semibold text-gray-900 font-figtree">Flight Details</h3>
                <p className="text-sm text-gray-500 mt-0.5">Enter the cancelled flight information</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              <div className="flex flex-col gap-2">
                <label className="text-base font-semibold text-gray-700">Flight Number *</label>
                <input
                  type="text"
                  placeholder="e.g., SW1234"
                  value={newFlight}
                  onChange={(e) => setNewFlight(e.target.value)}
                  className="block h-11 w-full rounded-lg border border-[#D1D5DB] px-4 text-base text-gray-900 bg-[#F9FAFB] focus:bg-white focus:border-[#0F2757] focus:outline-none focus:ring-1 focus:ring-[#0F2757]"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-base font-semibold text-gray-700">Cancellation Date *</label>
                <DatePicker
                  value={newDate}
                  onChange={setNewDate}
                  className="block h-11 w-full rounded-lg border border-[#D1D5DB] px-4 text-base text-gray-900 bg-[#F9FAFB] focus:bg-white focus:border-[#0F2757] focus:outline-none focus:ring-1 focus:ring-[#0F2757]"
                  placeholder="Select date"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-base font-semibold text-gray-700">Departure Airport *</label>
                <Dropdown
                  value={newDepartureAirport}
                  onChange={setNewDepartureAirport}
                  options={AIRPORT_OPTIONS}
                  triggerWidthClass="w-full"
                  widthClass="w-full"
                  bgClass="bg-[#F9FAFB]"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-base font-semibold text-gray-700">Arrival Airport *</label>
                <Dropdown
                  value={newArrivalAirport}
                  onChange={setNewArrivalAirport}
                  options={AIRPORT_OPTIONS}
                  triggerWidthClass="w-full"
                  widthClass="w-full"
                  bgClass="bg-[#F9FAFB]"
                />
              </div>
            </div>

            <div className="flex flex-col gap-3.5 pt-2 text-left">
              <label className="text-base font-semibold text-gray-700">
                Cancellation Reason <span className="text-gray-400 font-normal">(Optional)</span>
              </label>

              <div className="flex flex-wrap gap-2">
                {[
                  "Weather disruption",
                  "Technical issue",
                  "Crew unavailability",
                  "Operational issue",
                  "Air traffic control",
                  "Other",
                ].map((tag) => {
                  const isSelected = selectedReasonTag === tag;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleTagClick(tag)}
                      className={cn(
                        "rounded-full border text-sm px-4 py-2 font-medium cursor-pointer transition-all duration-150",
                        isSelected
                          ? "bg-[#0F2757] text-white border-[#0F2757] shadow-sm"
                          : "bg-white hover:bg-slate-50 border-gray-200 text-gray-700 hover:border-gray-300"
                      )}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              <textarea
                placeholder="Enter or edit cancellation reason..."
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                rows={4}
                className="block w-full rounded-lg border border-[#D1D5DB] p-4 text-base text-gray-900 bg-[#F9FAFB] focus:bg-white focus:border-[#0F2757] focus:outline-none focus:ring-1 focus:ring-[#0F2757]"
              />
              <p className="text-xs text-gray-400">
                Select a common reason above or type a custom explanation. This can be updated later.
              </p>
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
              <div className="size-11 p-2.5 bg-slate-100 text-slate-700 rounded-xl flex justify-center items-center shrink-0">
                <Users className="h-6 w-6 text-[#0F2757]" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-semibold text-gray-900 font-figtree">Bookings & Passengers</h3>
                <p className="text-sm text-gray-500 mt-0.5">Add bookings for hotel room allocation</p>
              </div>
            </div>

            {/* Sub-view Tabs */}
            <div className="inline-flex p-1 bg-gray-100/80 rounded-xl mb-2">
              <button
                type="button"
                onClick={() => setBookingTab("upload")}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 text-[15px] font-medium rounded-lg transition-all duration-200 cursor-pointer",
                  bookingTab === "upload"
                    ? "bg-white text-[#0F2757] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <UploadCloud className="h-4 w-4" />
                <span>Upload Excel File</span>
              </button>
              <button
                type="button"
                onClick={() => setBookingTab("manual")}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 text-[15px] font-medium rounded-lg transition-all duration-200 cursor-pointer",
                  bookingTab === "manual"
                    ? "bg-white text-[#0F2757] shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Plus className="h-4 w-4" />
                <span>Add Manually</span>
              </button>
            </div>

            {bookingTab === "upload" ? (
              <div className="pt-2">
                <div
                  className={cn(
                    "border border-dashed rounded-xl py-12 px-6 flex flex-col items-center justify-center text-center transition-colors duration-200",
                    isManifestUploaded
                      ? "border-emerald-300 bg-emerald-50/20 cursor-pointer"
                      : "border-gray-300 bg-[#FAFAFA]"
                  )}
                  onClick={!isManifestUploaded ? undefined : simulateExcelUpload}
                >
                  <div className="size-[52px] rounded-full bg-[#E5E7EB] flex items-center justify-center mb-4">
                    <Upload className={cn("h-6 w-6", isManifestUploaded ? "text-emerald-600" : "text-[#374151]")} />
                  </div>

                  {isManifestUploaded ? (
                    <div>
                      <h4 className="text-lg font-semibold text-emerald-800 mb-1">{manifestFileName}</h4>
                      <p className="text-sm text-emerald-600">Upload complete. Parsed {addedBookings.length} bookings successfully.</p>
                    </div>
                  ) : (
                    <>
                      <h4 className="text-[18px] font-semibold text-[#111827] mb-2 font-figtree">Upload Booking File</h4>
                      <p className="text-[15px] text-[#6B7280] mb-6 max-w-[400px]">
                        Drag and drop an Excel file containing booking data, or click to browse your files
                      </p>
                      <button
                        type="button"
                        onClick={simulateExcelUpload}
                        className="h-[42px] bg-[#233159] hover:bg-[#1A2542] text-white px-6 rounded-[8px] font-medium text-[15px] flex items-center gap-2 mb-4 transition-colors cursor-pointer"
                      >
                        <Upload className="h-4 w-4" />
                        Choose File
                      </button>
                      <p className="text-[13px] text-[#9CA3AF]">
                        Supports .xlsx, .xls, .csv • Max 10MB
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-4 text-left">
                <h4 className="font-semibold text-gray-900 text-base">
                  {editingBookingId ? "Edit Booking" : "Add New Booking"}
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-base font-semibold text-gray-600">Booking Reference (PNR) *</label>
                    <input
                      type="text"
                      placeholder="e.g., ABC123"
                      value={bookingPnr}
                      onChange={(e) => setBookingPnr(e.target.value)}
                      className="block h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-base text-gray-900 bg-[#F9FAFB] focus:bg-white focus:border-[#0F2757] focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-base font-semibold text-gray-600">First Name *</label>
                    <input
                      type="text"
                      placeholder="John"
                      value={bookingFirstName}
                      onChange={(e) => setBookingFirstName(e.target.value)}
                      className="block h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-base text-gray-900 bg-[#F9FAFB] focus:bg-white focus:border-[#0F2757] focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-base font-semibold text-gray-600">Last Name *</label>
                    <input
                      type="text"
                      placeholder="Doe"
                      value={bookingLastName}
                      onChange={(e) => setBookingLastName(e.target.value)}
                      className="block h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-base text-gray-900 bg-[#F9FAFB] focus:bg-white focus:border-[#0F2757] focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-base font-semibold text-gray-600">Email *</label>
                    <input
                      type="email"
                      placeholder="john@email.com"
                      value={bookingEmail}
                      onChange={(e) => setBookingEmail(e.target.value)}
                      className="block h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-base text-gray-900 bg-[#F9FAFB] focus:bg-white focus:border-[#0F2757] focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-base font-semibold text-gray-600">Phone *</label>
                    <input
                      type="text"
                      placeholder="+1 555-0100"
                      value={bookingPhone}
                      onChange={(e) => setBookingPhone(e.target.value)}
                      className="block h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-base text-gray-900 bg-[#F9FAFB] focus:bg-white focus:border-[#0F2757] focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-base font-semibold text-gray-600">Travel Class *</label>
                    <Dropdown
                      value={bookingClass}
                      onChange={setBookingClass}
                      options={TRAVEL_CLASS_OPTIONS}
                      triggerWidthClass="w-full"
                      widthClass="w-full"
                      bgClass="bg-[#F9FAFB]"
                      heightClass="h-10"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-base font-semibold text-gray-600">Adults *</label>
                    <input
                      type="number"
                      min={1}
                      value={bookingAdults}
                      onChange={(e) => setBookingAdults(e.target.value)}
                      className="block h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-base text-gray-900 bg-[#F9FAFB] focus:bg-white focus:border-[#0F2757] focus:outline-none"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-base font-semibold text-gray-600">Children</label>
                    <input
                      type="number"
                      min={0}
                      value={bookingChildren}
                      onChange={(e) => setBookingChildren(e.target.value)}
                      className="block h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-base text-gray-900 bg-[#F9FAFB] focus:bg-white focus:border-[#0F2757] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2 pt-1.5">
                  <label className="text-base font-semibold text-gray-600">Special Notes (Optional)</label>
                  <div className="flex flex-wrap gap-1.5 mb-1.5">
                    {[
                      "Wheelchair Assistance",
                      "Medical Needs",
                      "Infant",
                      "Late Arrival",
                      "Dietary Requirements",
                      "Elderly Passenger",
                    ].map((tag) => {
                      const isSelected = selectedNoteTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleNoteTagClick(tag)}
                          className={cn(
                            "rounded-full border text-xs px-3 py-1.5 font-medium cursor-pointer transition-all",
                            isSelected
                              ? "bg-[#0F2757] text-white border-[#0F2757]"
                              : "bg-white hover:bg-slate-55 border-gray-200 text-gray-600 hover:border-gray-300"
                          )}
                        >
                          {tag}
                        </button>
                      );
                    })}
                  </div>

                  <input
                    type="text"
                    placeholder="Additional notes (free text)"
                    value={bookingNotesText}
                    onChange={(e) => setBookingNotesText(e.target.value)}
                    className="block h-10 w-full rounded-lg border border-[#D1D5DB] px-3 text-base text-gray-900 bg-[#F9FAFB] focus:bg-white focus:border-[#0F2757] focus:outline-none"
                  />
                </div>

                {/* Info Alert Box */}
                <div className="bg-[#EFF6FF] border border-[#D1D5DB] p-4 rounded-lg flex items-start gap-3 text-left">
                  <HelpCircle className="h-5 w-5 text-blue-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-900 leading-relaxed font-figtree">
                    Each booking can contain multiple passengers. Room allocation: 2 passengers per room. Business class passengers are assigned 4-star hotels, economy passengers get 3-star hotels.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddBooking}
                  className="bg-[#0F2757] hover:bg-[#162259] text-white font-medium py-2 px-4 rounded-lg transition-colors cursor-pointer text-sm inline-flex items-center gap-1.5"
                >
                  <Plus className="h-4 w-4" />
                  <span>{editingBookingId ? "Save Booking" : "Add Booking"}</span>
                </button>
              </div>
            )}

            {/* Bookings List / Table */}
            <div className="border border-gray-200 rounded-xl bg-white p-5 space-y-4">
              {addedBookings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center text-gray-505">
                  <Users className="h-10 w-10 text-gray-300 mb-3" />
                  <p className="text-sm font-medium text-gray-700">No bookings added yet.</p>
                  <p className="text-xs text-gray-400 mt-1">Use the form above to add your first booking.</p>
                </div>
              ) : (
                <div className="space-y-4 text-left">
                  {/* Summary Grid stats */}
                  <div className="grid grid-cols-4 border border-gray-200 rounded-xl divide-x divide-gray-200 bg-gray-50/50 py-3 text-center">
                    <div>
                      <div className="text-xl font-bold text-gray-900">{addedBookings.length}</div>
                      <div className="text-[11px] font-semibold text-gray-505 uppercase tracking-wider mt-0.5">Bookings</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-gray-900">
                        {totalPassengersCount}
                      </div>
                      <div className="text-[11px] font-semibold text-gray-505 uppercase tracking-wider mt-0.5">Passengers</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-gray-950">
                        {addedBookings.reduce((sum, b) => sum + Math.ceil((b.adults + b.children) / 2), 0)}
                      </div>
                      <div className="text-[11px] font-semibold text-gray-505 uppercase tracking-wider mt-0.5">Est. Rooms</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-gray-900">
                        {addedBookings.filter(b => b.travelClass === "Business" || b.travelClass === "First Class").length}
                      </div>
                      <div className="text-[11px] font-semibold text-gray-505 uppercase tracking-wider mt-0.5">Business</div>
                    </div>
                  </div>

                  {/* Bookings Table */}
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-55 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                        <tr>
                          <th className="px-4 py-3 text-left">PNR</th>
                          <th className="px-4 py-3 text-left">Contact Name</th>
                          <th className="px-4 py-3 text-left">Email</th>
                          <th className="px-4 py-3 text-left">Phone</th>
                          <th className="px-4 py-3 text-center">Adults</th>
                          <th className="px-4 py-3 text-center">Children</th>
                          <th className="px-4 py-3 text-center">Class</th>
                          <th className="px-4 py-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white text-gray-700">
                        {addedBookings.map((b) => (
                          <tr key={b.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-3.5 font-medium text-gray-900">{b.pnr}</td>
                            <td className="px-4 py-3.5">{b.firstName} {b.lastName}</td>
                            <td className="px-4 py-3.5 text-gray-550">{b.email}</td>
                            <td className="px-4 py-3.5 text-gray-550">{b.phone}</td>
                            <td className="px-4 py-3.5 text-center">{b.adults}</td>
                            <td className="px-4 py-3.5 text-center">{b.children}</td>
                            <td className="px-4 py-3.5 text-center">
                              <span className={cn(
                                "rounded px-2.5 py-1 text-xs font-semibold inline-block",
                                b.travelClass === "Business" || b.travelClass === "First Class"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-gray-100 text-gray-700"
                              )}>
                                {b.travelClass}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditBooking(b)}
                                  className="text-gray-400 hover:text-[#0F2757] transition-colors cursor-pointer"
                                  title="Edit"
                                >
                                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                  </svg>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBooking(b.id)}
                                  className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                  title="Delete"
                                >
                                  <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 bg-slate-100/50 p-4 rounded-xl">
              <div className="size-10 bg-slate-200/50 text-slate-700 rounded-lg flex justify-center items-center shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-gray-900 font-figtree">Review Bookings</h3>
                <p className="text-sm text-gray-500 mt-0.5">Verify booking details before hotel allocation</p>
              </div>
            </div>

            <div className="flex items-center justify-between bg-gray-50/50 border border-gray-100 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Plane className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Flight</p>
                  <p className="font-semibold text-gray-900 text-base">{newFlight || "TRE"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Route</p>
                  <p className="font-semibold text-gray-900 text-base">{newDepartureAirport && newArrivalAirport ? `${newDepartureAirport} ➔ ${newArrivalAirport}` : "LAX ➔ ORD"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Date</p>
                  <p className="font-semibold text-gray-900 text-base">{newDate ? new Date(newDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : "Aug 19"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div>
                  <p className="text-xs text-gray-500">Reason</p>
                  <p className="font-semibold text-gray-900 text-base">{newReason || selectedReasonTag || "Weather disruption"}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="bg-gray-100 rounded-xl p-5 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-gray-900">{totalBookingsCount || 1}</span>
                <span className="text-xs text-gray-600 mt-1 font-medium">Total Bookings</span>
              </div>
              <div className="bg-gray-100 rounded-xl p-5 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-gray-900">{totalPassengersCount || 1}</span>
                <span className="text-xs text-gray-600 mt-1 font-medium">Total Passengers</span>
              </div>
              <div className="bg-gray-100 rounded-xl p-5 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-gray-900">{addedBookings.reduce((sum, b) => sum + Math.ceil((b.adults + b.children) / 2), 0) || 1}</span>
                <span className="text-xs text-gray-600 mt-1 font-medium">Est. Rooms Required</span>
              </div>
              <div className="bg-gray-100 rounded-xl p-5 flex flex-col items-center justify-center text-center">
                <span className="text-2xl font-bold text-gray-900">{addedBookings.filter(b => b.travelClass === "Business" || b.travelClass === "First Class").length || 0}</span>
                <span className="text-xs text-gray-600 mt-1 font-medium">Business Class</span>
              </div>
            </div>

            <div className="overflow-x-auto border-t border-gray-100 pt-2">
              <table className="min-w-full text-sm text-left">
                <thead className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-3">PNR</th>
                    <th className="px-4 py-3">CONTACT</th>
                    <th className="px-4 py-3">EMAIL</th>
                    <th className="px-4 py-3">ADULTS</th>
                    <th className="px-4 py-3">CHILDREN</th>
                    <th className="px-4 py-3">CLASS</th>
                    <th className="px-4 py-3">EST. ROOMS</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700">
                  {(addedBookings.length > 0 ? addedBookings : [{
                    id: "1", pnr: "DDJU", firstName: "New", lastName: "Admin", email: "ops@summitair.com", adults: 1, children: 0, travelClass: "Economy"
                  }]).map((b, idx) => (
                    <tr key={b.id || idx} className="border-b border-gray-50 last:border-0">
                      <td className="px-4 py-3.5 font-medium text-gray-900">{b.pnr}</td>
                      <td className="px-4 py-3.5">{b.firstName} {b.lastName}</td>
                      <td className="px-4 py-3.5 text-gray-500">{b.email}</td>
                      <td className="px-4 py-3.5">{b.adults}</td>
                      <td className="px-4 py-3.5">{b.children}</td>
                      <td className="px-4 py-3.5">{b.travelClass}</td>
                      <td className="px-4 py-3.5">{Math.ceil((b.adults + b.children) / 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      case 4:
        if (isAllocating) {
          return (
            <div className="flex flex-col items-center justify-center py-6 space-y-6 animate-in fade-in zoom-in duration-300">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 text-[#0F2757] animate-spin" />
                <div className="text-center">
                  <h3 className="text-xl font-semibold text-gray-900 font-figtree">Allocating Hotels...</h3>
                  <p className="text-sm text-gray-500 mt-1">Finding the best hotels for your passengers...</p>
                </div>
              </div>

              <div className="w-full max-w-md bg-white border border-gray-100 shadow-sm rounded-xl p-5 space-y-4">
                {[
                  { step: 1, label: "Analyzing booking requirements" },
                  { step: 2, label: "Checking hotel availability" },
                  { step: 3, label: "Optimizing room assignments" },
                  { step: 4, label: "Calculating costs" }
                ].map((item) => {
                  const isCompleted = allocationProgress >= item.step;
                  const isCurrent = allocationProgress === item.step - 1;

                  return (
                    <div key={item.step} className="flex items-center gap-3 text-sm font-medium">
                      {isCompleted ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 className="h-5 w-5 text-[#0F2757] animate-spin shrink-0" />
                      ) : (
                        <Circle className="h-5 w-5 text-gray-300 shrink-0" />
                      )}
                      <span className={isCompleted ? "text-gray-900" : isCurrent ? "text-gray-900" : "text-gray-400"}>
                        {item.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="w-full max-w-md bg-gray-50 rounded-xl p-4 flex items-start gap-3 border border-gray-200">
                <Info className="h-5 w-5 text-gray-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-gray-900">You can safely navigate away</p>
                  <p className="text-xs text-gray-500 mt-0.5">This process continues in the background. We'll notify you when allocation is complete.</p>
                </div>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 bg-slate-50 border border-gray-100 p-4 rounded-xl">
              <div className="size-10 bg-[#0F2757]/10 text-[#0F2757] rounded-lg flex justify-center items-center shrink-0 border border-[#0F2757]/20">
                <Building2 className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-gray-900 font-figtree">Hotel Allocation</h3>
                <p className="text-sm text-gray-500 mt-0.5">Our AI-powered system will automatically assign hotels based on:</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 w-full">
              <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5 flex flex-col items-center text-center">
                <Plane className="h-6 w-6 text-blue-500 mb-3" />
                <h4 className="font-semibold text-gray-900 text-sm">Travel Class</h4>
                <p className="text-xs text-gray-500 mt-1">Business / Economy preferences</p>
              </div>
              <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5 flex flex-col items-center text-center">
                <Building2 className="h-6 w-6 text-rose-500 mb-3" />
                <h4 className="font-semibold text-gray-900 text-sm">Availability</h4>
                <p className="text-xs text-gray-500 mt-1">Real-time hotel inventory</p>
              </div>
              <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5 flex flex-col items-center text-center">
                <Settings className="h-6 w-6 text-purple-500 mb-3" />
                <h4 className="font-semibold text-gray-900 text-sm">Preferences</h4>
                <p className="text-xs text-gray-500 mt-1">Your airline's settings</p>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setIsAllocating(true);
                  setAllocationProgress(0);
                }}
                className="bg-[#2B3B67] hover:bg-[#1E2B4D] text-white font-medium py-2.5 px-6 rounded-lg transition-colors cursor-pointer text-sm inline-flex items-center gap-2"
              >
                <Building2 className="h-5 w-5" />
                <span>Allocate Hotel Reservations</span>
              </button>
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 bg-slate-50 border border-gray-100 p-4 rounded-xl">
              <div className="size-10 bg-emerald-50 text-emerald-600 rounded-lg flex justify-center items-center shrink-0 border border-emerald-100">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-gray-900 font-figtree">Allocation Preview</h3>
                <p className="text-sm text-gray-500 mt-0.5">Review hotel assignments and costs</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead className="bg-gray-50/80 text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  <tr>
                    <th className="px-4 py-3">BOOKING REF</th>
                    <th className="px-4 py-3">CONTACT</th>
                    <th className="px-4 py-3">CLASS</th>
                    <th className="px-4 py-3">PASSENGERS</th>
                    <th className="px-4 py-3">HOTEL</th>
                    <th className="px-4 py-3">RATING</th>
                    <th className="px-4 py-3">ROOMS</th>
                    <th className="px-4 py-3">TOTAL COST</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 divide-y divide-gray-100 border-b border-gray-200">
                  {(addedBookings.length > 0 ? addedBookings : [{
                    id: "1", pnr: "AAAAA", firstName: "New", lastName: "Admin", email: "ops@summitair.com", adults: 1, children: 0, travelClass: "Economy"
                  }]).map((b, idx) => {
                    const isBusiness = b.travelClass === "Business" || b.travelClass === "First Class";
                    const hotelName = isBusiness ? "Hyatt Regency LAX" : "Holiday Inn Express LAX";
                    const stars = isBusiness ? 4 : 3;
                    const rooms = Math.ceil((b.adults + b.children) / 2);
                    const cost = rooms * (isBusiness ? 160 : 120);

                    return (
                      <tr key={b.id || idx}>
                        <td className="px-4 py-4 font-medium text-gray-900">{b.pnr}</td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-gray-900">{b.firstName} {b.lastName}</p>
                          <p className="text-xs text-gray-500">{b.email}</p>
                        </td>
                        <td className="px-4 py-4">{b.travelClass}</td>
                        <td className="px-4 py-4">{b.adults + b.children} {b.adults + b.children > 1 ? "Passengers" : "Adult"}</td>
                        <td className="px-4 py-4 font-medium max-w-[120px]">{hotelName}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center text-amber-400">
                            {[...Array(stars)].map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-current" />
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4">{rooms}</td>
                        <td className="px-4 py-4 font-semibold text-gray-900">${cost}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 flex justify-between items-center text-base">
              <span className="font-semibold text-gray-900">Total Hotel Cost</span>
              <span className="font-bold text-gray-900 text-xl">${calculatedTotalCost || 120}</span>
            </div>
          </div>
        );
      case 6:
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4">
              <div className="size-11 p-2.5 bg-slate-100 text-slate-700 rounded-xl flex justify-center items-center shrink-0">
                <CreditCard className="h-6 w-6 text-[#0F2757]" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-semibold text-gray-900 font-figtree">Payment Method</h3>
                <p className="text-sm text-gray-500 mt-0.5">Select the card to charge for these hotel bookings</p>
              </div>
            </div>

            <div className="space-y-4 text-left">
              <AddCardModal isOpen={isAddingCard} onClose={() => setIsAddingCard(false)} />

              {[
                { id: "visa", type: "card", title: "Visa", number: "4242", expires: "08/28", isDefault: true },
                { id: "mastercard", type: "card", title: "Mastercard", number: "5599", expires: "03/27", isDefault: false },
              ].map((method) => {
                const isSelected = paymentMethod === method.id;
                return (
                  <div
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={cn(
                      "p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all duration-150",
                      isSelected ? "border-[#0F2757] bg-[#0F2757]/5 ring-1 ring-[#0F2757]" : "border-gray-200 hover:border-gray-300 bg-gray-50/30"
                    )}
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className="size-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-slate-650 shrink-0 shadow-2xs">
                        <CreditCard className="h-5 w-5 text-gray-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">{method.title} •••• {method.number}</p>
                          {method.isDefault && (
                            <span className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full font-medium ml-2 font-figtree">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">Expires {method.expires}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center">
                      {isSelected ? (
                        <div className="size-5 bg-[#0F2757] text-white rounded-full flex items-center justify-center p-0.5 shrink-0 shadow-xs">
                          <Check className="h-3 w-3 stroke-[2.5]" />
                        </div>
                      ) : (
                        <div className="size-5" />
                      )}
                    </div>
                  </div>
                );
              })}

              <div className="flex items-center gap-3 mt-1.5">
                <button
                  type="button"
                  onClick={() => setIsAddingCard(true)}
                  className="flex items-center gap-1.5 py-2.5 px-4 border border-[#D1D5DB] text-sm font-semibold hover:bg-gray-50 cursor-pointer bg-white text-[#1F2937] shadow-2xs rounded-lg"
                >
                  <Plus className="h-4 w-4 text-gray-500" />
                  Add New Card
                </button>

                {paymentMethod !== "visa" && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.success("Card set as default successfully!");
                      setPaymentMethod("visa");
                    }}
                    className="flex items-center gap-1.5 py-2.5 px-4 text-sm font-semibold text-[#1F2937] hover:bg-gray-50 cursor-pointer bg-transparent rounded-lg"
                  >
                    Make default card
                  </button>
                )}
              </div>
            </div>

            <div className="bg-gray-50/80 rounded-xl p-6 mt-4 space-y-4 text-left text-sm border border-gray-100">
              <div className="flex justify-between items-center text-gray-500">
                <span>Hotel cost (charged to your card)</span>
                <span className="font-semibold text-gray-900">${hotelRoomsCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-gray-500">
                <span>Platform service fee (5%)</span>
                <span className="font-semibold text-gray-900">${platformFee.toLocaleString()}</span>
              </div>
              <div className="h-px bg-gray-200 w-full" />
              <div className="flex justify-between items-center font-semibold text-gray-900 text-base">
                <span>Charged now to card</span>
                <span className="text-lg font-bold">${hotelRoomsCost.toLocaleString()}</span>
              </div>
            </div>

            <div className="bg-slate-100/70 border border-slate-200 p-4 rounded-xl text-sm flex items-start gap-3 text-left">
              <Info className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
              <p className="text-slate-600 text-xs">
                The service fee of ${platformFee.toLocaleString()} is added to your outstanding platform balance ($6,287 of $25,000 credit limit used) and paid periodically from the Billing page.
              </p>
            </div>

            <button
              type="button"
              onClick={handleNextStep}
              className="w-full bg-[#0F2757] hover:bg-[#162259] text-white font-medium py-3 px-4 rounded-lg mt-6 transition-colors flex items-center justify-center text-base cursor-pointer shadow-xs"
            >
              Pay ${hotelRoomsCost.toLocaleString()}
            </button>
          </div>
        );
      case 7:
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-start gap-3 bg-slate-50 border border-gray-100 p-4 rounded-xl">
              <div className="size-10 bg-[#0F2757]/10 text-[#0F2757] rounded-lg flex justify-center items-center shrink-0 border border-[#0F2757]/20">
                <Send className="h-5 w-5" />
              </div>
              <div className="text-left flex-1">
                <h3 className="text-lg font-semibold text-gray-900 font-figtree">Ready to Publish</h3>
                <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">
                  Publishing will charge the hotel cost to your selected card, finalize the hotel bookings and send confirmation PDF emails to all booking contact addresses.
                </p>
              </div>
            </div>

            <div className="w-full bg-orange-50/50 border border-orange-200 p-3.5 rounded-xl text-sm">
              <p className="text-orange-600 text-xs font-medium">
                <span className="font-bold">Note:</span> This action cannot be undone. Passengers will receive their hotel booking confirmations immediately.
              </p>
            </div>

            <div className="w-full bg-gray-50/80 rounded-xl p-5 space-y-3 text-left text-sm border border-gray-100">
              <div className="flex justify-between items-center text-gray-600">
                <span>Total Bookings:</span>
                <span className="font-semibold text-gray-900">{totalBookingsCount}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Total Passengers:</span>
                <span className="font-semibold text-gray-900">{totalPassengersCount}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600 pt-3 border-t border-gray-200/60 mt-1">
                <span>Total Hotel Cost:</span>
                <span className="font-bold text-gray-900 text-base">${hotelRoomsCost.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Charged to:</span>
                <span className="font-bold text-gray-900 text-base uppercase">
                  {paymentMethod === "visa" ? "VISA •••• 4242" : paymentMethod === "mastercard" ? "MASTERCARD •••• 5599" : "CORP CARD"}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span>Platform service fee (billed later):</span>
                <span className="font-semibold text-gray-900">${platformFee.toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  onSave({
                    id: Math.random().toString(36).substring(7),
                    flight: newFlight || "TRE",
                    route: newDepartureAirport && newArrivalAirport ? `${newDepartureAirport} ➔ ${newArrivalAirport}` : "LAX ➔ ORD",
                    cancellationDate: newDate ? new Date(newDate).toISOString() : new Date().toISOString(),
                    bookings: totalBookingsCount || 1,
                    passengers: totalPassengersCount || 1,
                    totalCost: calculatedTotalCost || 120,
                    status: "Published",
                    reason: newReason || selectedReasonTag || "Weather disruption",
                  });
                }}
                className="bg-[#2B3B67] hover:bg-[#1E2B4D] text-white font-medium py-2.5 px-6 rounded-lg transition-colors cursor-pointer text-sm inline-flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                <span>Pay & Publish</span>
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-7 text-left">
      {/* Back Link */}
      <div className="flex items-center">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-900 cursor-pointer transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Cancelled Flights</span>
        </button>
      </div>

      {/* Stepper */}
      {renderStepper()}

      {/* Form Card */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8">
        {renderActiveStep()}

        {/* Footer Actions */}
        {activeStep !== 4 && (
          <div className="mt-8 pt-6 flex items-center justify-between">
            <button
              onClick={handlePrevStep}
              className="flex items-center gap-2 border border-gray-300 bg-gray-55 hover:bg-gray-100 text-gray-700 font-medium py-2.5 px-5 rounded-lg transition-colors cursor-pointer text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back</span>
            </button>

            {activeStep !== 7 && activeStep !== 6 && (
              <button
                onClick={handleNextStep}
                className="flex items-center gap-2 bg-[#0F2757] hover:bg-[#162259] text-white font-medium py-2.5 px-5 rounded-lg transition-colors cursor-pointer text-sm"
              >
                <span>{activeStep === 5 ? "Continue to Payment" : "Continue"}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
