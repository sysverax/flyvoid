"use client";

import { useState, useEffect, useMemo, useRef, Fragment } from "react";
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
  Edit,
  Trash2,
  Bed,
  Percent,
  DollarSign,
  Wallet,
  Eye,
} from "lucide-react";
import { BookingDetailsDrawer } from "@/src/components/ui/BookingDetailsDrawer";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";
import { Pagination } from "@/src/components/ui/pagination";
import { toast } from "react-toastify";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { DatePicker } from "@/src/components/ui/DatePicker";
import { AddCardModal } from "@/src/components/ui/AddCardModal";
import { cn } from "@/src/lib/utils";
import { cancellationService, CreateBookingPayload, BookingDTO } from "@/src/services/cancellation.service";

const NOTE_TAG_TO_ENUM: Record<string, string> = {
  "Wheelchair Assistance": "wheelchair_assistance",
  "Medical Needs": "medical_needs",
  "Infant": "infant",
  "Late Arrival": "late_arrival",
  "Dietary Requirements": "dietary_requirements",
  "Elderly Passenger": "elderly_passenger",
};

const ENUM_TO_NOTE_TAG: Record<string, string> = {
  wheelchair_assistance: "Wheelchair Assistance",
  medical_needs: "Medical Needs",
  infant: "Infant",
  late_arrival: "Late Arrival",
  dietary_requirements: "Dietary Requirements",
  elderly_passenger: "Elderly Passenger",
};

const AIRPORT_ID_MAP: Record<string, number> = {
  LAX: 1,
  JFK: 2,
  LHR: 3,
  HND: 4,
  CDG: 5,
  SIN: 6,
  FRA: 7,
};

function getAirportId(val: string): number {
  if (!val) return 1;
  const parsed = parseInt(val, 10);
  if (!isNaN(parsed) && parsed > 0) return parsed;
  return AIRPORT_ID_MAP[val.toUpperCase()] || 1;
}

function mapCancellationReason(tag: string, text: string): string {
  const combined = (tag + " " + text).toLowerCase();
  if (combined.includes("weather")) return "weather_disruption";
  if (combined.includes("tech") || combined.includes("engine") || combined.includes("maintenance")) return "technical_issue";
  if (combined.includes("crew") || combined.includes("pilot") || combined.includes("staff")) return "crew_unavailability";
  if (combined.includes("operation")) return "operational_issue";
  if (combined.includes("traffic") || combined.includes("atc") || combined.includes("control")) return "air_traffic_control";
  return "weather_disruption";
}

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
  status: "Published" | "Verified" | "Allocated" | "Draft" | "Paid";
  reason: string;
}

interface CancellationWizardProps {
  onClose: () => void;
  onSave: (added: Cancellation) => void;
  initialData?: Cancellation | null;
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

function getInitialStepFromStatus(status?: string): number {
  if (!status) return 1;
  const s = status.toLowerCase();
  if (s === "draft") return 1;
  if (s === "verified") return 4;
  if (s === "allocated") return 5;
  if (s === "paid") return 7;
  return 1;
}

export default function CancellationWizard({ onClose, onSave, initialData }: CancellationWizardProps) {
  const [activeStep, setActiveStep] = useState(() => getInitialStepFromStatus(initialData?.status));

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeStep]);

  // Flight Details Form Inputs
  const routeParts = initialData?.route ? initialData.route.split(/➔|->|→/).map((s) => s.trim()) : [];
  const [newFlight, setNewFlight] = useState(initialData?.flight || "");
  const [newDate, setNewDate] = useState(initialData?.cancellationDate || "");
  const [newDepartureAirport, setNewDepartureAirport] = useState(routeParts[0] || "");
  const [newArrivalAirport, setNewArrivalAirport] = useState(routeParts[1] || "");
  const [checkInDate, setCheckInDate] = useState(initialData?.cancellationDate || "");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [selectedReasonTag, setSelectedReasonTag] = useState("");
  const [newReason, setNewReason] = useState(initialData?.reason || "");

  // Step 1 Validation & Error State (matching admin invite modal)
  type Step1Field = "flightNumber" | "cancellationDate" | "departureAirport" | "arrivalAirport" | "checkInDate" | "checkOutDate";
  const [step1Errors, setStep1Errors] = useState<Partial<Record<Step1Field, string>>>({});
  const [step1Touched, setStep1Touched] = useState<Partial<Record<Step1Field, boolean>>>({});

  const validateStep1 = (
    field: Step1Field,
    val: string,
    currentValues?: { departureAirport?: string; arrivalAirport?: string; checkInDate?: string; checkOutDate?: string }
  ): string => {
    const v = val?.trim() ?? "";
    switch (field) {
      case "flightNumber":
        if (!v) return "Flight Number is required";
        if (!/^[A-Z0-9]+$/i.test(v)) return "Flight Number must contain only letters and numbers";
        return "";
      case "cancellationDate":
        if (!v) return "Cancellation Date is required";
        return "";
      case "departureAirport":
        if (!v) return "Departure Airport is required";
        return "";
      case "arrivalAirport":
        if (!v) return "Arrival Airport is required";
        const dep = currentValues?.departureAirport ?? newDepartureAirport;
        if (dep && dep === val) return "Departure and Arrival airports cannot be the same";
        return "";
      case "checkInDate":
        if (!v) return "Default Check-in Date is required";
        return "";
      case "checkOutDate":
        if (!v) return "Default Check-out Date is required";
        const cIn = currentValues?.checkInDate ?? checkInDate;
        if (cIn && v && new Date(v) <= new Date(cIn)) {
          return "Check-out Date must be after Check-in Date";
        }
        return "";
      default:
        return "";
    }
  };

  const handleStep1Blur = (field: Step1Field) => () => {
    setStep1Touched((prev) => ({ ...prev, [field]: true }));
    const val =
      field === "flightNumber" ? newFlight :
      field === "cancellationDate" ? newDate :
      field === "departureAirport" ? newDepartureAirport :
      field === "arrivalAirport" ? newArrivalAirport :
      field === "checkInDate" ? checkInDate :
      checkOutDate;
    const msg = validateStep1(field, val);
    setStep1Errors((prev) => ({ ...prev, [field]: msg || undefined }));
  };

  const handleFlightChange = (val: string) => {
    setNewFlight(val);
    if (step1Touched.flightNumber) {
      const msg = validateStep1("flightNumber", val);
      setStep1Errors((prev) => ({ ...prev, flightNumber: msg || undefined }));
    }
  };

  const handleDateChange = (val: string) => {
    setNewDate(val);
    if (step1Touched.cancellationDate) {
      const msg = validateStep1("cancellationDate", val);
      setStep1Errors((prev) => ({ ...prev, cancellationDate: msg || undefined }));
    }
  };

  const handleDepartureAirportChange = (val: string) => {
    setNewDepartureAirport(val);
    if (step1Touched.departureAirport) {
      const msg = validateStep1("departureAirport", val);
      setStep1Errors((prev) => ({ ...prev, departureAirport: msg || undefined }));
    }
    if (step1Touched.arrivalAirport && newArrivalAirport) {
      const msg = validateStep1("arrivalAirport", newArrivalAirport, { departureAirport: val });
      setStep1Errors((prev) => ({ ...prev, arrivalAirport: msg || undefined }));
    }
  };

  const handleArrivalAirportChange = (val: string) => {
    setNewArrivalAirport(val);
    if (step1Touched.arrivalAirport) {
      const msg = validateStep1("arrivalAirport", val, { departureAirport: newDepartureAirport });
      setStep1Errors((prev) => ({ ...prev, arrivalAirport: msg || undefined }));
    }
  };

  const handleCheckInDateChange = (val: string) => {
    setCheckInDate(val);
    if (step1Touched.checkInDate) {
      const msg = validateStep1("checkInDate", val);
      setStep1Errors((prev) => ({ ...prev, checkInDate: msg || undefined }));
    }
    if (step1Touched.checkOutDate && checkOutDate) {
      const msg = validateStep1("checkOutDate", checkOutDate, { checkInDate: val });
      setStep1Errors((prev) => ({ ...prev, checkOutDate: msg || undefined }));
    }
  };

  const handleCheckOutDateChange = (val: string) => {
    setCheckOutDate(val);
    if (step1Touched.checkOutDate) {
      const msg = validateStep1("checkOutDate", val, { checkInDate });
      setStep1Errors((prev) => ({ ...prev, checkOutDate: msg || undefined }));
    }
  };

  useEffect(() => {
    if (initialData) {
      setActiveStep(getInitialStepFromStatus(initialData.status));
      if (initialData.status?.toLowerCase() === "paid") {
        setPaymentConfirmed(true);
      }
      setNewFlight(initialData.flight || "");
      setNewDate(initialData.cancellationDate || "");
      const parts = initialData.route ? initialData.route.split(/➔|->|→/).map((s) => s.trim()) : [];
      setNewDepartureAirport(parts[0] || "");
      setNewArrivalAirport(parts[1] || "");
      setNewReason(initialData.reason || "");
    }
  }, [initialData]);

  useEffect(() => {
    if (newDate) {
      setCheckInDate(newDate);
      const dateObj = new Date(newDate);
      if (!isNaN(dateObj.getTime())) {
        dateObj.setDate(dateObj.getDate() + 1);
        setCheckOutDate(dateObj.toISOString().split("T")[0]);
      }
    }
  }, [newDate]);

  // Step 2 Manual booking states
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bookingTab, setBookingTab] = useState<"upload" | "manual">("manual");
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(5);
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

  // Step 2 Validation & Error State (matching admin invite modal)
  type Step2Field = "pnr" | "firstName" | "lastName" | "email" | "phone" | "travelClass" | "adults";
  const [step2Errors, setStep2Errors] = useState<Partial<Record<Step2Field, string>>>({});
  const [step2Touched, setStep2Touched] = useState<Partial<Record<Step2Field, boolean>>>({});

  const validateStep2 = (field: Step2Field, val: string): string => {
    const v = val?.trim() ?? "";
    switch (field) {
      case "pnr":
        if (!v) return "Booking Reference (PNR) is required";
        return "";
      case "firstName":
        if (!v) return "First Name is required";
        return "";
      case "lastName":
        if (!v) return "Last Name is required";
        return "";
      case "email":
        if (!v) return "Email is required";
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "Please enter a valid email address";
        return "";
      case "phone":
        if (!v) return "Phone number is required";
        if (!/^[\+]?[\d\s\-\(\)]{7,20}$/.test(v)) return "Please enter a valid phone number";
        return "";
      case "travelClass":
        if (!v) return "Travel Class is required";
        return "";
      case "adults":
        if (!v) return "Number of adults is required";
        if (isNaN(Number(v)) || Number(v) < 1) return "Adults must be at least 1";
        return "";
      default:
        return "";
    }
  };

  const handleStep2Blur = (field: Step2Field) => () => {
    setStep2Touched((prev) => ({ ...prev, [field]: true }));
    const val =
      field === "pnr" ? bookingPnr :
      field === "firstName" ? bookingFirstName :
      field === "lastName" ? bookingLastName :
      field === "email" ? bookingEmail :
      field === "travelClass" ? bookingClass :
      field === "adults" ? bookingAdults :
      bookingPhone;
    const msg = validateStep2(field, val);
    setStep2Errors((prev) => ({ ...prev, [field]: msg || undefined }));
  };

  const handleBookingPnrChange = (val: string) => {
    setBookingPnr(val);
    if (step2Touched.pnr) {
      const msg = validateStep2("pnr", val);
      setStep2Errors((prev) => ({ ...prev, pnr: msg || undefined }));
    }
  };

  const handleBookingFirstNameChange = (val: string) => {
    setBookingFirstName(val);
    if (step2Touched.firstName) {
      const msg = validateStep2("firstName", val);
      setStep2Errors((prev) => ({ ...prev, firstName: msg || undefined }));
    }
  };

  const handleBookingLastNameChange = (val: string) => {
    setBookingLastName(val);
    if (step2Touched.lastName) {
      const msg = validateStep2("lastName", val);
      setStep2Errors((prev) => ({ ...prev, lastName: msg || undefined }));
    }
  };

  const handleBookingEmailChange = (val: string) => {
    setBookingEmail(val);
    if (step2Touched.email) {
      const msg = validateStep2("email", val);
      setStep2Errors((prev) => ({ ...prev, email: msg || undefined }));
    }
  };

  const handleBookingPhoneChange = (val: string) => {
    setBookingPhone(val);
    if (step2Touched.phone) {
      const msg = validateStep2("phone", val);
      setStep2Errors((prev) => ({ ...prev, phone: msg || undefined }));
    }
  };

  const handleBookingClassChange = (val: string) => {
    setBookingClass(val);
    if (step2Touched.travelClass) {
      const msg = validateStep2("travelClass", val);
      setStep2Errors((prev) => ({ ...prev, travelClass: msg || undefined }));
    }
  };

  const handleBookingAdultsChange = (val: string) => {
    setBookingAdults(val);
    if (step2Touched.adults) {
      const msg = validateStep2("adults", val);
      setStep2Errors((prev) => ({ ...prev, adults: msg || undefined }));
    }
  };
  const [addedBookings, setAddedBookings] = useState<ManualBooking[]>([]);
  const [editingBookingId, setEditingBookingId] = useState<string | null>(null);
  const [isLoadingBookings, setIsLoadingBookings] = useState(false);
  const [isSavingBooking, setIsSavingBooking] = useState(false);
  const [isUploadingCsv, setIsUploadingCsv] = useState(false);
  const [isConfirmingBookings, setIsConfirmingBookings] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    totalBookings: number;
    validBookings: number;
    errorBookings: number;
  } | null>(null);
  const [importErrors, setImportErrors] = useState<Array<{ row: number; errors: string[] }>>([]);

  // Manifest File Upload (Excel simulator)
  const [isManifestUploaded, setIsManifestUploaded] = useState(false);
  const [manifestFileName, setManifestFileName] = useState("");

  const [createdFlightId, setCreatedFlightId] = useState<number | null>(() => (initialData?.id && !isNaN(Number(initialData.id)) ? Number(initialData.id) : null));
  const [isCreatingFlight, setIsCreatingFlight] = useState(false);

  const flightId = createdFlightId || (initialData?.id && !isNaN(Number(initialData.id)) ? Number(initialData.id) : null);

  const fetchBookings = async (fId: number) => {
    setIsLoadingBookings(true);
    try {
      const res = await cancellationService.listBookings(fId);
      const bookingsData = res?.data?.bookings || (Array.isArray(res?.data) ? res.data : []);
      if (Array.isArray(bookingsData)) {
        const mapped: ManualBooking[] = bookingsData.map((b: any) => ({
          id: String(b.id),
          pnr: b.pnr,
          firstName: b.firstName,
          lastName: b.lastName,
          email: b.email,
          phone: b.phone,
          travelClass: b.travelClass ? b.travelClass.charAt(0).toUpperCase() + b.travelClass.slice(1).toLowerCase() : "Economy",
          adults: b.adults || 1,
          children: b.children || 0,
          notes: b.additionalNotes || b.notes || "",
          tags: (b.specialNotes || []).map((sn: string) => ENUM_TO_NOTE_TAG[sn] || sn),
        }));
        setAddedBookings(mapped);
      }
    } catch (err: any) {
      console.error("Failed to load bookings:", err);
    } finally {
      setIsLoadingBookings(false);
    }
  };

  useEffect(() => {
    if (activeStep === 2 && flightId) {
      fetchBookings(flightId);
    }
  }, [activeStep, flightId]);

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
  const [paymentConfirmed, setPaymentConfirmed] = useState(() => initialData?.status?.toLowerCase() === "paid");

  // Step 5 Drawer state
  const [isBookingDetailsOpen, setIsBookingDetailsOpen] = useState(false);
  const [selectedBookingForDrawer, setSelectedBookingForDrawer] = useState<any>(null);

  // Step 3 Pagination state
  const [step3CurrentPage, setStep3CurrentPage] = useState(1);
  const [step3ResultsPerPage, setStep3ResultsPerPage] = useState(5);

  // Step 5 Pagination state
  const [step5CurrentPage, setStep5CurrentPage] = useState(1);
  const [step5ResultsPerPage, setStep5ResultsPerPage] = useState(5);

  // Step 7 Publish state
  const [notifySMS, setNotifySMS] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyGround, setNotifyGround] = useState(true);

  // Calculated state values
  const totalBookingsCount = addedBookings.length;
  const totalPassengersCount = addedBookings.reduce((sum, b) => sum + b.adults + b.children, 0);
  const hotelCost = totalBookingsCount * 120;
  const platformDiscount = hotelCost * 0.10;
  const hotelTax = hotelCost * 0.08;
  const subtotal = hotelCost - platformDiscount + hotelTax;
  const platformFee = subtotal * 0.05;
  const totalPayment = subtotal + platformFee;

  const handleTagClick = (tag: string) => {
    setSelectedReasonTag(tag);
    if (tag === "Other") {
      setNewReason("");
    } else {
      setNewReason(tag);
    }
  };

  const simulateCsvUpload = () => {
    setIsManifestUploaded(true);
    setManifestFileName("passenger_manifest_" + (newFlight || "SW1234") + ".csv");

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

  const handleDeleteBooking = async (id: string) => {
    if (flightId) {
      try {
        await cancellationService.deleteBooking(flightId, id);
        setAddedBookings((prev) => prev.filter((b) => b.id !== id));
        toast.success("Booking deleted successfully");
      } catch (err: any) {
        toast.error(err.message || "Failed to delete booking");
      }
    } else {
      setAddedBookings((prev) => prev.filter((b) => b.id !== id));
      toast.success("Booking removed");
    }
  };

  const handleCsvFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv") && file.type !== "text/csv" && file.type !== "application/csv") {
      toast.error("Please upload a valid .csv file.");
      return;
    }

    setManifestFileName(file.name);
    setIsUploadingCsv(true);

    if (flightId) {
      try {
        const res = await cancellationService.importBookings(flightId, file);
        setIsManifestUploaded(true);
        if (res?.data?.summary) {
          setImportSummary(res.data.summary);
        }
        if (res?.data?.errorList && res.data.errorList.length > 0) {
          setImportErrors(res.data.errorList);
        } else {
          setImportErrors([]);
        }
        await fetchBookings(flightId);
        toast.success(res?.message || "Bookings imported successfully");
      } catch (err: any) {
        toast.error(err.message || "Failed to import CSV bookings");
      } finally {
        setIsUploadingCsv(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } else {
      setTimeout(() => {
        simulateCsvUpload();
        setIsUploadingCsv(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }, 500);
    }
  };

  const handleAddBooking = async () => {
    // Run all validations
    const fields: Step2Field[] = ["pnr", "firstName", "lastName", "email", "phone", "travelClass", "adults"];
    const values: Record<Step2Field, string> = {
      pnr: bookingPnr,
      firstName: bookingFirstName,
      lastName: bookingLastName,
      email: bookingEmail,
      phone: bookingPhone,
      travelClass: bookingClass,
      adults: bookingAdults,
    };
    const errs: Partial<Record<Step2Field, string>> = {};
    for (const f of fields) {
      const msg = validateStep2(f, values[f]);
      if (msg) errs[f] = msg;
    }
    if (Object.keys(errs).length > 0) {
      setStep2Errors(errs);
      setStep2Touched({ pnr: true, firstName: true, lastName: true, email: true, phone: true, travelClass: true, adults: true });
      setTimeout(() => {
        const first = document.querySelector(".step2-field-error");
        first?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }

    const mappedTravelClass = bookingClass.toLowerCase() === "business" ? "business" : "economy";
    const mappedSpecialNotes = selectedNoteTags.map((t) => NOTE_TAG_TO_ENUM[t] || t.toLowerCase().replace(/\s+/g, "_"));

    const payload: CreateBookingPayload = {
      pnr: bookingPnr.trim().toUpperCase(),
      firstName: bookingFirstName.trim(),
      lastName: bookingLastName.trim(),
      email: bookingEmail.trim(),
      phone: bookingPhone.trim(),
      travelClass: mappedTravelClass,
      adults: Number(bookingAdults) || 1,
      children: Number(bookingChildren) || 0,
      specialNotes: mappedSpecialNotes,
      additionalNotes: bookingNotesText.trim() || undefined,
    };

    setIsSavingBooking(true);
    try {
      if (editingBookingId) {
        if (flightId) {
          await cancellationService.updateBooking(flightId, editingBookingId, payload);
          await fetchBookings(flightId);
        } else {
          setAddedBookings((prev) =>
            prev.map((b) =>
              b.id === editingBookingId
                ? {
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
                  }
                : b
            )
          );
        }
        toast.success("Booking updated successfully");
        setEditingBookingId(null);
      } else {
        if (flightId) {
          const res = await cancellationService.addBooking(flightId, payload);
          await fetchBookings(flightId);
          toast.success(res?.message || "Booking added successfully");
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
          setAddedBookings((prev) => [...prev, newB]);
          toast.success("Booking added");
        }
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
      setStep2Errors({});
      setStep2Touched({});
    } catch (error: any) {
      toast.error(error.message || "Failed to save booking");
    } finally {
      setIsSavingBooking(false);
    }
  };

  const handlePrevStep = () => {
    if (activeStep === 1) {
      onClose();
    } else {
      setActiveStep((prev) => prev - 1);
    }
  };

  const handleNextStep = async () => {
    if (activeStep === 1) {
      const errs: Partial<Record<Step1Field, string>> = {};
      const flightErr = validateStep1("flightNumber", newFlight);
      if (flightErr) errs.flightNumber = flightErr;

      const dateErr = validateStep1("cancellationDate", newDate);
      if (dateErr) errs.cancellationDate = dateErr;

      const depErr = validateStep1("departureAirport", newDepartureAirport);
      if (depErr) errs.departureAirport = depErr;

      const arrErr = validateStep1("arrivalAirport", newArrivalAirport, { departureAirport: newDepartureAirport });
      if (arrErr) errs.arrivalAirport = arrErr;

      const checkInErr = validateStep1("checkInDate", checkInDate);
      if (checkInErr) errs.checkInDate = checkInErr;

      const checkOutErr = validateStep1("checkOutDate", checkOutDate, { checkInDate });
      if (checkOutErr) errs.checkOutDate = checkOutErr;

      if (Object.keys(errs).length > 0) {
        setStep1Errors(errs);
        setStep1Touched({
          flightNumber: true,
          cancellationDate: true,
          departureAirport: true,
          arrivalAirport: true,
          checkInDate: true,
          checkOutDate: true,
        });
        setTimeout(() => {
          const first = document.querySelector(".field-error");
          first?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 50);
        return;
      }

      setIsCreatingFlight(true);
      try {
        let airlineId = 1;
        if (typeof window !== "undefined") {
          const userStr = sessionStorage.getItem("airline_current_user");
          if (userStr) {
            try {
              const u = JSON.parse(userStr);
              if (u.airlineId) airlineId = Number(u.airlineId);
            } catch (e) {}
          }
        }

        const formattedDate = newDate.includes("T")
          ? newDate.split("T")[0]
          : newDate;

        const depId = getAirportId(newDepartureAirport);
        const arrId = getAirportId(newArrivalAirport);
        const reasonEnum = mapCancellationReason(selectedReasonTag, newReason);
        const reasonText = newReason.trim() || selectedReasonTag || "Severe weather conditions at departure";

        const response = await cancellationService.createCancelledFlight({
          flightNumber: newFlight.trim(),
          airlineId: airlineId,
          departureAirportId: depId,
          arrivalAirportId: arrId,
          cancellationDate: formattedDate,
          cancellationReason: reasonEnum,
          cancellationReasonText: reasonText,
        });

        if (response?.data?.id) {
          setCreatedFlightId(response.data.id);
        }
        toast.success(response?.message || "Cancelled flight created");
        setActiveStep(2);
      } catch (error: any) {
        toast.error(error.message || "Failed to create cancelled flight");
      } finally {
        setIsCreatingFlight(false);
      }
    } else if (activeStep === 2) {
      if (addedBookings.length === 0) {
        toast.error("Please add at least one booking (either manually or by uploading an Excel file).");
        return;
      }
      setActiveStep(3);
    } else if (activeStep === 3) {
      if (!flightId) {
        setActiveStep(4);
        return;
      }
      setIsConfirmingBookings(true);
      try {
        const res = await cancellationService.confirmBookings(flightId);
        toast.success(res?.message || "Bookings confirmed successfully");
        setActiveStep(4);
      } catch (error: any) {
        toast.error(error.message || "Failed to confirm bookings");
      } finally {
        setIsConfirmingBookings(false);
      }
    } else if (activeStep === 7) {
      const added: Cancellation = {
        id: String(Date.now()),
        flight: newFlight,
        route: `${newDepartureAirport} ➔ ${newArrivalAirport}`,
        cancellationDate: formatDateString(newDate),
        bookings: totalBookingsCount,
        passengers: totalPassengersCount,
        totalCost: totalPayment,
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
      { number: 1, label: "Flight Details", desc: "Basic information & stay dates" },
      { number: 2, label: "Bookings", desc: "Upload passengers" },
      { number: 3, label: "Review", desc: "Verify details" },
      { number: 4, label: "Allocation", desc: "Assign hotels" },
      { number: 5, label: "Booking Summary", desc: "Review booked hotels & final costs" },
      { number: 6, label: "Payment", desc: "Review & pay" },
      { number: 7, label: "Publish", desc: "Notify passengers" },
    ];

    return (
      <div className="w-full bg-white border border-[#E5E7EB] rounded-2xl p-6 overflow-x-auto">
        <div className="flex items-start w-full min-w-[800px]">
          {steps.map((step, idx) => {
            const isActive = activeStep === step.number;
            const isCompleted = activeStep > step.number;
            return (
              <Fragment key={step.number}>
                <div className="flex flex-col items-center shrink-0 w-[140px] z-10">
                  {/* Circle */}
                  <div
                    className={cn(
                      "size-10 rounded-full flex items-center justify-center text-base font-semibold transition-all duration-200 border",
                      isActive
                        ? "bg-[#0F2757] text-white border-transparent ring-4 ring-gray-200"
                        : isCompleted
                          ? "bg-[#1FAD53] text-white border-transparent"
                          : "bg-gray-200 text-gray-500 border-gray-300"
                    )}
                  >
                    {isCompleted ? <Check className="h-5 w-5" /> : step.number}
                  </div>

                  {/* Text Content */}
                  <div className="flex flex-col items-center text-center mt-2 px-1 w-full">
                    <span
                      className={cn(
                        "text-[14px] font-semibold transition-colors whitespace-nowrap",
                        isActive || isCompleted ? "text-[#1F2937]" : "text-gray-500"
                      )}
                    >
                      {step.label}
                    </span>
                    <span className="text-[12px] text-gray-400 mt-0.5 leading-tight">
                      {step.desc}
                    </span>
                  </div>
                </div>

                {/* Connecting Line */}
                {idx < steps.length - 1 && (
                  <div
                    className={cn(
                      "flex-1 h-0.5 mt-[19px] -mx-[36px] transition-all duration-300 z-0",
                      isCompleted ? "bg-[#1FAD53]" : "bg-gray-200"
                    )}
                  />
                )}
              </Fragment>
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
            <div className="flex items-center gap-3 pb-4">
              <div className="size-11 p-2.5 bg-slate-100 text-slate-700 rounded-xl flex justify-center items-center shrink-0">
                <Plane className="h-6 w-6 text-[#0F2757]" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-semibold text-gray-900 font-figtree">Flight Details</h3>
                <p className="text-sm text-gray-500 mt-0.5">Enter the cancelled flight information and default stay dates</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              <div className="flex flex-col gap-1.5">
                <label className="block text-[16px] font-medium text-[#1F2937]">Flight Number *</label>
                <input
                  type="text"
                  placeholder="e.g., SW1234"
                  value={newFlight}
                  onChange={(e) => handleFlightChange(e.target.value)}
                  onBlur={handleStep1Blur("flightNumber")}
                  className={cn(
                    "w-full h-[49px] px-4 rounded-lg border text-[16px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 transition-all placeholder:text-[#9CA3AF]",
                    step1Errors.flightNumber && step1Touched.flightNumber
                      ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                      : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]"
                  )}
                />
                {step1Errors.flightNumber && step1Touched.flightNumber && (
                  <p className="field-error mt-1 text-xs text-red-500">{step1Errors.flightNumber}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="block text-[16px] font-medium text-[#1F2937]">Cancellation Date *</label>
                <DatePicker
                  value={newDate}
                  onChange={handleDateChange}
                  className={cn(
                    "w-full h-[49px] px-4 rounded-lg border text-[16px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 transition-all placeholder:text-[#9CA3AF]",
                    step1Errors.cancellationDate && step1Touched.cancellationDate
                      ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                      : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]"
                  )}
                  placeholder="Select date"
                />
                {step1Errors.cancellationDate && step1Touched.cancellationDate && (
                  <p className="field-error mt-1 text-xs text-red-500">{step1Errors.cancellationDate}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="block text-[16px] font-medium text-[#1F2937]">Departure Airport *</label>
                <Dropdown
                  value={newDepartureAirport}
                  onChange={handleDepartureAirportChange}
                  options={AIRPORT_OPTIONS}
                  triggerWidthClass="w-full"
                  widthClass="w-full"
                  heightClass="h-[49px]"
                  bgClass="bg-white"
                  error={!!(step1Errors.departureAirport && step1Touched.departureAirport)}
                />
                {step1Errors.departureAirport && step1Touched.departureAirport && (
                  <p className="field-error mt-1 text-xs text-red-500">{step1Errors.departureAirport}</p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="block text-[16px] font-medium text-[#1F2937]">Arrival Airport *</label>
                <Dropdown
                  value={newArrivalAirport}
                  onChange={handleArrivalAirportChange}
                  options={AIRPORT_OPTIONS}
                  triggerWidthClass="w-full"
                  widthClass="w-full"
                  heightClass="h-[49px]"
                  bgClass="bg-white"
                  error={!!(step1Errors.arrivalAirport && step1Touched.arrivalAirport)}
                />
                {step1Errors.arrivalAirport && step1Touched.arrivalAirport && (
                  <p className="field-error mt-1 text-xs text-red-500">{step1Errors.arrivalAirport}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              <div className="flex flex-col gap-1.5">
                <label className="block text-[16px] font-medium text-[#1F2937]">Default Check-in Date *</label>
                <DatePicker
                  value={checkInDate}
                  onChange={handleCheckInDateChange}
                  className={cn(
                    "w-full h-[49px] px-4 rounded-lg border text-[16px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 transition-all placeholder:text-[#9CA3AF]",
                    step1Errors.checkInDate && step1Touched.checkInDate
                      ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                      : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]"
                  )}
                  placeholder="mm/dd/yyyy"
                />
                {step1Errors.checkInDate && step1Touched.checkInDate && (
                  <p className="field-error mt-1 text-xs text-red-500">{step1Errors.checkInDate}</p>
                )}
                <p className="text-[13px] text-gray-500 font-medium">
                  Defaults to the cancelled flight date. You can change this date if required.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="block text-[16px] font-medium text-[#1F2937]">Default Check-out Date *</label>
                <DatePicker
                  value={checkOutDate}
                  onChange={handleCheckOutDateChange}
                  className={cn(
                    "w-full h-[49px] px-4 rounded-lg border text-[16px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 transition-all placeholder:text-[#9CA3AF]",
                    step1Errors.checkOutDate && step1Touched.checkOutDate
                      ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                      : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]"
                  )}
                  placeholder="mm/dd/yyyy"
                />
                {step1Errors.checkOutDate && step1Touched.checkOutDate && (
                  <p className="field-error mt-1 text-xs text-red-500">{step1Errors.checkOutDate}</p>
                )}
                <p className="text-[13px] text-gray-500 font-medium">
                  Defaults to the day after the cancelled flight date. You can change this date if required.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3.5 pt-2 text-left">
              <label className="block text-[16px] font-medium text-[#1F2937]">
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
                className="block w-full rounded-lg border border-[#D1D5DB] p-4 text-[16px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B] transition-all placeholder:text-[#9CA3AF]"
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
            <div className="flex items-center gap-3 pb-4">
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
                <span>Upload CSV File</span>
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
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv,text/csv,application/csv"
                  className="hidden"
                  onChange={handleCsvFileSelected}
                />
                <div
                  className={cn(
                    "border border-dashed rounded-xl py-12 px-6 flex flex-col items-center justify-center text-center transition-colors duration-200",
                    isManifestUploaded
                      ? "border-emerald-300 bg-emerald-50/20 cursor-pointer"
                      : "border-gray-300 bg-[#FAFAFA]"
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="size-[52px] rounded-full bg-[#E5E7EB] flex items-center justify-center mb-4">
                    {isUploadingCsv ? (
                      <Loader2 className="h-6 w-6 text-[#0F2757] animate-spin" />
                    ) : (
                      <Upload className={cn("h-6 w-6", isManifestUploaded ? "text-emerald-600" : "text-[#374151]")} />
                    )}
                  </div>

                  {isUploadingCsv ? (
                    <div>
                      <h4 className="text-lg font-semibold text-[#111827] mb-1">Importing Bookings...</h4>
                      <p className="text-sm text-gray-500">Please wait while we parse and validate your CSV file.</p>
                    </div>
                  ) : isManifestUploaded ? (
                    <div>
                      <h4 className="text-lg font-semibold text-emerald-800 mb-1">{manifestFileName}</h4>
                      <p className="text-sm text-emerald-600">Upload complete. Loaded {addedBookings.length} bookings.</p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="mt-3 text-xs text-[#0F2757] underline font-medium hover:text-[#1B2B6B]"
                      >
                        Upload a different CSV
                      </button>
                    </div>
                  ) : (
                    <>
                      <h4 className="text-[18px] font-semibold text-[#111827] mb-2 font-figtree">Upload Booking File</h4>
                      <p className="text-[15px] text-[#6B7280] mb-6 max-w-[400px]">
                        Drag and drop a CSV file containing booking data, or click to browse your files
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="h-[42px] bg-[#233159] hover:bg-[#1A2542] text-white px-6 rounded-[8px] font-medium text-[15px] flex items-center gap-2 mb-4 transition-colors cursor-pointer"
                      >
                        <Upload className="h-4 w-4" />
                        Choose File
                      </button>
                      <p className="text-[13px] text-[#9CA3AF]">
                        Supports .csv • Max 10MB
                      </p>
                    </>
                  )}
                </div>

                {importSummary && (
                  <div className="mt-4 p-4 rounded-xl border border-blue-200 bg-blue-50/50 flex items-center justify-between text-left">
                    <div>
                      <h5 className="font-semibold text-blue-900 text-sm">Import Summary</h5>
                      <p className="text-xs text-blue-700 mt-0.5">
                        Total: {importSummary.totalBookings} | Valid: {importSummary.validBookings} | Errors: {importSummary.errorBookings}
                      </p>
                    </div>
                  </div>
                )}

                {importErrors.length > 0 && (
                  <div className="mt-3 p-4 rounded-xl border border-red-200 bg-red-50/50 text-left">
                    <h5 className="font-semibold text-red-900 text-sm mb-1">Errors Encountered in CSV:</h5>
                    <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
                      {importErrors.map((err, idx) => (
                        <li key={idx}>
                          Row {err.row}: {err.errors.join(", ")}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-4 text-left">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900 text-base">
                    {editingBookingId ? "Edit Booking" : "Add New Booking"}
                  </h4>
                  {editingBookingId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingBookingId(null);
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
                        setStep2Errors({});
                        setStep2Touched({});
                      }}
                      className="text-xs text-gray-500 hover:text-gray-800 underline cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[15px] font-medium text-[#1F2937]">Booking Reference (PNR) *</label>
                    <input
                      type="text"
                      placeholder="e.g., ABC123"
                      value={bookingPnr}
                      onChange={(e) => handleBookingPnrChange(e.target.value)}
                      onBlur={handleStep2Blur("pnr")}
                      className={cn(
                        "block h-[42px] w-full rounded-lg border px-3 text-[15px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 transition-all placeholder:text-[#9CA3AF]",
                        step2Errors.pnr && step2Touched.pnr
                          ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                          : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]"
                      )}
                    />
                    {step2Errors.pnr && step2Touched.pnr && (
                      <p className="step2-field-error mt-0.5 text-xs text-red-500">{step2Errors.pnr}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[15px] font-medium text-[#1F2937]">First Name *</label>
                    <input
                      type="text"
                      placeholder="John"
                      value={bookingFirstName}
                      onChange={(e) => handleBookingFirstNameChange(e.target.value)}
                      onBlur={handleStep2Blur("firstName")}
                      className={cn(
                        "block h-[42px] w-full rounded-lg border px-3 text-[15px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 transition-all placeholder:text-[#9CA3AF]",
                        step2Errors.firstName && step2Touched.firstName
                          ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                          : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]"
                      )}
                    />
                    {step2Errors.firstName && step2Touched.firstName && (
                      <p className="step2-field-error mt-0.5 text-xs text-red-500">{step2Errors.firstName}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[15px] font-medium text-[#1F2937]">Last Name *</label>
                    <input
                      type="text"
                      placeholder="Doe"
                      value={bookingLastName}
                      onChange={(e) => handleBookingLastNameChange(e.target.value)}
                      onBlur={handleStep2Blur("lastName")}
                      className={cn(
                        "block h-[42px] w-full rounded-lg border px-3 text-[15px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 transition-all placeholder:text-[#9CA3AF]",
                        step2Errors.lastName && step2Touched.lastName
                          ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                          : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]"
                      )}
                    />
                    {step2Errors.lastName && step2Touched.lastName && (
                      <p className="step2-field-error mt-0.5 text-xs text-red-500">{step2Errors.lastName}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[15px] font-medium text-[#1F2937]">Email *</label>
                    <input
                      type="email"
                      placeholder="john@email.com"
                      value={bookingEmail}
                      onChange={(e) => handleBookingEmailChange(e.target.value)}
                      onBlur={handleStep2Blur("email")}
                      className={cn(
                        "block h-[42px] w-full rounded-lg border px-3 text-[15px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 transition-all placeholder:text-[#9CA3AF]",
                        step2Errors.email && step2Touched.email
                          ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                          : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]"
                      )}
                    />
                    {step2Errors.email && step2Touched.email && (
                      <p className="step2-field-error mt-0.5 text-xs text-red-500">{step2Errors.email}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[15px] font-medium text-[#1F2937]">Phone *</label>
                    <input
                      type="text"
                      placeholder="+1 555-0100"
                      value={bookingPhone}
                      onChange={(e) => handleBookingPhoneChange(e.target.value)}
                      onBlur={handleStep2Blur("phone")}
                      className={cn(
                        "block h-[42px] w-full rounded-lg border px-3 text-[15px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 transition-all placeholder:text-[#9CA3AF]",
                        step2Errors.phone && step2Touched.phone
                          ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                          : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]"
                      )}
                    />
                    {step2Errors.phone && step2Touched.phone && (
                      <p className="step2-field-error mt-0.5 text-xs text-red-500">{step2Errors.phone}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[15px] font-medium text-[#1F2937]">Travel Class *</label>
                    <Dropdown
                      value={bookingClass}
                      onChange={handleBookingClassChange}
                      options={TRAVEL_CLASS_OPTIONS}
                      triggerWidthClass="w-full"
                      widthClass="w-full"
                      bgClass="bg-white"
                      heightClass="h-[42px]"
                      error={!!(step2Errors.travelClass && step2Touched.travelClass)}
                    />
                    {step2Errors.travelClass && step2Touched.travelClass && (
                      <p className="step2-field-error mt-0.5 text-xs text-red-500">{step2Errors.travelClass}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[15px] font-medium text-[#1F2937]">Adults *</label>
                    <input
                      type="number"
                      min={1}
                      value={bookingAdults}
                      onChange={(e) => handleBookingAdultsChange(e.target.value)}
                      onBlur={handleStep2Blur("adults")}
                      className={cn(
                        "block h-[42px] w-full rounded-lg border px-3 text-[15px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 transition-all",
                        step2Errors.adults && step2Touched.adults
                          ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                          : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]"
                      )}
                    />
                    {step2Errors.adults && step2Touched.adults && (
                      <p className="step2-field-error mt-0.5 text-xs text-red-500">{step2Errors.adults}</p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[15px] font-medium text-[#1F2937]">Children</label>
                    <input
                      type="number"
                      min={0}
                      value={bookingChildren}
                      onChange={(e) => setBookingChildren(e.target.value)}
                      className="block h-[42px] w-full rounded-lg border border-[#D1D5DB] px-3 text-[15px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B] transition-all"
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
                  <AlertCircle className="h-4 w-4 shrink-0 mt-1 opacity-80 text-blue-900 " />
                  <p className="text-sm text-blue-900 leading-relaxed font-figtree">
                    Each booking can contain multiple passengers. Room allocation: 2 passengers per room. Business class passengers are assigned 4-star hotels, economy passengers get 3-star hotels.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isSavingBooking}
                  onClick={handleAddBooking}
                  className="bg-[#0F2757] hover:bg-[#162259] disabled:opacity-60 text-white font-medium py-2 px-4 rounded-lg transition-colors cursor-pointer text-sm inline-flex items-center gap-1.5"
                >
                  {isSavingBooking ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span>
                    {isSavingBooking
                      ? "Saving..."
                      : editingBookingId
                        ? "Update Booking"
                        : "Add Booking"}
                  </span>
                </button>
              </div>
            )}

            {/* Bookings List / Table */}
            <div className="space-y-4">
              {addedBookings.length === 0 ? (
                bookingTab === "manual" ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center text-gray-505">
                    <Users className="h-10 w-10 text-gray-300 mb-3" />
                    <p className="text-sm font-medium text-gray-700">No bookings added yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Use the form above to add your first booking.</p>
                  </div>
                ) : null
              ) : (
                <div className="space-y-4 text-left">
                  {/* Summary Grid stats */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-[#F6F7F8] rounded-xl py-4 flex flex-col items-center justify-center">
                      <div className="text-[22px] leading-tight font-bold text-[#111827]">{addedBookings.length}</div>
                      <div className="text-[13px] text-[#6B7280] mt-1">Bookings</div>
                    </div>
                    <div className="bg-[#F6F7F8] rounded-xl py-4 flex flex-col items-center justify-center">
                      <div className="text-[22px] leading-tight font-bold text-[#111827]">
                        {totalPassengersCount}
                      </div>
                      <div className="text-[13px] text-[#6B7280] mt-1">Passengers</div>
                    </div>
                    <div className="bg-[#F6F7F8] rounded-xl py-4 flex flex-col items-center justify-center">
                      <div className="text-[22px] leading-tight font-bold text-[#111827]">
                        {addedBookings.reduce((sum, b) => sum + Math.ceil((b.adults + b.children) / 2), 0)}
                      </div>
                      <div className="text-[13px] text-[#6B7280] mt-1">Est. Rooms</div>
                    </div>
                    <div className="bg-[#F6F7F8] rounded-xl py-4 flex flex-col items-center justify-center">
                      <div className="text-[22px] leading-tight font-bold text-[#111827]">
                        {addedBookings.filter(b => b.travelClass === "Business" || b.travelClass === "First Class").length}
                      </div>
                      <div className="text-[13px] text-[#6B7280] mt-1">Business</div>
                    </div>
                  </div>

                  {/* Bookings Table */}
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[80px]">PNR</TableHead>
                          <TableHead className="min-w-[140px]">Contact Name</TableHead>
                          <TableHead className="min-w-[160px]">Email</TableHead>
                          <TableHead className="min-w-[120px]">Phone</TableHead>
                          <TableHead className="min-w-[80px] text-center">Adults</TableHead>
                          <TableHead className="min-w-[80px] text-center">Children</TableHead>
                          <TableHead className="min-w-[100px] text-center">Class</TableHead>
                          <TableHead className="min-w-[80px] text-center">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {addedBookings.slice((currentPage - 1) * resultsPerPage, currentPage * resultsPerPage).map((b) => (
                          <TableRow key={b.id}>
                            <TableCell className="font-medium text-gray-900">{b.pnr}</TableCell>
                            <TableCell>{b.firstName} {b.lastName}</TableCell>
                            <TableCell className="text-gray-550">{b.email}</TableCell>
                            <TableCell className="text-gray-550">{b.phone}</TableCell>
                            <TableCell>{b.adults}</TableCell>
                            <TableCell>{b.children}</TableCell>
                            <TableCell>
                              <span className={cn(
                                "rounded px-2.5 py-1 text-xs font-semibold inline-block",
                                b.travelClass === "Business" || b.travelClass === "First Class"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-gray-100 text-gray-700"
                              )}>
                                {b.travelClass}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditBooking(b)}
                                  className="text-gray-400 hover:text-[#0F2757] transition-colors cursor-pointer"
                                  title="Edit"
                                >
                                  <Edit className="h-[18px] w-[18px]" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteBooking(b.id)}
                                  className="text-gray-400 hover:text-red-600 transition-colors cursor-pointer"
                                  title="Delete"
                                >
                                  <Trash2 className="h-[18px] w-[18px]" />
                                </button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  <Pagination
                    totalResults={addedBookings.length}
                    currentPage={currentPage}
                    setCurrentPage={setCurrentPage}
                    resultsPerPage={resultsPerPage}
                    setResultsPerPage={setResultsPerPage}
                    totalPages={Math.ceil(addedBookings.length / resultsPerPage)}
                  />
                </div>
              )}
            </div>
          </div>
        );
      case 3:
        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4">
              <div className="size-10 bg-slate-200/50 text-slate-700 rounded-lg flex justify-center items-center shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-gray-900 font-figtree">Review Bookings</h3>
                <p className="text-sm text-gray-500 mt-0.5">Verify booking details before hotel allocation</p>
              </div>
            </div>

            <div className="flex items-center justify-between bg-gray-100/40 rounded-xl p-5">
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
              <div className="bg-[#F6F7F8] rounded-xl py-5 flex flex-col items-center justify-center text-center">
                <span className="text-[22px] leading-tight font-bold text-[#111827]">{addedBookings.length}</span>
                <span className="text-[13px] text-[#6B7280] mt-1">Total Bookings</span>
              </div>
              <div className="bg-[#F6F7F8] rounded-xl py-5 flex flex-col items-center justify-center text-center">
                <span className="text-[22px] leading-tight font-bold text-[#111827]">{totalPassengersCount}</span>
                <span className="text-[13px] text-[#6B7280] mt-1">Total Passengers</span>
              </div>
              <div className="bg-[#F6F7F8] rounded-xl py-5 flex flex-col items-center justify-center text-center">
                <span className="text-[22px] leading-tight font-bold text-[#111827]">{addedBookings.reduce((sum, b) => sum + Math.ceil((b.adults + b.children) / 2), 0)}</span>
                <span className="text-[13px] text-[#6B7280] mt-1">Est. Rooms Required</span>
              </div>
              <div className="bg-[#F6F7F8] rounded-xl py-5 flex flex-col items-center justify-center text-center">
                <span className="text-[22px] leading-tight font-bold text-[#111827]">{addedBookings.filter(b => b.travelClass === "Business" || b.travelClass === "First Class").length}</span>
                <span className="text-[13px] text-[#6B7280] mt-1">Business Class</span>
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xl mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[80px]">PNR</TableHead>
                    <TableHead className="min-w-[140px]">Contact Name</TableHead>
                    <TableHead className="min-w-[160px]">Email</TableHead>
                    <TableHead className="min-w-[80px]">Adults</TableHead>
                    <TableHead className="min-w-[80px]">Children</TableHead>
                    <TableHead className="min-w-[100px]">Class</TableHead>
                    <TableHead className="min-w-[100px]">Est. Rooms</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(addedBookings.length > 0 ? addedBookings : [{
                    id: "1", pnr: "DDJU", firstName: "New", lastName: "Admin", email: "ops@summitair.com", adults: 1, children: 0, travelClass: "Economy"
                  }] as typeof addedBookings).slice((step3CurrentPage - 1) * step3ResultsPerPage, step3CurrentPage * step3ResultsPerPage).map((b, idx) => (
                    <TableRow key={b.id || idx}>
                      <TableCell className="font-medium text-gray-900">{b.pnr}</TableCell>
                      <TableCell>{b.firstName} {b.lastName}</TableCell>
                      <TableCell className="text-gray-550">{b.email}</TableCell>
                      <TableCell>{b.adults}</TableCell>
                      <TableCell>{b.children}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "rounded px-2.5 py-1 text-xs font-semibold inline-block",
                          b.travelClass === "Business" || b.travelClass === "First Class"
                            ? "bg-purple-100 text-purple-800"
                            : "bg-gray-100 text-gray-700"
                        )}>
                          {b.travelClass}
                        </span>
                      </TableCell>
                      <TableCell>{Math.ceil((b.adults + b.children) / 2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <Pagination
              totalResults={addedBookings.length || 1}
              currentPage={step3CurrentPage}
              setCurrentPage={setStep3CurrentPage}
              resultsPerPage={step3ResultsPerPage}
              setResultsPerPage={setStep3ResultsPerPage}
              totalPages={Math.ceil((addedBookings.length || 1) / step3ResultsPerPage)}
            />
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
            <div className="flex items-center gap-3 pb-4">
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
        const roomsCount = addedBookings.reduce((sum, b) => sum + Math.ceil((b.adults + b.children) / 2), 0) || 11;
        const baseCost = hotelCost > 0 ? hotelCost : 1320;
        const discountAmt = baseCost * 0.10;
        const taxAmt = baseCost * 0.08;
        const feeAmt = (baseCost - discountAmt + taxAmt) * 0.05;
        const finalAmt = baseCost - discountAmt + taxAmt + feeAmt;

        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4">
              <div className="size-10 bg-[#ECFDF5] text-[#10B981] rounded-lg flex justify-center items-center shrink-0 border border-[#D1FAE5]">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-gray-900 font-figtree">Booking Summary</h3>
                <p className="text-sm text-gray-500 mt-0.5">Review the booked hotels, room details, and final payment amount before proceeding.</p>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              {/* Card 1 */}
              <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
                <div className="flex items-center gap-2 text-gray-500 mb-3">
                  <Bed className="h-4 w-4" />
                  <span className="text-[13px] font-semibold uppercase">Total Room Bookings</span>
                </div>
                <div className="text-[24px] font-bold text-gray-900">{roomsCount}</div>
                <div className="text-sm text-gray-400 mt-1">Rooms booked</div>
              </div>
              {/* Card 2 */}
              <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
                <div className="flex items-center gap-2 text-gray-500 mb-3">
                  <Receipt className="h-4 w-4" />
                  <span className="text-[13px] font-semibold uppercase">Total Hotel Cost</span>
                </div>
                <div className="text-[24px] font-bold text-gray-900">${baseCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-sm text-gray-400 mt-1">Hotel charges before platform discount</div>
              </div>
              {/* Card 3 */}
              <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
                <div className="flex items-center gap-2 text-gray-500 mb-3">
                  <Percent className="h-4 w-4" />
                  <span className="text-[13px] font-semibold uppercase">Platform Discount</span>
                </div>
                <div className="text-[24px] font-bold text-green-600">-${discountAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-sm text-gray-400 mt-1">Discount provided by platform</div>
              </div>
              {/* Card 4 */}
              <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
                <div className="flex items-center gap-2 text-gray-500 mb-3">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-[13px] font-semibold uppercase">Hotel Tax</span>
                </div>
                <div className="text-[24px] font-bold text-gray-900">${taxAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-sm text-gray-400 mt-1">Applicable hotel taxes</div>
              </div>
              {/* Card 5 */}
              <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
                <div className="flex items-center gap-2 text-gray-500 mb-3">
                  <Percent className="h-4 w-4" />
                  <span className="text-[13px] font-semibold uppercase">Platform Fee (5%)</span>
                </div>
                <div className="text-[24px] font-bold text-gray-900">${feeAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-sm text-gray-400 mt-1">Platform fee on the hotel payment</div>
              </div>
              {/* Card 6 */}
              <div className="bg-[#F6F7F8] border-[2px] border-[#0F2757] rounded-xl p-5 text-left">
                <div className="flex items-center gap-2 text-[#0F2757] mb-3">
                  <Wallet className="h-4 w-4" />
                  <span className="text-[13px] font-semibold uppercase">Total Payment</span>
                </div>
                <div className="text-[24px] font-bold text-[#0F2757]">${finalAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="text-sm text-gray-500 mt-1">Total amount to be charged</div>
              </div>
            </div>

            {/* Table Header */}
            <div className="mt-8 text-left">
              <h4 className="text-[16px] font-semibold text-[#0F2757]">Booked Hotels</h4>
              <p className="text-sm text-gray-500 mt-1">Review the hotel assigned to each booking and the associated room costs.</p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-xl mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">Hotel Booking ID</TableHead>
                    <TableHead className="min-w-[100px]">PNR</TableHead>
                    <TableHead className="min-w-[160px]">Contact</TableHead>
                    <TableHead className="min-w-[100px]">Class</TableHead>
                    <TableHead className="min-w-[120px]">Passengers</TableHead>
                    <TableHead className="min-w-[180px]">Hotel</TableHead>
                    <TableHead className="min-w-[100px]">Rating</TableHead>
                    <TableHead className="min-w-[80px]">Rooms</TableHead>
                    <TableHead className="min-w-[100px]">Total</TableHead>
                    <TableHead className="min-w-[80px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(addedBookings.length > 0 ? addedBookings : [{
                    id: "1", pnr: "AAAAA", firstName: "New", lastName: "Admin", email: "ops@summitair.com", adults: 1, children: 0, travelClass: "Economy"
                  }]).slice((step5CurrentPage - 1) * step5ResultsPerPage, step5CurrentPage * step5ResultsPerPage).map((b, idx) => {
                    const isBusiness = b.travelClass === "Business" || b.travelClass === "First Class";
                    const hotelName = isBusiness ? "Hyatt Regency LAX" : "Holiday Inn Express LAX";
                    const stars = isBusiness ? 4 : 3;
                    const rooms = Math.ceil((b.adults + b.children) / 2);
                    const bookingCost = rooms * (isBusiness ? 160 : 120);
                    const passengersStr = b.adults + b.children > 1 ? `${b.adults + b.children} Passengers` : `${b.adults + b.children} Passenger`;

                    return (
                      <TableRow key={b.id || idx}>
                        <TableCell className="font-medium text-gray-900">HB-00023{idx + 1}</TableCell>
                        <TableCell className="font-medium text-gray-900">{b.pnr}</TableCell>
                        <TableCell>
                          <div className="font-semibold text-gray-900">{b.firstName} {b.lastName}</div>
                          <div className="text-xs text-gray-500">{b.email}</div>
                        </TableCell>
                        <TableCell>
                          <span className={cn(
                            "rounded px-2.5 py-1 text-xs font-semibold inline-block capitalize",
                            isBusiness ? "bg-purple-100 text-purple-800" : "bg-gray-100 text-gray-700"
                          )}>
                            {b.travelClass}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">{passengersStr}</TableCell>
                        <TableCell className="font-medium">{hotelName}</TableCell>
                        <TableCell>
                          <div className="flex justify-center items-center text-amber-400">
                            {[...Array(stars)].map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-current" />
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{rooms}</TableCell>
                        <TableCell className="text-right font-semibold text-gray-900">${bookingCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                        <TableCell>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBookingForDrawer(b);
                              setIsBookingDetailsOpen(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-[#0F2757] hover:bg-gray-100 rounded transition-colors"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <Pagination
              totalResults={addedBookings.length || 1}
              currentPage={step5CurrentPage}
              setCurrentPage={setStep5CurrentPage}
              resultsPerPage={step5ResultsPerPage}
              setResultsPerPage={setStep5ResultsPerPage}
              totalPages={Math.ceil((addedBookings.length || 1) / step5ResultsPerPage)}
            />
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
                <h3 className="text-xl font-semibold text-gray-900 font-figtree">Payment</h3>
                <p className="text-sm text-gray-500 mt-0.5">Review the final amount and select the card to pay for the hotel bookings.</p>
              </div>
            </div>

            <div className="bg-gray-50/80 rounded-xl p-6 space-y-4 text-left text-sm border border-gray-100">
              <div className="flex justify-between items-center text-gray-500">
                <span>Hotel Cost</span>
                <span className="font-semibold text-gray-900">${hotelCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-gray-500">
                <span>Platform Discount</span>
                <span className="font-semibold text-[#1FAD53]">-${platformDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-gray-500">
                <span>Hotel Tax</span>
                <span className="font-semibold text-gray-900">${hotelTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between items-center text-gray-500">
                <span>Platform Fee (5%)</span>
                <span className="font-semibold text-gray-900">${platformFee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="h-px bg-gray-200 w-full" />
              <div className="flex justify-between items-center font-bold text-gray-900 text-base">
                <span>Total Payment</span>
                <span className="text-[20px]">${totalPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="space-y-4 text-left pt-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900 font-figtree">Payment Method</h3>
                <p className="text-sm text-gray-500 mt-0.5">Select the card to charge for these hotel bookings.</p>
              </div>

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
                      isSelected ? "border-[#0F2757] bg-[#0F2757]/5 ring-1 ring-[#0F2757]" : "border-gray-200 hover:border-gray-300 bg-white"
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

              <div className="flex items-center gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddingCard(true)}
                  className="flex items-center gap-1.5 py-2.5 px-4 border border-[#D1D5DB] text-sm font-semibold hover:bg-gray-50 cursor-pointer bg-white text-[#1F2937] shadow-2xs rounded-lg"
                >
                  <Plus className="h-4 w-4 text-gray-500" />
                  Add New Card
                </button>
              </div>

              <div className="pt-4">
                <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={paymentConfirmed}
                      onChange={(e) => setPaymentConfirmed(e.target.checked)}
                    />
                    <div className={cn(
                      "size-5 rounded border flex items-center justify-center transition-colors shrink-0",
                      paymentConfirmed
                        ? "bg-[#0F2757] border-[#0F2757]"
                        : "border-gray-300 bg-white group-hover:border-[#0F2757]"
                    )}>
                      {paymentConfirmed && <Check className="h-3.5 w-3.5 text-white stroke-[3]" />}
                    </div>
                  </div>
                  <span className="text-sm text-gray-700">I confirm that I want to charge ${totalPayment.toLocaleString(undefined, { minimumFractionDigits: 2 })} to the selected card.</span>
                </label>
              </div>
            </div>
          </div>
        );
      case 7:
        return (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center gap-3 pb-4">
              <div className="size-11 p-2.5 bg-slate-100 text-slate-700 rounded-xl flex justify-center items-center shrink-0">
                <Send className="h-6 w-6 text-[#0F2757]" />
              </div>
              <div className="text-left">
                <h3 className="text-xl font-semibold text-gray-900 font-figtree">Notify Passengers</h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Payment is complete. Publishing will send the hotel booking confirmation email, including the booking confirmation PDF, to every booking contact address.
                </p>
              </div>
            </div>

            <div className="w-full bg-[#F3F8ED] border border-[#D1E5CA] p-4 rounded-xl text-sm flex items-center justify-start gap-2 text-[#4CAF50]">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>Payment successfully processed for this cancelled flight.</span>
            </div>

            <div className="w-full bg-[#FFF7E8] border border-[#FBE0C3] p-4 rounded-xl text-sm text-[#F59E0B] text-left">
              <p>
                <span className="font-bold">Note:</span> This action cannot be undone. Passengers will receive their hotel booking confirmations immediately.
              </p>
            </div>

            <div className="w-full bg-[#F8F9FA] rounded-xl p-5 space-y-4 text-left text-sm">
              <div className="flex justify-between items-center text-gray-800">
                <span>Confirmation Emails:</span>
                <span className="font-semibold text-gray-900">{totalBookingsCount}</span>
              </div>
              <div className="flex justify-between items-center text-gray-800">
                <span>Total Passengers:</span>
                <span className="font-semibold text-gray-900">{totalPassengersCount}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  onSave({
                    id: initialData?.id || Math.random().toString(36).substring(7),
                    flight: newFlight || "TRE",
                    route: newDepartureAirport && newArrivalAirport ? `${newDepartureAirport} ➔ ${newArrivalAirport}` : "LAX ➔ ORD",
                    cancellationDate: newDate ? new Date(newDate).toISOString() : new Date().toISOString(),
                    bookings: totalBookingsCount || 1,
                    passengers: totalPassengersCount || 1,
                    totalCost: totalPayment || 120,
                    status: "Published",
                    reason: newReason || selectedReasonTag || "Weather disruption",
                  });
                }}
                className="bg-[#2B3B67] hover:bg-[#1E2B4D] text-white font-medium py-2.5 px-6 rounded-lg transition-colors cursor-pointer text-sm inline-flex items-center gap-2"
              >
                <Send className="h-4 w-4" />
                <span>Send Confirmations & Publish</span>
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
          className="relative -top-1 flex items-center gap-1.5 text-[16px] text-[#6B7280] hover:text-[#1F2937] transition-colors duration-150 font-medium group cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          <span>Back to Cancelled Flights</span>
        </button>
      </div>

      {/* Stepper */}
      {renderStepper()}

      {/* Form Card */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-8">
        {renderActiveStep()}

        {/* Footer Actions */}
        {activeStep !== 4 && activeStep !== 7 && (
          <div className={cn("mt-8 pt-6 flex items-center", activeStep === 5 ? "justify-end" : "justify-between")}>
            {activeStep !== 5 && (
              <button
                onClick={handlePrevStep}
                className="flex items-center gap-2 border border-gray-200 bg-gray-100 hover:bg-gray-300 text-gray-700 font-medium py-2.5 px-5 rounded-lg transition-colors cursor-pointer text-sm"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
            )}

            {activeStep !== 7 && (
              <button
                onClick={handleNextStep}
                disabled={isCreatingFlight || isConfirmingBookings || (activeStep === 6 && !paymentConfirmed)}
                className={cn(
                  "flex items-center gap-2 font-medium py-2.5 px-5 rounded-lg transition-colors cursor-pointer text-sm",
                  (isCreatingFlight || isConfirmingBookings || (activeStep === 6 && !paymentConfirmed)) ? "bg-[#9CA3AF] text-white cursor-not-allowed border-none" : "bg-[#0F2757] hover:bg-[#162259] text-white"
                )}
              >
                {isCreatingFlight ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Creating...</span>
                  </>
                ) : isConfirmingBookings ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Confirming...</span>
                  </>
                ) : activeStep === 6 ? (
                  <>
                    <CreditCard className="h-4 w-4" />
                    <span>Pay ${totalPayment.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </>
                ) : (
                  <>
                    <span>{activeStep === 5 ? "Continue to Payment" : "Continue"}</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </div>

      <BookingDetailsDrawer
        isOpen={isBookingDetailsOpen}
        onClose={() => setIsBookingDetailsOpen(false)}
        booking={selectedBookingForDrawer}
      />
    </div>
  );
}
