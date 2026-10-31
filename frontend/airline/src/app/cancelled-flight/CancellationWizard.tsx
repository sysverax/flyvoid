"use client";

import { useState, useEffect, useMemo, useRef, Fragment } from "react";
import { countries } from "countries-list";
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
  Armchair,
  Ticket,
  Download,
} from "lucide-react";
import { useAuth } from "@/src/hooks/useAuth";
import { BookingDetailsDrawer } from "@/src/components/ui/BookingDetailsDrawer";
import { PassengerBookingDetailDrawer } from "@/src/components/ui/PassengerBookingDetailDrawer";
import { FailedBookingHotelDrawer } from "@/src/components/ui/FailedBookingHotelDrawer";
import {
  DROPDOWN_LIMIT,
  FLIGHT_PAYMENT_STEP_ENABLED,
  PLATFORM_FEE_PERCENT,
} from "@/src/lib/constants";
import { notifyWalletBalanceChanged } from "@/src/lib/wallet-events";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { Pagination } from "@/src/components/ui/pagination";
import { toast } from "react-toastify";
import { Dropdown } from "@/src/components/ui/Dropdown";
import { DatePicker } from "@/src/components/ui/DatePicker";
import { AddCardModal } from "@/src/components/ui/AddCardModal";
import { cn } from "@/src/lib/utils";
import { StatusBadge } from "@/src/components/ui/StatusBadge";
import {
  cancellationService,
  CreateCancelledFlightPayload,
  UpdateCancelledFlightPayload,
  CreateBookingPayload,
  BookingDTO,
  ReviewFlightResponse,
  HotelAllocationsResponse,
  HotelAllocationBookingResult,
  HotelAllocationProgressResponse,
  HotelSummaryCancelledFlightSummaryDto,
  HotelBookingItemDTO,
  HotelBookingDetailDataDto,
  FailedBookingDTO,
} from "@/src/services/cancellation.service";
import { resizeChildAges, validateChildAge } from "@/src/lib/booking-fields";
import { ChildAgesInputs } from "@/src/components/bookings/ChildAgesInputs";
import { SpecialNotesField } from "@/src/components/bookings/SpecialNotesField";
import { CsvUploadTips } from "@/src/components/bookings/CsvImportGuide";
import { FailedBookingsTable } from "@/src/components/bookings/FailedBookingsTable";
import { Dialog } from "@/src/components/ui/Dialog";
import {
  airportsService,
  AirportOptionDTO,
} from "@/src/services/airports.service";

const TRAVEL_CLASS_TO_ENUM: Record<string, string> = {
  "First Class": "first_class",
  Business: "business",
  "Premium Economy": "premium_economy",
  Economy: "economy",
};

const ENUM_TO_TRAVEL_CLASS: Record<string, string> = {
  first_class: "First Class",
  business: "Business",
  premium_economy: "Premium Economy",
  economy: "Economy",
};

function mapCancellationReason(tag: string, text: string): string | undefined {
  const combined = (tag + " " + text).trim().toLowerCase();
  if (!combined) return undefined;
  if (combined.includes("weather")) return "weather_disruption";
  if (
    combined.includes("tech") ||
    combined.includes("engine") ||
    combined.includes("maintenance")
  )
    return "technical_issue";
  if (
    combined.includes("crew") ||
    combined.includes("pilot") ||
    combined.includes("staff")
  )
    return "crew_unavailability";
  if (combined.includes("operation")) return "operational_issue";
  if (
    combined.includes("traffic") ||
    combined.includes("atc") ||
    combined.includes("control")
  )
    return "air_traffic_control";
  return undefined;
}

function formatCancellationReason(reason?: string | null): string {
  if (!reason) return "N/A";
  const s = reason.replace(/_/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "N/A";
}

const TRAVEL_CLASS_OPTIONS = [
  { value: "Economy", label: "Economy" },
  { value: "Premium Economy", label: "Premium Economy" },
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
  residency: string;
  travelClass: string;
  adults: number;
  children: number;
  childAges: number[];
  /** Special Notes: presets and free text, comma-separated. */
  specialNotes: string;
}

export interface Cancellation {
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

export interface CancellationWizardProps {
  onClose: () => void;
  onSave?: (added: Cancellation) => void;
  initialData?: Cancellation | null;
  initialStep?: number;
  flightId?: number | null;
  initialReview?: ReviewFlightResponse | null;
  onStepChange?: (step: number, flightId?: number | null) => void;
}

function formatDateString(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  return `${month} ${day}, ${year}`;
}

const COUNTRY_OPTIONS = Object.entries(countries)
  .map(([code, c]) => ({ value: code, label: `${c.name} (${code})` }))
  .sort((a, b) => a.label.localeCompare(b.label));

const countryName = (code?: string | null): string =>
  code ? (countries[code as keyof typeof countries]?.name ?? code) : "";

const HOTEL_BOOKING_STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  failed: "Booking Failed",
  manual_check: "Manual Check",
  in_progress: "Booking In Progress",
  draft: "Not Started",
  cancelled: "Cancelled",
  completed: "Completed",
};

const PNR_STATUS_TO_HOTEL_STATUS: Record<string, string> = {
  SUCCESS: "confirmed",
  FAILED: "failed",
  MANUAL_CHECK: "manual_check",
  PENDING: "in_progress",
  NOT_STARTED: "draft",
};

export function getInitialStepFromStatus(
  status?: string,
  bookingsCount?: number,
): number {
  if (!status) return 2;
  const s = status.toLowerCase();
  if (s === "draft") {
    return bookingsCount && bookingsCount > 0 ? 3 : 2;
  }
  if (s === "in_progress" || s === "in progress") {
    return bookingsCount && bookingsCount > 0 ? 3 : 2;
  }
  if (
    s === "verified" ||
    s === "confirmed" ||
    s === "passengers_booking_confirmed"
  )
    return 4;
  if (s === "hotel_allocation_in_progress" || s === "ha in progress") return 4;
  if (s === "allocated") return 5;
  if (s === "paid" || s === "published") return 7;
  return 2;
}

export function getMaxAllowedStep(flight: any, summary?: any): number {
  if (!flight) return 2;
  const status = (flight.status || "").toLowerCase();

  if (status === "published" || status === "paid") {
    return 7;
  }
  if (status === "allocated") {
    // Without the payment step, an allocated flight goes straight to publish.
    return FLIGHT_PAYMENT_STEP_ENABLED ? 6 : 7;
  }
  // A partially booked flight stays in passengers_booking_confirmed until every
  // PNR is confirmed; it may view the summary (step 5) but not pay.
  if (status === "passengers_booking_confirmed") {
    return 5;
  }
  if (
    status === "confirmed" ||
    status === "verified" ||
    status === "hotel_allocation_in_progress" ||
    status === "ha in progress"
  ) {
    return 4;
  }

  const bookingsCount =
    summary?.totalBookings ??
    flight?.totalBookings ??
    flight?.summary?.totalBookings ??
    flight?.bookings ??
    0;

  if (bookingsCount > 0) {
    return 3;
  }
  return 2;
}

function toIsoDate(dateStr: string): string {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CancellationWizard({
  onClose,
  onSave,
  initialData,
  initialStep,
  flightId: propFlightId,
  initialReview,
  onStepChange,
}: CancellationWizardProps) {
  const { hasPermission } = useAuth();
  const [activeStep, setActiveStep] = useState(() =>
    initialStep || getInitialStepFromStatus(initialData?.status) || 1,
  );

  useEffect(() => {
    if (initialStep && initialStep !== activeStep) {
      setActiveStep(initialStep);
    }
  }, [initialStep]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeStep]);

  // Flight Details Form Inputs
  const routeParts = initialData?.route
    ? initialData.route.split(/➔|->|→/).map((s) => s.trim())
    : [];
  const [newFlight, setNewFlight] = useState(initialData?.flight || "");
  const [newDate, setNewDate] = useState(() =>
    toIsoDate(initialData?.cancellationDate || ""),
  );
  const [newDepartureAirport, setNewDepartureAirport] = useState(
    routeParts[0] || "",
  );
  const [newArrivalAirport, setNewArrivalAirport] = useState(
    routeParts[1] || "",
  );
  const [checkInDate, setCheckInDate] = useState(() =>
    toIsoDate(initialData?.cancellationDate || ""),
  );
  const [checkOutDate, setCheckOutDate] = useState("");
  const [selectedReasonTag, setSelectedReasonTag] = useState("");
  const [newReason, setNewReason] = useState(initialData?.reason || "");

  const [airports, setAirports] = useState<AirportOptionDTO[]>([]);
  const [isLoadingAirports, setIsLoadingAirports] = useState(false);

  useEffect(() => {
    if (activeStep !== 1) return;
    if (airports.length > 0) return;

    let isMounted = true;
    const fetchAirports = async () => {
      setIsLoadingAirports(true);
      try {
        const response = await airportsService.getAirportOptions({
          page: 1,
          limit: DROPDOWN_LIMIT,
        });
        if (isMounted && response?.airports && response.airports.length > 0) {
          setAirports(response.airports);
        }
      } catch (err) {
        if (isMounted) {
          setAirports([]);
        }
      } finally {
        if (isMounted) setIsLoadingAirports(false);
      }
    };
    fetchAirports();
    return () => {
      isMounted = false;
    };
  }, [activeStep, airports.length]);

  const airportOptions = useMemo(() => {
    return airports.map((a) => ({
      value: a.iataCode || String(a.id),
      label: `${a.iataCode} - ${a.name}`,
    }));
  }, [airports]);

  const resolveAirportId = (val: string): number => {
    if (!val) return 0;
    const found = airports.find(
      (a) =>
        (a.iataCode && a.iataCode.toUpperCase() === val.toUpperCase()) ||
        String(a.id) === val,
    );
    if (found) return found.id;
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed > 0) return parsed;
    return 0;
  };

  // Step 1 Validation & Error State (matching admin invite modal)
  type Step1Field =
    | "flightNumber"
    | "cancellationDate"
    | "departureAirport"
    | "arrivalAirport"
    | "checkInDate"
    | "checkOutDate";
  const [step1Errors, setStep1Errors] = useState<
    Partial<Record<Step1Field, string>>
  >({});
  const [step1Touched, setStep1Touched] = useState<
    Partial<Record<Step1Field, boolean>>
  >({});

  const validateStep1 = (
    field: Step1Field,
    val: string,
    currentValues?: {
      departureAirport?: string;
      arrivalAirport?: string;
      checkInDate?: string;
      checkOutDate?: string;
    },
  ): string => {
    const v = val?.trim() ?? "";
    switch (field) {
      case "flightNumber":
        if (!v) return "Flight Number is required";
        if (!/^[A-Z0-9]+$/i.test(v))
          return "Flight Number must contain only letters and numbers";
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
        if (dep && dep === val)
          return "Departure and Arrival airports cannot be the same";
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
      field === "flightNumber"
        ? newFlight
        : field === "cancellationDate"
          ? newDate
          : field === "departureAirport"
            ? newDepartureAirport
            : field === "arrivalAirport"
              ? newArrivalAirport
              : field === "checkInDate"
                ? checkInDate
                : checkOutDate;
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
      setStep1Errors((prev) => ({
        ...prev,
        cancellationDate: msg || undefined,
      }));
    }
  };

  const handleDepartureAirportChange = (val: string) => {
    setNewDepartureAirport(val);
    if (step1Touched.departureAirport) {
      const msg = validateStep1("departureAirport", val);
      setStep1Errors((prev) => ({
        ...prev,
        departureAirport: msg || undefined,
      }));
    }
    if (step1Touched.arrivalAirport && newArrivalAirport) {
      const msg = validateStep1("arrivalAirport", newArrivalAirport, {
        departureAirport: val,
      });
      setStep1Errors((prev) => ({ ...prev, arrivalAirport: msg || undefined }));
    }
  };

  const handleArrivalAirportChange = (val: string) => {
    setNewArrivalAirport(val);
    if (step1Touched.arrivalAirport) {
      const msg = validateStep1("arrivalAirport", val, {
        departureAirport: newDepartureAirport,
      });
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
      const msg = validateStep1("checkOutDate", checkOutDate, {
        checkInDate: val,
      });
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
      if (!initialStep) {
        setActiveStep(getInitialStepFromStatus(initialData.status));
      }
      if (initialData.status?.toLowerCase() === "paid") {
        setPaymentConfirmed(true);
      }
      setNewFlight(initialData.flight || "");
      setNewDate(toIsoDate(initialData.cancellationDate || ""));
      const parts = initialData.route
        ? initialData.route.split(/➔|->|→/).map((s) => s.trim())
        : [];
      setNewDepartureAirport(parts[0] || "");
      setNewArrivalAirport(parts[1] || "");
      const reasonVal = formatCancellationReason(initialData.reason);
      if (reasonVal !== "N/A") {
        setNewReason(reasonVal);
        setSelectedReasonTag(reasonVal);
      }
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
  const [resultsPerPage, setResultsPerPage] = useState(10);
  const [bookingPnr, setBookingPnr] = useState("");
  const [bookingFirstName, setBookingFirstName] = useState("");
  const [bookingLastName, setBookingLastName] = useState("");
  const [bookingEmail, setBookingEmail] = useState("");
  const [bookingPhone, setBookingPhone] = useState("");
  const [bookingClass, setBookingClass] = useState("");
  const [bookingAdults, setBookingAdults] = useState("1");
  const [bookingChildren, setBookingChildren] = useState("0");
  const [bookingNotesText, setBookingNotesText] = useState("");
  const [bookingResidency, setBookingResidency] = useState("");
  const [bookingChildAges, setBookingChildAges] = useState<string[]>([]);
  const [childAgesTouched, setChildAgesTouched] = useState(false);
  const childAgeErrors = bookingChildAges.map(validateChildAge);

  // Step 2 Validation & Error State (matching admin invite modal)
  type Step2Field =
    | "pnr"
    | "firstName"
    | "lastName"
    | "email"
    | "phone"
    | "residency"
    | "travelClass"
    | "adults"
    | "children";
  const [step2Errors, setStep2Errors] = useState<
    Partial<Record<Step2Field, string>>
  >({});
  const [step2Touched, setStep2Touched] = useState<
    Partial<Record<Step2Field, boolean>>
  >({});

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
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))
          return "Please enter a valid email address";
        return "";
      case "phone":
        if (!v) return "Phone number is required";
        if (!/^[\+]?[\d\s\-\(\)]{7,20}$/.test(v))
          return "Please enter a valid phone number";
        return "";
      case "residency":
        if (!v) return "Passport Country is required";
        return "";
      case "travelClass":
        if (!v) return "Travel Class is required";
        return "";
      case "adults":
        if (!v) return "Number of adults is required";
        if (isNaN(Number(v)) || Number(v) < 1)
          return "Adults must be at least 1";
        return "";
      case "children":
        if (v !== "" && (isNaN(Number(v)) || Number(v) < 0))
          return "Children count must be 0 or more";
        return "";
      default:
        return "";
    }
  };

  const handleStep2Blur = (field: Step2Field) => () => {
    setStep2Touched((prev) => ({ ...prev, [field]: true }));
    const val =
      field === "pnr"
        ? bookingPnr
        : field === "firstName"
          ? bookingFirstName
          : field === "lastName"
            ? bookingLastName
            : field === "email"
              ? bookingEmail
              : field === "residency"
                ? bookingResidency
              : field === "travelClass"
                ? bookingClass
                : field === "adults"
                  ? bookingAdults
                  : field === "children"
                    ? bookingChildren
                    : bookingPhone;
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

  const handleBookingResidencyChange = (val: string) => {
    setBookingResidency(val);
    setStep2Touched((prev) => ({ ...prev, residency: true }));
    const msg = validateStep2("residency", val);
    setStep2Errors((prev) => ({ ...prev, residency: msg || undefined }));
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

  const handleBookingChildrenChange = (val: string) => {
    setBookingChildren(val);
    setBookingChildAges((prev) =>
      resizeChildAges(prev, /^\d+$/.test(val.trim()) ? Number(val) : 0),
    );
    if (step2Touched.children) {
      const msg = validateStep2("children", val);
      setStep2Errors((prev) => ({ ...prev, children: msg || undefined }));
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
  // Failed CSV rows, kept on the server until fixed or deleted.
  const [failedBookings, setFailedBookings] = useState<FailedBookingDTO[]>([]);
  const [editingFailedId, setEditingFailedId] = useState<number | null>(null);
  const [bookingListTab, setBookingListTab] = useState<"failed" | "bookings">(
    "failed",
  );
  const [isDeleteAllFailedOpen, setIsDeleteAllFailedOpen] = useState(false);
  const [isDeletingFailed, setIsDeletingFailed] = useState(false);

  // Manifest File Upload (Excel simulator)
  const [isManifestUploaded, setIsManifestUploaded] = useState(false);
  const [manifestFileName, setManifestFileName] = useState("");

  const [createdFlightId, setCreatedFlightId] = useState<number | null>(() =>
    propFlightId ||
    (initialData?.id && !isNaN(Number(initialData.id))
      ? Number(initialData.id)
      : null),
  );
  const [isCreatingFlight, setIsCreatingFlight] = useState(false);

  const flightId =
    createdFlightId ||
    propFlightId ||
    (initialData?.id && !isNaN(Number(initialData.id))
      ? Number(initialData.id)
      : null);

  const changeStep = (nextStep: number, targetFlightId?: number | null) => {
    setActiveStep(nextStep);
    const currentFId = targetFlightId !== undefined ? targetFlightId : flightId;
    onStepChange?.(nextStep, currentFId);
  };

  useEffect(() => {
    if (flightId && !initialData) {
      (initialReview
        ? Promise.resolve({ data: initialReview })
        : cancellationService.reviewFlight(flightId)
      )
        .then((res) => {
          const f = res?.data?.flight || (res as any)?.flight;
          if (f) {
            if (f.flightNumber) setNewFlight(f.flightNumber);
            if (f.cancellationDate) setNewDate(toIsoDate(f.cancellationDate));
            // Stored stay dates (YYYY-MM-DD) override the cancellation-date default.
            if (f.checkInDate) setCheckInDate(toIsoDate(f.checkInDate));
            if (f.checkOutDate) setCheckOutDate(toIsoDate(f.checkOutDate));
            if (f.route?.departureAirport?.code)
              setNewDepartureAirport(f.route.departureAirport.code);
            if (f.route?.arrivalAirport?.code)
              setNewArrivalAirport(f.route.arrivalAirport.code);
            const reason = f.cancellationReasonText || f.cancellationReason;
            if (reason) {
              const reasonVal = formatCancellationReason(reason);
              if (reasonVal !== "N/A") {
                setNewReason(reasonVal);
                setSelectedReasonTag(reasonVal);
              }
            }
            if (f.status?.toLowerCase() === "paid") {
              setPaymentConfirmed(true);
            }
          }
        })
        .catch((err) => {
          console.error("Failed to load flight details in wizard:", err);
        });
    }
  }, [flightId, initialData]);

  const fetchBookings = async (fId: number) => {
    setIsLoadingBookings(true);
    try {
      const res = await cancellationService.listBookings(fId);
      const bookingsData =
        res?.data?.bookings || (Array.isArray(res?.data) ? res.data : []);
      if (Array.isArray(bookingsData)) {
        const mapped: ManualBooking[] = bookingsData.map((b: any) => ({
          id: String(b.id),
          pnr: b.pnr,
          firstName: b.firstName,
          lastName: b.lastName,
          email: b.email,
          phone: b.phone,
          residency: b.residency,
          travelClass: ENUM_TO_TRAVEL_CLASS[b.travelClass] ?? b.travelClass,
          adults: b.adults || 1,
          children: b.children || 0,
          childAges: Array.isArray(b.childAges) ? b.childAges : [],
          specialNotes: b.specialNotes || "",
        }));
        setAddedBookings(mapped);
      }
    } catch (err: any) {
      console.error("Failed to load bookings:", err);
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const fetchFailedBookings = async (fId: number) => {
    try {
      setFailedBookings(await cancellationService.listFailedBookings(fId));
    } catch (err: unknown) {
      console.error("Failed to load failed bookings:", err);
    }
  };

  // Step 3 Review state
  const [reviewData, setReviewData] = useState<ReviewFlightResponse | null>(
    initialReview ?? null,
  );
  // Used once, for the step the page was opened on.
  const preloadedReviewRef = useRef(initialReview ?? null);
  const [isLoadingReview, setIsLoadingReview] = useState(false);

  // Step 4 Allocation state
  const [selectedHotels, setSelectedHotels] = useState<string[]>([]);
  const [isAutoAllocate, setIsAutoAllocate] = useState(true);
  const [isAllocating, setIsAllocating] = useState(false);
  const [hotelAllocations, setHotelAllocations] =
    useState<HotelAllocationsResponse | null>(null);
  const [allocationError, setAllocationError] = useState<string | null>(null);
  const [failedBookingForHotel, setFailedBookingForHotel] =
    useState<HotelAllocationBookingResult | null>(null);
  const [isCheckingAllocation, setIsCheckingAllocation] = useState(false);
  const [allocationRunProgress, setAllocationRunProgress] = useState<{
    done: number;
    total: number;
    booked: number;
    manualReview: number;
    failed: number;
    // False while the server is still searching hotels and planning rooms.
    isBooking: boolean;
  } | null>(null);
  const allocationPollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const isPollingAllocationRef = useRef(false);

  // Step 5 Booking Summary state
  const [isExportingReport, setIsExportingReport] = useState(false);

  const fetchReviewData = async (fId: number) => {
    setIsLoadingReview(true);
    try {
      const res = await cancellationService.reviewFlight(fId);
      const data = res?.data || res;
      setReviewData(data);
      if (data?.flight) {
        if (data.flight.flightNumber) setNewFlight(data.flight.flightNumber);
        if (data.flight.cancellationDate)
          setNewDate(toIsoDate(data.flight.cancellationDate));
        if (data.flight.route?.departureAirport?.code) {
          setNewDepartureAirport(data.flight.route.departureAirport.code);
        }
        if (data.flight.route?.arrivalAirport?.code) {
          setNewArrivalAirport(data.flight.route.arrivalAirport.code);
        }
        const reasonVal = formatCancellationReason(
          data.flight.cancellationReasonText || data.flight.cancellationReason,
        );
        if (reasonVal !== "N/A") {
          setNewReason(reasonVal);
          setSelectedReasonTag(reasonVal);
        }
      }
    } catch (err: any) {
      console.error("Failed to load flight review:", err);
      toast.error(err.message || "Failed to load flight review details");
    } finally {
      setIsLoadingReview(false);
    }
  };

  // Step 5 Hotel Summary & Hotel Bookings state
  const [hotelSummary, setHotelSummary] =
    useState<HotelSummaryCancelledFlightSummaryDto | null>(null);
  const [isLoadingHotelSummary, setIsLoadingHotelSummary] = useState(false);
  const [hotelBookings, setHotelBookings] = useState<HotelBookingItemDTO[]>([]);
  const [totalHotelBookings, setTotalHotelBookings] = useState(0);
  const [isLoadingHotelBookings, setIsLoadingHotelBookings] = useState(false);
  const [step5CurrentPage, setStep5CurrentPage] = useState(1);
  const [step5ResultsPerPage, setStep5ResultsPerPage] = useState(10);

  // Payment is only allowed once every PNR has a confirmed hotel booking.
  const [step5BookingProgress, setStep5BookingProgress] =
    useState<HotelAllocationProgressResponse | null>(null);
  const [isLoadingStep5Progress, setIsLoadingStep5Progress] = useState(false);
  const allPnrsBooked = step5BookingProgress?.fullyBooked === true;

  const isFetchingHotelSummaryRef = useRef(false);
  const isFetchingHotelBookingsRef = useRef(false);

  const fetchStep5BookingProgress = async (fId: number) => {
    setIsLoadingStep5Progress(true);
    try {
      const res = await cancellationService.getHotelAllocationProgress(fId);
      setStep5BookingProgress(res?.data || res);
    } catch (err: any) {
      console.error("Failed to load hotel booking progress:", err);
      setStep5BookingProgress(null);
    } finally {
      setIsLoadingStep5Progress(false);
    }
  };

  const fetchHotelSummary = async (fId: number) => {
    if (isFetchingHotelSummaryRef.current) return;
    isFetchingHotelSummaryRef.current = true;
    setIsLoadingHotelSummary(true);
    try {
      const res = await cancellationService.getHotelSummary(fId);
      const summary =
        res?.data?.summary || (res?.data as any) || (res as any)?.summary;
      if (summary) {
        setHotelSummary({
          totalBookings: Number(summary.totalBookings ?? 0),
          totalAdults: Number(summary.totalAdults ?? 0),
          totalChildren: Number(summary.totalChildren ?? 0),
          totalRooms: Number(summary.totalRooms ?? 0),
          totalHotelCost: Number(summary.totalHotelCost ?? 0),
          totalDiscount: Number(summary.totalDiscount ?? 0),
          totalHotelTax: Number(summary.totalHotelTax ?? 0),
          totalPlatformFee: Number(summary.totalPlatformFee ?? 0),
          totalPayable: Number(summary.totalPayable ?? 0),
        });
      }
    } catch (err: any) {
      console.error("Failed to load hotel summary:", err);
    } finally {
      setIsLoadingHotelSummary(false);
      isFetchingHotelSummaryRef.current = false;
    }
  };

  const fetchHotelBookings = async (fId: number, page = 1, limit = 10) => {
    if (isFetchingHotelBookingsRef.current) return;
    isFetchingHotelBookingsRef.current = true;
    setIsLoadingHotelBookings(true);
    try {
      const res = await cancellationService.listHotelBookings(fId, {
        page,
        limit,
      });
      const data = res?.data || (res as any);
      if (data?.hotelBookings) {
        setHotelBookings(data.hotelBookings);
        setTotalHotelBookings(
          data.totalHotelBookings ?? data.hotelBookings.length,
        );
      }
    } catch (err: any) {
      console.error("Failed to load hotel bookings:", err);
    } finally {
      setIsLoadingHotelBookings(false);
      isFetchingHotelBookingsRef.current = false;
    }
  };

  useEffect(() => {
    const preloadedReview = preloadedReviewRef.current;
    preloadedReviewRef.current = null;
    if (activeStep === 2 && flightId) {
      fetchBookings(flightId);
      fetchFailedBookings(flightId);
    } else if (activeStep === 3 && flightId) {
      if (!preloadedReview) fetchReviewData(flightId);
      if (addedBookings.length === 0) {
        fetchBookings(flightId);
      }
    } else if (
      (activeStep === 5 || activeStep === 6 || activeStep === 7) &&
      flightId
    ) {
      fetchHotelSummary(flightId);
    }
  }, [activeStep, flightId]);

  useEffect(() => {
    if (activeStep === 5 && flightId) {
      fetchHotelBookings(flightId, step5CurrentPage, step5ResultsPerPage);
    }
  }, [activeStep, flightId, step5CurrentPage, step5ResultsPerPage]);

  useEffect(() => {
    if (activeStep === 5 && flightId) {
      fetchStep5BookingProgress(flightId);
    }
  }, [activeStep, flightId]);

  const ALLOCATION_POLL_MS = 3000;
  const ALLOCATION_POLL_MAX_MS = 8000;
  const MAX_ALLOCATION_POLL_ERRORS = 5;
  const allocationPollDelayRef = useRef(ALLOCATION_POLL_MS);
  const allocationLastProcessedRef = useRef(-1);
  // PNRs already processed when polling started (e.g. booked in an earlier run).
  const allocationStartProcessedRef = useRef(-1);
  // The server doesn't report planning sub-steps, so they advance on a timer
  // and the last one stays active until booking starts.
  const ALLOCATION_PLANNING_STEP_MS = 4000;
  const [allocationPlanningStep, setAllocationPlanningStep] = useState(0);
  const isAllocationBooking = allocationRunProgress?.isBooking ?? false;

  useEffect(() => {
    if (!isAllocating || isAllocationBooking) return;
    const timer = setInterval(() => {
      setAllocationPlanningStep((step) => Math.min(step + 1, 2));
    }, ALLOCATION_PLANNING_STEP_MS);
    return () => clearInterval(timer);
  }, [isAllocating, isAllocationBooking]);

  const stopAllocationPolling = () => {
    isPollingAllocationRef.current = false;
    if (allocationPollTimerRef.current) {
      clearTimeout(allocationPollTimerRef.current);
      allocationPollTimerRef.current = null;
    }
  };

  useEffect(() => stopAllocationPolling, []);

  const finishAllocation = (allocData: HotelAllocationsResponse) => {
    stopAllocationPolling();
    setIsAllocating(false);
    setAllocationRunProgress(null);
    // Each booked PNR was charged to the wallet: refresh the top bar balance.
    notifyWalletBalanceChanged();
    const anythingBooked = (allocData.successfulPnrs ?? 0) > 0;
    if (allocData.lastRunError) {
      setAllocationError(allocData.lastRunError);
      toast.error(allocData.lastRunError);
      if (!anythingBooked) return;
    }
    setHotelAllocations(allocData);
    if (allocData.fullyBooked) changeStep(5);
    showAllocationOutcome(allocData);
  };

  const pollAllocationStatus = async (fId: number, consecutiveErrors = 0) => {
    if (!isPollingAllocationRef.current) return;
    let nextErrors = consecutiveErrors;
    // Skip requests while the tab is hidden; polling resumes on the next tick.
    if (!document.hidden) {
      try {
        const res = await cancellationService.getHotelAllocationProgress(fId);
        if (!isPollingAllocationRef.current) return;
        const progress: HotelAllocationProgressResponse = res?.data || res;
        nextErrors = 0;
        if (!progress.running) {
          const fullRes =
            await cancellationService.getHotelAllocationStatus(fId);
          if (!isPollingAllocationRef.current) return;
          finishAllocation(fullRes?.data || fullRes);
          return;
        }
        const done = progress.processedPnrs ?? 0;
        const total = progress.totalPnrs ?? 0;
        if (allocationStartProcessedRef.current < 0) {
          allocationStartProcessedRef.current = done;
        }
        // Booking has started once a PNR is being booked or newly processed.
        const bookingStarted =
          (progress.pendingPnrs ?? 0) > 0 ||
          done > allocationStartProcessedRef.current;
        setAllocationRunProgress((prev) => ({
          done,
          total,
          booked: progress.successfulPnrs ?? 0,
          manualReview: progress.manualCheckPnrs ?? 0,
          failed: progress.failedPnrs ?? 0,
          isBooking: (prev?.isBooking ?? false) || bookingStarted,
        }));
        allocationPollDelayRef.current =
          done === allocationLastProcessedRef.current
            ? Math.min(
                allocationPollDelayRef.current * 1.5,
                ALLOCATION_POLL_MAX_MS,
              )
            : ALLOCATION_POLL_MS;
        allocationLastProcessedRef.current = done;
      } catch {
        if (!isPollingAllocationRef.current) return;
        nextErrors = consecutiveErrors + 1;
        if (nextErrors >= MAX_ALLOCATION_POLL_ERRORS) {
          stopAllocationPolling();
          setIsAllocating(false);
          setAllocationError(
            "Lost connection while checking hotel allocation progress. Booking continues on the server; reopen this flight to see the latest status.",
          );
          return;
        }
      }
    }
    allocationPollTimerRef.current = setTimeout(
      () => pollAllocationStatus(fId, nextErrors),
      allocationPollDelayRef.current,
    );
  };

  const startAllocationPolling = (fId: number) => {
    if (isPollingAllocationRef.current) return;
    isPollingAllocationRef.current = true;
    allocationPollDelayRef.current = ALLOCATION_POLL_MS;
    allocationLastProcessedRef.current = -1;
    allocationStartProcessedRef.current = -1;
    setAllocationRunProgress(null);
    setAllocationPlanningStep(0);
    setIsAllocating(true);
    setAllocationError(null);
    allocationPollTimerRef.current = setTimeout(
      () => pollAllocationStatus(fId),
      ALLOCATION_POLL_MS,
    );
  };

  useEffect(() => {
    if (activeStep !== 4 || !flightId || isPollingAllocationRef.current) return;
    let cancelled = false;
    setIsCheckingAllocation(true);
    cancellationService
      .getHotelAllocationProgress(flightId)
      .then((res) => {
        const data: HotelAllocationProgressResponse = res?.data || res;
        if (cancelled) return;
        if (data?.running) {
          startAllocationPolling(flightId);
          return;
        }
        if (data?.lastRunError) {
          setAllocationError(data.lastRunError);
        }
        // Show earlier results when allocation already ran for this flight.
        if (data && data.notStartedPnrs < data.totalPnrs) {
          return cancellationService
            .getHotelAllocationStatus(flightId)
            .then((full) => {
              if (!cancelled) setHotelAllocations(full?.data || full);
            });
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setIsCheckingAllocation(false);
      });
    return () => {
      cancelled = true;
      setIsCheckingAllocation(false);
    };
  }, [activeStep, flightId]);

  // Refresh once just after the next supplier check is due, so retry unlocks.
  const SUPPLIER_CHECK_BUFFER_MS = 10000;
  const SUPPLIER_CHECK_LATE_RETRY_MS = 30000;
  useEffect(() => {
    if (
      activeStep !== 4 ||
      !flightId ||
      isAllocating ||
      !hotelAllocations?.awaitingSupplierCheck
    ) {
      return;
    }
    const untilDue =
      Date.parse(hotelAllocations.nextSupplierCheckAt ?? "") - Date.now();
    const delay =
      untilDue > 0
        ? untilDue + SUPPLIER_CHECK_BUFFER_MS
        : SUPPLIER_CHECK_LATE_RETRY_MS;
    let cancelled = false;
    const timer = setTimeout(() => {
      cancellationService
        .getHotelAllocationStatus(flightId)
        .then((full) => {
          if (!cancelled) setHotelAllocations(full?.data || full);
        })
        .catch(() => {
          if (!cancelled) setHotelAllocations((prev) => prev && { ...prev });
        });
    }, delay);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeStep, flightId, isAllocating, hotelAllocations]);

  // Drawer bookings run in the background; refresh until none is in progress.
  const PENDING_BOOKING_REFRESH_MS = 5000;
  const hasPendingBooking = !!hotelAllocations?.results?.some(
    (r) => r.bookingStatus === "PENDING",
  );
  useEffect(() => {
    if (activeStep !== 4 || !flightId || isAllocating || !hasPendingBooking) {
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      cancellationService
        .getHotelAllocationStatus(flightId)
        .then((full) => {
          if (!cancelled) setHotelAllocations(full?.data || full);
        })
        .catch(() => {
          if (!cancelled) setHotelAllocations((prev) => prev && { ...prev });
        });
    }, PENDING_BOOKING_REFRESH_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeStep, flightId, isAllocating, hasPendingBooking, hotelAllocations]);

  // Go to the summary when the last PNR gets booked while this step is open.
  const wasFullyBookedRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (activeStep !== 4 || !hotelAllocations) {
      wasFullyBookedRef.current = null;
      return;
    }
    const fullyBooked = hotelAllocations.fullyBooked;
    if (fullyBooked && wasFullyBookedRef.current === false) {
      toast.success("All bookings confirmed");
      changeStep(5);
    }
    wasFullyBookedRef.current = fullyBooked;
  }, [activeStep, hotelAllocations]);

  const handleAllocateHotels = async () => {
    if (isPollingAllocationRef.current) return;
    setIsAllocating(true);
    setAllocationError(null);

    if (!flightId) {
      setTimeout(() => {
        stopAllocationPolling();
        setIsAllocating(false);
        setActiveStep(5);
      }, 1500);
      return;
    }

    try {
      const allocRes = await cancellationService.allocateHotels(flightId);
      const allocData: HotelAllocationsResponse = allocRes?.data || allocRes;
      if (allocData?.running) {
        startAllocationPolling(flightId);
      } else {
        finishAllocation(allocData);
      }
    } catch (error: any) {
      if (error?.status === 409) {
        startAllocationPolling(flightId);
        return;
      }
      stopAllocationPolling();
      setIsAllocating(false);
      setAllocationError(error.message || "Failed to allocate hotels");
      toast.error(error.message || "Failed to allocate hotels");
    }
  };

  const showAllocationOutcome = (
    allocData?: HotelAllocationsResponse | null,
  ) => {
    if (!allocData?.results) {
      toast.success("Hotels booked successfully");
      return;
    }
    const pnrsWith = (status: string) =>
      allocData.results
        .filter((r) => r.bookingStatus === status)
        .map((r) => r.pnr);
    const failed = pnrsWith("FAILED");
    const manual = pnrsWith("MANUAL_CHECK");
    const confirmed = allocData.successfulPnrs ?? 0;
    const total = allocData.totalPnrs ?? allocData.results.length;
    if (allocData.fullyBooked) {
      toast.success(`All ${confirmed} booking(s) confirmed with the hotels`);
      return;
    }
    if (confirmed > 0) {
      toast.success(
        `${confirmed} of ${total} booking(s) confirmed with the hotels`,
      );
    }
    if (failed.length > 0) {
      toast.error(
        `No hotel could be booked for ${failed.length} booking(s): ${failed.join(", ")}. Run allocation again to retry them.`,
      );
    }
    if (manual.length > 0) {
      toast.warning(
        `${manual.length} booking(s) need a manual check with the supplier before rebooking: ${manual.join(", ")}`,
      );
    }
  };

  const handleExportReport = async () => {
    if (!flightId || isExportingReport) return;
    setIsExportingReport(true);
    try {
      await cancellationService.exportFlightReport(flightId);
    } catch (error: any) {
      toast.error(error?.message || "Failed to export flight report.");
    } finally {
      setIsExportingReport(false);
    }
  };

  // Step 6 Payment state
  const [paymentMethod, setPaymentMethod] = useState("visa");
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(
    () => initialData?.status?.toLowerCase() === "paid",
  );
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  // Step 3 Passenger Booking Detail Drawer state
  const [isPassengerBookingDrawerOpen, setIsPassengerBookingDrawerOpen] =
    useState(false);
  const [selectedPassengerBooking, setSelectedPassengerBooking] =
    useState<any>(null);

  // Step 5 Drawer state
  const [isBookingDetailsOpen, setIsBookingDetailsOpen] = useState(false);
  const [selectedBookingForDrawer, setSelectedBookingForDrawer] =
    useState<any>(null);
  const [selectedDrawerFlightId, setSelectedDrawerFlightId] = useState<
    number | string | null
  >(null);
  const [selectedDrawerHotelBookingId, setSelectedDrawerHotelBookingId] =
    useState<number | string | null>(null);
  const [selectedDrawerDetailData, setSelectedDrawerDetailData] =
    useState<HotelBookingDetailDataDto | null>(null);
  const [loadingEyeBookingId, setLoadingEyeBookingId] = useState<
    number | string | null
  >(null);

  const handleOpenBookingDetails = async (
    hb: HotelBookingItemDTO,
    pb: any,
    hotelBookingId: string,
    hotelName: string,
    rating: string,
    rooms: number,
    bookingCost: number,
    travelClass: string,
  ) => {
    const fId = hb.cancelledFlightId || flightId;
    setSelectedBookingForDrawer({
      ...pb,
      hotelBookingId,
      hotelName,
      rating,
      totalRooms: rooms,
      totalCost: bookingCost,
      travelClass,
    });
    setSelectedDrawerFlightId(fId);
    setSelectedDrawerHotelBookingId(hb.id);

    if (!fId || !hb.id) {
      setSelectedDrawerDetailData(null);
      setIsBookingDetailsOpen(true);
      return;
    }

    setLoadingEyeBookingId(hb.id);
    try {
      const res = await cancellationService.getHotelBookingDetail(fId, hb.id);
      if (res?.data) {
        setSelectedDrawerDetailData(res.data);
      } else {
        setSelectedDrawerDetailData(null);
      }
    } catch (err: any) {
      console.error("Failed to fetch hotel booking details:", err);
      setSelectedDrawerDetailData(null);
    } finally {
      setLoadingEyeBookingId(null);
      setIsBookingDetailsOpen(true);
    }
  };

  // Step 3 Pagination state
  const [step3CurrentPage, setStep3CurrentPage] = useState(1);
  const [step3ResultsPerPage, setStep3ResultsPerPage] = useState(10);

  // Step 7 Publish state
  const [notifySMS, setNotifySMS] = useState(true);
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifyGround, setNotifyGround] = useState(true);
  const [isPublishingFlight, setIsPublishingFlight] = useState(false);

  const totalBookingsCount =
    hotelSummary?.totalBookings ?? addedBookings.length;
  const totalAdultsCount =
    hotelSummary?.totalAdults ??
    addedBookings.reduce((sum, b) => sum + (b.adults || 0), 0);
  const totalChildrenCount =
    hotelSummary?.totalChildren ??
    addedBookings.reduce((sum, b) => sum + (b.children || 0), 0);
  const totalPassengersCount = totalAdultsCount + totalChildrenCount;
  const totalRoomsCount = hotelSummary?.totalRooms ?? 0;
  const hotelCost = hotelSummary?.totalHotelCost ?? 0;
  const platformDiscount = hotelSummary?.totalDiscount ?? 0;
  const hotelTax = hotelSummary?.totalHotelTax ?? 0;
  const platformFee = hotelSummary?.totalPlatformFee ?? 0;
  const totalPayment = hotelSummary?.totalPayable ?? 0;
  const currencySymbol = "$";

  const handleTagClick = (tag: string) => {
    if (selectedReasonTag === tag) {
      setSelectedReasonTag("");
      setNewReason("");
    } else {
      setSelectedReasonTag(tag);
      setNewReason(tag);
    }
  };

  const simulateCsvUpload = () => {
    setIsManifestUploaded(true);
    setManifestFileName(
      "passenger_manifest_" + (newFlight || "SW1234") + ".csv",
    );

    // Add mock bookings
    const mockBookings: ManualBooking[] = [
      {
        id: "mock1",
        pnr: "DDJU34",
        firstName: "New",
        lastName: "Admin",
        email: "ops@summitair.com",
        phone: "+1 555 020 0000",
        residency: "US",
        travelClass: "Economy",
        adults: 1,
        children: 0,
        childAges: [],
        specialNotes: "Dietary Requirements",
      },
      {
        id: "mock2",
        pnr: "PNR992",
        firstName: "Jane",
        lastName: "Smith",
        email: "jane.smith@email.com",
        phone: "+1 555 999 1122",
        residency: "GB",
        travelClass: "Business",
        adults: 2,
        children: 1,
        childAges: [7],
        specialNotes: "Wheelchair Assistance",
      },
    ];
    setAddedBookings(mockBookings);
  };

  const resetBookingForm = () => {
    setEditingBookingId(null);
    setEditingFailedId(null);
    setBookingPnr("");
    setBookingFirstName("");
    setBookingLastName("");
    setBookingEmail("");
    setBookingPhone("");
    setBookingResidency("");
    setBookingClass("");
    setBookingAdults("1");
    setBookingChildren("0");
    setBookingChildAges([]);
    setChildAgesTouched(false);
    setBookingNotesText("");
    setStep2Errors({});
    setStep2Touched({});
  };

  const scrollToBookingForm = () => {
    setTimeout(() => {
      const pnrInput = document.querySelector(
        'input[placeholder="e.g., ABC123"]',
      );
      pnrInput?.scrollIntoView({ behavior: "smooth", block: "center" });
      (pnrInput as HTMLInputElement)?.focus();
    }, 50);
  };

  /** Loads a failed CSV row into the form, with its errors shown. */
  const handleEditFailedBooking = (failed: FailedBookingDTO) => {
    const v = failed.values;
    resetBookingForm();
    setBookingTab("manual");
    setEditingFailedId(failed.id);
    setBookingPnr(v.pnr);
    setBookingFirstName(v.firstName);
    setBookingLastName(v.lastName);
    setBookingEmail(v.email);
    setBookingPhone(v.phone);
    // Only a recognised code/value fits the dropdowns; otherwise pick again.
    setBookingResidency(
      COUNTRY_OPTIONS.some((o) => o.value === v.residency) ? v.residency : "",
    );
    setBookingClass(ENUM_TO_TRAVEL_CLASS[v.travelClass] ?? "");
    setBookingAdults(v.adults);
    setBookingChildren(v.children);
    setBookingChildAges(
      resizeChildAges(
        v.childAges,
        /^\d+$/.test(v.children) ? Number(v.children) : 0,
      ),
    );
    setBookingNotesText(v.specialNotes);

    const values: Record<Step2Field, string> = {
      pnr: v.pnr,
      firstName: v.firstName,
      lastName: v.lastName,
      email: v.email,
      phone: v.phone,
      residency: COUNTRY_OPTIONS.some((o) => o.value === v.residency)
        ? v.residency
        : "",
      travelClass: ENUM_TO_TRAVEL_CLASS[v.travelClass] ?? "",
      adults: v.adults,
      children: v.children,
    };
    const errs: Partial<Record<Step2Field, string>> = {};
    const touched: Partial<Record<Step2Field, boolean>> = {};
    (Object.keys(values) as Step2Field[]).forEach((field) => {
      // The import's own message first: it names the bad value, which the
      // dropdowns can't show (e.g. an unknown travel class becomes blank).
      const serverError = failed.errors.find((e) => e.field === field);
      const msg = serverError?.message || validateStep2(field, values[field]);
      if (msg) errs[field] = msg;
      touched[field] = true;
    });
    setStep2Errors(errs);
    setStep2Touched(touched);
    setChildAgesTouched(true);
    scrollToBookingForm();
  };

  const handleDeleteFailedBooking = async (failed: FailedBookingDTO) => {
    if (!flightId) return;
    try {
      await cancellationService.deleteFailedBooking(flightId, failed.id);
      setFailedBookings((prev) => prev.filter((f) => f.id !== failed.id));
      if (editingFailedId === failed.id) resetBookingForm();
      toast.success(`Failed booking (row ${failed.rowNumber}) deleted`);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete failed booking",
      );
    }
  };

  const handleDeleteAllFailedBookings = async () => {
    if (!flightId) return;
    setIsDeletingFailed(true);
    try {
      const res = await cancellationService.deleteAllFailedBookings(flightId);
      setFailedBookings([]);
      if (editingFailedId !== null) resetBookingForm();
      setIsDeleteAllFailedOpen(false);
      toast.success(res?.message || "Failed bookings deleted");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete failed bookings",
      );
    } finally {
      setIsDeletingFailed(false);
    }
  };

  const handleEditBooking = (booking: ManualBooking) => {
    resetBookingForm();
    setBookingTab("manual");
    setEditingBookingId(booking.id);
    setBookingPnr(booking.pnr || "");
    setBookingFirstName(booking.firstName || "");
    setBookingLastName(booking.lastName || "");
    setBookingEmail(booking.email || "");
    setBookingPhone(booking.phone || "");
    setBookingResidency(booking.residency || "");
    setBookingClass(booking.travelClass || "");
    setBookingAdults(String(booking.adults ?? 1));
    setBookingChildren(String(booking.children ?? 0));
    setBookingChildAges(
      resizeChildAges(
        (booking.childAges ?? []).map(String),
        booking.children ?? 0,
      ),
    );
    setBookingNotesText(booking.specialNotes || "");
    scrollToBookingForm();
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

  const handleCsvFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (
      !file.name.toLowerCase().endsWith(".csv") &&
      file.type !== "text/csv" &&
      file.type !== "application/csv"
    ) {
      toast.error("Please upload a valid .csv file.");
      return;
    }

    setManifestFileName(file.name);
    setIsUploadingCsv(true);

    if (flightId) {
      try {
        const res = await cancellationService.importBookings(flightId, file);
        setIsManifestUploaded(true);
        const summary = res?.data?.summary ?? null;
        setImportSummary(summary);
        await Promise.all([
          fetchBookings(flightId),
          fetchFailedBookings(flightId),
        ]);
        if (summary && summary.errorBookings > 0) {
          setBookingListTab("failed");
          toast.warning(
            res?.message ||
              `${summary.validBookings} booking(s) imported, ${summary.errorBookings} failed`,
          );
        } else {
          toast.success(res?.message || "Bookings imported successfully");
        }
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
    const fields: Step2Field[] = [
      "pnr",
      "firstName",
      "lastName",
      "email",
      "phone",
      "residency",
      "travelClass",
      "adults",
      "children",
    ];
    const values: Record<Step2Field, string> = {
      pnr: bookingPnr,
      firstName: bookingFirstName,
      lastName: bookingLastName,
      email: bookingEmail,
      phone: bookingPhone,
      residency: bookingResidency,
      travelClass: bookingClass,
      adults: bookingAdults,
      children: bookingChildren,
    };
    const errs: Partial<Record<Step2Field, string>> = {};
    for (const f of fields) {
      const msg = validateStep2(f, values[f]);
      if (msg) errs[f] = msg;
    }
    const adults = Number(bookingAdults);
    const children = Number(bookingChildren) || 0;
    const hasAgeErrors = bookingChildAges.some((age) => validateChildAge(age));

    if (Object.keys(errs).length > 0 || hasAgeErrors) {
      setStep2Errors(errs);
      setStep2Touched({
        pnr: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        residency: true,
        travelClass: true,
        adults: true,
        children: true,
      });
      setChildAgesTouched(true);
      setTimeout(() => {
        const first = document.querySelector(".step2-field-error");
        first?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 50);
      return;
    }

    const childAges = bookingChildAges.map(Number);
    const notes = bookingNotesText.trim();
    const payload: CreateBookingPayload = {
      pnr: bookingPnr.trim().toUpperCase(),
      firstName: bookingFirstName.trim(),
      lastName: bookingLastName.trim(),
      email: bookingEmail.trim(),
      phone: bookingPhone.trim(),
      residency: bookingResidency,
      travelClass: TRAVEL_CLASS_TO_ENUM[bookingClass],
      adults,
      children,
      childAges,
      specialNotes: notes || undefined,
    };
    const localBooking = {
      pnr: payload.pnr,
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      phone: payload.phone,
      residency: bookingResidency,
      travelClass: bookingClass,
      adults,
      children,
      childAges,
      specialNotes: notes,
    };

    setIsSavingBooking(true);
    try {
      if (editingFailedId !== null && flightId) {
        // Fixing a failed CSV row: saved as a booking, the failed row removed.
        const res = await cancellationService.resolveFailedBooking(
          flightId,
          editingFailedId,
          payload,
        );
        await Promise.all([
          fetchBookings(flightId),
          fetchFailedBookings(flightId),
        ]);
        toast.success(res?.message || "Booking saved");
      } else if (editingBookingId) {
        if (flightId) {
          await cancellationService.updateBooking(flightId, editingBookingId, {
            ...payload,
            // null clears the notes on update; undefined would leave them as they were.
            specialNotes: notes || null,
          });
          await fetchBookings(flightId);
        } else {
          setAddedBookings((prev) =>
            prev.map((b) =>
              b.id === editingBookingId ? { ...b, ...localBooking } : b,
            ),
          );
        }
        toast.success("Booking updated successfully");
      } else {
        if (flightId) {
          const res = await cancellationService.addBooking(flightId, payload);
          await fetchBookings(flightId);
          toast.success(res?.message || "Booking added successfully");
        } else {
          setAddedBookings((prev) => [
            ...prev,
            { id: String(Date.now()), ...localBooking },
          ]);
          toast.success("Booking added");
        }
      }

      resetBookingForm();
    } catch (error: any) {
      toast.error(error.message || "Failed to save booking");
    } finally {
      setIsSavingBooking(false);
    }
  };

  const handlePrevStep = () => {
    if (activeStep > 1) {
      changeStep(activeStep - 1);
    }
  };

  const handleBackToCancelledFlights = () => {
    onClose();
  };

  const saveFlightStep1 = async (advance = true) => {
    const errs: Partial<Record<Step1Field, string>> = {};
    const flightErr = validateStep1("flightNumber", newFlight);
    if (flightErr) errs.flightNumber = flightErr;

    const dateErr = validateStep1("cancellationDate", newDate);
    if (dateErr) errs.cancellationDate = dateErr;

    const depErr = validateStep1("departureAirport", newDepartureAirport);
    if (depErr) errs.departureAirport = depErr;

    const arrErr = validateStep1("arrivalAirport", newArrivalAirport, {
      departureAirport: newDepartureAirport,
    });
    if (arrErr) errs.arrivalAirport = arrErr;

    const checkInErr = validateStep1("checkInDate", checkInDate);
    if (checkInErr) errs.checkInDate = checkInErr;

    const checkOutErr = validateStep1("checkOutDate", checkOutDate, {
      checkInDate,
    });
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

    const depId = resolveAirportId(newDepartureAirport);
    const arrId = resolveAirportId(newArrivalAirport);

    if (depId === arrId) {
      toast.error("Departure and arrival airports must be different");
      return;
    }

    setIsCreatingFlight(true);
    try {
      const formattedDate = toIsoDate(newDate);
      const reasonEnum = mapCancellationReason(selectedReasonTag, newReason);
      const reasonText = newReason.trim() || selectedReasonTag || undefined;

      if (flightId) {
        const updatePayload: UpdateCancelledFlightPayload = {
          flightNumber: newFlight.trim(),
          departureAirportId: depId,
          arrivalAirportId: arrId,
          cancellationDate: formattedDate,
          checkInDate: toIsoDate(checkInDate),
          checkOutDate: toIsoDate(checkOutDate),
          cancellationReason: reasonEnum || null,
          cancellationReasonText: reasonText || null,
        };
        const response = await cancellationService.updateCancelledFlight(
          flightId,
          updatePayload,
        );
        toast.success(
          response?.message || "Cancelled flight updated successfully",
        );
        if (advance) {
          changeStep(2, flightId);
        }
      } else {
        const createPayload: CreateCancelledFlightPayload = {
          flightNumber: newFlight.trim(),
          departureAirportId: depId,
          arrivalAirportId: arrId,
          cancellationDate: formattedDate,
          checkInDate: toIsoDate(checkInDate),
          checkOutDate: toIsoDate(checkOutDate),
          ...(reasonEnum ? { cancellationReason: reasonEnum } : {}),
          ...(reasonText ? { cancellationReasonText: reasonText } : {}),
        };
        const response =
          await cancellationService.createCancelledFlight(createPayload);

        const newId = response?.data?.id || flightId;
        if (response?.data?.id) {
          setCreatedFlightId(response.data.id);
        }
        toast.success(response?.message || "Cancelled flight created");

        if (advance) {
          changeStep(2, newId);
        }
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to save cancelled flight details");
    } finally {
      setIsCreatingFlight(false);
    }
  };

  const handlePublishFlight = async () => {
    if (!flightId) {
      const added: Cancellation = {
        id: String(initialData?.id || Date.now()),
        flight: newFlight,
        route:
          newDepartureAirport && newArrivalAirport
            ? `${newDepartureAirport} ➔ ${newArrivalAirport}`
            : "",
        cancellationDate: newDate
          ? new Date(newDate).toISOString()
          : new Date().toISOString(),
        bookings: totalBookingsCount,
        passengers: totalPassengersCount,
        totalCost: totalPayment,
        status: "Published",
        reason: formatCancellationReason(newReason || selectedReasonTag),
      };
      toast.success("Cancelled flight published successfully");
      if (onSave) {
        onSave(added);
      } else {
        onClose();
      }
      return;
    }

    setIsPublishingFlight(true);
    try {
      const res = await cancellationService.publishFlight(flightId);
      toast.success(res?.message || "Cancelled flight published successfully");
      const added: Cancellation = {
        id: String(flightId),
        flight: newFlight,
        route:
          newDepartureAirport && newArrivalAirport
            ? `${newDepartureAirport} ➔ ${newArrivalAirport}`
            : "",
        cancellationDate: newDate
          ? new Date(newDate).toISOString()
          : new Date().toISOString(),
        bookings: totalBookingsCount,
        passengers: totalPassengersCount,
        totalCost: totalPayment,
        status: "Published",
        reason: formatCancellationReason(newReason || selectedReasonTag),
      };
      if (onSave) {
        onSave(added);
      } else {
        onClose();
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to publish cancelled flight");
    } finally {
      setIsPublishingFlight(false);
    }
  };

  const handleNextStep = async () => {
    if (activeStep === 1) {
      await saveFlightStep1(true);
    } else if (activeStep === 2) {
      if (failedBookings.length > 0) {
        toast.error(
          `Fix or delete the ${failedBookings.length} failed booking(s) before continuing.`,
        );
        return;
      }
      if (addedBookings.length === 0) {
        toast.error("At least one booking is required.");
        return;
      }
      changeStep(3);
    } else if (activeStep === 3) {
      if (!flightId) {
        changeStep(4);
        return;
      }
      setIsConfirmingBookings(true);
      try {
        const res = await cancellationService.confirmBookings(flightId);
        toast.success(res?.message || "Passenger booking details confirmed");
        changeStep(4);
      } catch (error: any) {
        toast.error(error.message || "Failed to confirm passenger details");
      } finally {
        setIsConfirmingBookings(false);
      }
    } else if (activeStep === 4) {
      if (flightId && !hotelAllocations && !isAllocating) {
        await handleAllocateHotels();
      } else {
        changeStep(5);
      }
    } else if (activeStep === 5) {
      if (flightId && !allPnrsBooked) {
        toast.error(
          FLIGHT_PAYMENT_STEP_ENABLED
            ? "All bookings must have a confirmed hotel before continuing to payment."
            : "All bookings must have a confirmed hotel before continuing to publish.",
        );
        return;
      }
      changeStep(FLIGHT_PAYMENT_STEP_ENABLED ? 6 : 7);
    } else if (activeStep === 6) {
      if (!flightId) {
        changeStep(7);
        return;
      }
      setIsProcessingPayment(true);
      try {
        const res = await cancellationService.processPayment(flightId);
        toast.success(res?.message || "Payment processed successfully");
        changeStep(7);
      } catch (error: any) {
        toast.error(error.message || "Failed to process payment");
      } finally {
        setIsProcessingPayment(false);
      }
    } else if (activeStep === 7) {
      await handlePublishFlight();
    } else {
      changeStep(activeStep + 1);
    }
  };

  const renderStepper = () => {
    const steps = [
      {
        number: 1,
        label: "Flight Details",
        desc: "Basic information & stay dates",
      },
      { number: 2, label: "Bookings", desc: "Upload passengers" },
      { number: 3, label: "Review", desc: "Verify details" },
      { number: 4, label: "Allocation", desc: "Assign hotels" },
      {
        number: 5,
        label: "Booking Summary",
        desc: "Review booked hotels & final costs",
      },
      { number: 6, label: "Payment", desc: "Review & pay" },
      { number: 7, label: "Publish", desc: "Notify passengers" },
    ].filter((step) => FLIGHT_PAYMENT_STEP_ENABLED || step.number !== 6);

    return (
      <div className="w-full bg-white border border-[#E5E7EB] rounded-2xl p-6 overflow-x-auto">
        <div className="flex items-start w-full min-w-[920px]">
          {steps.map((step, idx) => {
            const isActive = activeStep === step.number;
            const isCompleted = activeStep > step.number;
            return (
              <Fragment key={step.number}>
                <div
                  onClick={() => {
                    if (isCompleted || (step.number < activeStep && flightId)) {
                      changeStep(step.number);
                    }
                  }}
                  className={cn(
                    "flex flex-col items-center shrink-0 w-[140px] z-10",
                    (isCompleted || (step.number < activeStep && !!flightId)) &&
                      "cursor-pointer",
                  )}
                >
                  {/* Circle */}
                  <div
                    className={cn(
                      "size-10 rounded-full flex items-center justify-center text-base font-semibold transition-all duration-200 border",
                      isActive
                        ? "bg-[#0F2757] text-white border-transparent ring-4 ring-gray-200"
                        : isCompleted
                          ? "bg-[#1FAD53] text-white border-transparent"
                          : "bg-gray-200 text-gray-500 border-gray-300",
                    )}
                  >
                    {/* Position, not step.number: a hidden step leaves no gap. */}
                    {isCompleted ? <Check className="h-5 w-5" /> : idx + 1}
                  </div>

                  {/* Text Content */}
                  <div className="flex flex-col items-center text-center mt-2 px-1 max-w-[115px]">
                    <span
                      className={cn(
                        "text-[14px] font-semibold transition-colors whitespace-nowrap",
                        isActive || isCompleted
                          ? "text-[#1F2937]"
                          : "text-gray-500",
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
                      "flex-1 h-0.5 mt-[19px] -mx-[28px] transition-all duration-300 z-0",
                      isCompleted ? "bg-[#1FAD53]" : "bg-gray-200",
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
                <h3 className="text-xl font-semibold text-gray-900 font-figtree">
                  Flight Details
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Enter the cancelled flight information and default stay dates
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              <div className="flex flex-col gap-1.5">
                <label className="block text-[16px] font-medium text-[#1F2937]">
                  Flight Number *
                </label>
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
                      : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]",
                  )}
                />
                {step1Errors.flightNumber && step1Touched.flightNumber && (
                  <p className="field-error mt-1 text-xs text-red-500">
                    {step1Errors.flightNumber}
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="block text-[16px] font-medium text-[#1F2937]">
                  Cancellation Date *
                </label>
                <DatePicker
                  value={newDate}
                  onChange={handleDateChange}
                  className={cn(
                    "w-full h-[49px] px-4 rounded-lg border text-[16px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 transition-all placeholder:text-[#9CA3AF]",
                    step1Errors.cancellationDate &&
                      step1Touched.cancellationDate
                      ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                      : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]",
                  )}
                  placeholder="dd/mm/yyyy"
                />
                {step1Errors.cancellationDate &&
                  step1Touched.cancellationDate && (
                    <p className="field-error mt-1 text-xs text-red-500">
                      {step1Errors.cancellationDate}
                    </p>
                  )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="block text-[16px] font-medium text-[#1F2937]">
                  Departure Airport *
                </label>
                <Dropdown
                  value={newDepartureAirport}
                  onChange={handleDepartureAirportChange}
                  options={airportOptions}
                  placeholder={
                    isLoadingAirports ? "Loading airports..." : "Select airport"
                  }
                  searchable
                  triggerWidthClass="w-full"
                  widthClass="w-full"
                  heightClass="h-[49px]"
                  maxListHeightClass="max-h-60"
                  bgClass="bg-white"
                  error={
                    !!(
                      step1Errors.departureAirport &&
                      step1Touched.departureAirport
                    )
                  }
                />
                {step1Errors.departureAirport &&
                  step1Touched.departureAirport && (
                    <p className="field-error mt-1 text-xs text-red-500">
                      {step1Errors.departureAirport}
                    </p>
                  )}
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="block text-[16px] font-medium text-[#1F2937]">
                  Arrival Airport *
                </label>
                <Dropdown
                  value={newArrivalAirport}
                  onChange={handleArrivalAirportChange}
                  options={airportOptions}
                  placeholder={
                    isLoadingAirports ? "Loading airports..." : "Select airport"
                  }
                  searchable
                  triggerWidthClass="w-full"
                  widthClass="w-full"
                  heightClass="h-[49px]"
                  maxListHeightClass="max-h-60"
                  bgClass="bg-white"
                  error={
                    !!(
                      step1Errors.arrivalAirport && step1Touched.arrivalAirport
                    )
                  }
                />
                {step1Errors.arrivalAirport && step1Touched.arrivalAirport && (
                  <p className="field-error mt-1 text-xs text-red-500">
                    {step1Errors.arrivalAirport}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
              <div className="flex flex-col gap-1.5">
                <label className="block text-[16px] font-medium text-[#1F2937]">
                  Default Check-in Date *
                </label>
                <DatePicker
                  value={checkInDate}
                  onChange={handleCheckInDateChange}
                  className={cn(
                    "w-full h-[49px] px-4 rounded-lg border text-[16px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 transition-all placeholder:text-[#9CA3AF]",
                    step1Errors.checkInDate && step1Touched.checkInDate
                      ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                      : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]",
                  )}
                  placeholder="dd/mm/yyyy"
                />
                {step1Errors.checkInDate && step1Touched.checkInDate && (
                  <p className="field-error mt-1 text-xs text-red-500">
                    {step1Errors.checkInDate}
                  </p>
                )}
                <p className="text-[13px] text-gray-500 font-medium">
                  Defaults to the cancelled flight date. You can change this
                  date if required.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="block text-[16px] font-medium text-[#1F2937]">
                  Default Check-out Date *
                </label>
                <DatePicker
                  value={checkOutDate}
                  onChange={handleCheckOutDateChange}
                  className={cn(
                    "w-full h-[49px] px-4 rounded-lg border text-[16px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 transition-all placeholder:text-[#9CA3AF]",
                    step1Errors.checkOutDate && step1Touched.checkOutDate
                      ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                      : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]",
                  )}
                  placeholder="dd/mm/yyyy"
                />
                {step1Errors.checkOutDate && step1Touched.checkOutDate && (
                  <p className="field-error mt-1 text-xs text-red-500">
                    {step1Errors.checkOutDate}
                  </p>
                )}
                <p className="text-[13px] text-gray-500 font-medium">
                  Defaults to the day after the cancelled flight date. You can
                  change this date if required.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3.5 pt-2 text-left">
              <label className="block text-[16px] font-medium text-[#1F2937]">
                Cancellation Reason{" "}
                <span className="text-gray-400 font-normal">(Optional)</span>
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
                          : "bg-white hover:bg-slate-50 border-gray-200 text-gray-700 hover:border-gray-300",
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
                Select a common reason above or type a custom explanation. This
                can be updated later.
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
                <h3 className="text-xl font-semibold text-gray-900 font-figtree">
                  Bookings & Passengers
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Add bookings for hotel room allocation
                </p>
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
                    : "text-gray-500 hover:text-gray-700",
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
                    : "text-gray-500 hover:text-gray-700",
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
                <div className="border border-gray-200 rounded-2xl p-5 bg-white grid grid-cols-1 lg:grid-cols-[1fr_minmax(320px,420px)] gap-5">
                <div
                  className={cn(
                    "border border-dashed rounded-xl py-12 px-6 flex flex-col items-center justify-center text-center transition-colors duration-200",
                    isManifestUploaded
                      ? "border-emerald-300 bg-emerald-50/20 cursor-pointer"
                      : "border-gray-300 bg-[#FAFAFA]",
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="size-[52px] rounded-full bg-[#E5E7EB] flex items-center justify-center mb-4">
                    {isUploadingCsv ? (
                      <Loader2 className="h-6 w-6 text-[#0F2757] animate-spin" />
                    ) : (
                      <Upload
                        className={cn(
                          "h-6 w-6",
                          isManifestUploaded
                            ? "text-emerald-600"
                            : "text-[#374151]",
                        )}
                      />
                    )}
                  </div>

                  {isUploadingCsv ? (
                    <div>
                      <h4 className="text-lg font-semibold text-[#111827] mb-1">
                        Importing Bookings...
                      </h4>
                      <p className="text-sm text-gray-500">
                        Please wait while we parse and validate your CSV file.
                      </p>
                    </div>
                  ) : isManifestUploaded ? (
                    <div>
                      <h4 className="text-lg font-semibold text-emerald-800 mb-1">
                        {manifestFileName}
                      </h4>
                      <p className="text-sm text-emerald-600">
                        Upload complete. Loaded {addedBookings.length} bookings.
                      </p>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="mt-3 text-xs text-[#0F2757] underline font-medium hover:text-[#1B2B6B] cursor-pointer"
                      >
                        Upload another file
                      </button>
                    </div>
                  ) : (
                    <>
                      <h4 className="text-[18px] font-semibold text-[#0F2757] mb-2 font-figtree">
                        Upload booking file
                      </h4>
                      <p className="text-[15px] text-[#6B7280] mb-6 max-w-[400px]">
                        Drag and drop your CSV here, or browse your files
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
                        Choose file
                      </button>
                      <p className="text-[13px] text-[#6B7280]">
                        .csv only · Maximum 10 MB
                      </p>
                    </>
                  )}
                </div>
                <CsvUploadTips />
                </div>

                {importSummary && importSummary.errorBookings > 0 && (
                  <div className="mt-4 p-4 rounded-xl border border-red-200 bg-red-50/50 flex items-start gap-3 text-left">
                    <AlertCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <h5 className="font-semibold text-red-900 text-sm">
                        {importSummary.errorBookings} of{" "}
                        {importSummary.totalBookings} row(s) could not be
                        imported
                      </h5>
                      <p className="text-xs text-red-700 mt-0.5">
                        They are listed under Failed Bookings below with the
                        problem on each row. Fix or delete them to continue.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl p-5 bg-white space-y-4 text-left">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900 text-base">
                    {editingFailedId !== null
                      ? `Fix Failed Booking (Row ${
                          failedBookings.find((f) => f.id === editingFailedId)
                            ?.rowNumber ?? "?"
                        })`
                      : editingBookingId
                        ? "Edit Booking"
                        : "Add New Booking"}
                  </h4>
                  {(editingBookingId || editingFailedId !== null) && (
                    <button
                      type="button"
                      onClick={resetBookingForm}
                      className="text-xs text-gray-500 hover:text-gray-800 underline cursor-pointer"
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[15px] font-medium text-[#1F2937]">
                      Booking Reference (PNR) *
                    </label>
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
                          : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]",
                      )}
                    />
                    {step2Errors.pnr && step2Touched.pnr && (
                      <p className="step2-field-error mt-0.5 text-xs text-red-500">
                        {step2Errors.pnr}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[15px] font-medium text-[#1F2937]">
                      First Name *
                    </label>
                    <input
                      type="text"
                      placeholder="John"
                      value={bookingFirstName}
                      onChange={(e) =>
                        handleBookingFirstNameChange(e.target.value)
                      }
                      onBlur={handleStep2Blur("firstName")}
                      className={cn(
                        "block h-[42px] w-full rounded-lg border px-3 text-[15px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 transition-all placeholder:text-[#9CA3AF]",
                        step2Errors.firstName && step2Touched.firstName
                          ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                          : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]",
                      )}
                    />
                    {step2Errors.firstName && step2Touched.firstName && (
                      <p className="step2-field-error mt-0.5 text-xs text-red-500">
                        {step2Errors.firstName}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[15px] font-medium text-[#1F2937]">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      placeholder="Doe"
                      value={bookingLastName}
                      onChange={(e) =>
                        handleBookingLastNameChange(e.target.value)
                      }
                      onBlur={handleStep2Blur("lastName")}
                      className={cn(
                        "block h-[42px] w-full rounded-lg border px-3 text-[15px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 transition-all placeholder:text-[#9CA3AF]",
                        step2Errors.lastName && step2Touched.lastName
                          ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                          : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]",
                      )}
                    />
                    {step2Errors.lastName && step2Touched.lastName && (
                      <p className="step2-field-error mt-0.5 text-xs text-red-500">
                        {step2Errors.lastName}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[15px] font-medium text-[#1F2937]">
                      Email *
                    </label>
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
                          : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]",
                      )}
                    />
                    {step2Errors.email && step2Touched.email && (
                      <p className="step2-field-error mt-0.5 text-xs text-red-500">
                        {step2Errors.email}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[15px] font-medium text-[#1F2937]">
                      Phone *
                    </label>
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
                          : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]",
                      )}
                    />
                    {step2Errors.phone && step2Touched.phone && (
                      <p className="step2-field-error mt-0.5 text-xs text-red-500">
                        {step2Errors.phone}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[15px] font-medium text-[#1F2937]">
                      Passport Country *
                    </label>
                    <Dropdown
                      value={bookingResidency}
                      onChange={handleBookingResidencyChange}
                      options={COUNTRY_OPTIONS}
                      placeholder="Select country"
                      searchable
                      maxListHeightClass="max-h-64"
                      triggerWidthClass="w-full"
                      widthClass="w-full"
                      bgClass="bg-white"
                      heightClass="h-[42px]"
                      error={
                        !!(step2Errors.residency && step2Touched.residency)
                      }
                    />
                    {step2Errors.residency && step2Touched.residency && (
                      <p className="step2-field-error mt-0.5 text-xs text-red-500">
                        {step2Errors.residency}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[15px] font-medium text-[#1F2937]">
                      Travel Class *
                    </label>
                    <Dropdown
                      value={bookingClass}
                      onChange={handleBookingClassChange}
                      options={TRAVEL_CLASS_OPTIONS}
                      placeholder="Select class"
                      triggerWidthClass="w-full"
                      widthClass="w-full"
                      bgClass="bg-white"
                      heightClass="h-[42px]"
                      error={
                        !!(step2Errors.travelClass && step2Touched.travelClass)
                      }
                    />
                    {step2Errors.travelClass && step2Touched.travelClass && (
                      <p className="step2-field-error mt-0.5 text-xs text-red-500">
                        {step2Errors.travelClass}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[15px] font-medium text-[#1F2937]">
                      Adults *
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={bookingAdults}
                      onChange={(e) =>
                        handleBookingAdultsChange(e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "-" || e.key === "e" || e.key === "+")
                          e.preventDefault();
                      }}
                      onBlur={handleStep2Blur("adults")}
                      className={cn(
                        "block h-[42px] w-full rounded-lg border px-3 text-[15px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 transition-all",
                        step2Errors.adults && step2Touched.adults
                          ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                          : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]",
                      )}
                    />
                    {step2Errors.adults && step2Touched.adults && (
                      <p className="step2-field-error mt-0.5 text-xs text-red-500">
                        {step2Errors.adults}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[15px] font-medium text-[#1F2937]">
                      Children
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={bookingChildren}
                      onChange={(e) =>
                        handleBookingChildrenChange(e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "-" || e.key === "e" || e.key === "+")
                          e.preventDefault();
                      }}
                      onBlur={handleStep2Blur("children")}
                      className={cn(
                        "block h-[42px] w-full rounded-lg border px-3 text-[15px] text-[#1F2937] bg-white focus:outline-none focus:ring-2 transition-all",
                        step2Errors.children && step2Touched.children
                          ? "border-red-500 focus:ring-red-500/20 focus:border-red-500"
                          : "border-[#D1D5DB] focus:ring-[#1B2B6B]/20 focus:border-[#1B2B6B]",
                      )}
                    />
                    {step2Errors.children && step2Touched.children && (
                      <p className="step2-field-error mt-0.5 text-xs text-red-500">
                        {step2Errors.children}
                      </p>
                    )}
                  </div>
                </div>

                <ChildAgesInputs
                  ages={bookingChildAges}
                  onChange={setBookingChildAges}
                  onBlur={() => setChildAgesTouched(true)}
                  errors={childAgeErrors}
                  touched={childAgesTouched}
                />

                <SpecialNotesField
                  value={bookingNotesText}
                  onChange={setBookingNotesText}
                />

                {hasPermission("edit") && (
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
                        : editingFailedId !== null
                          ? "Save Booking"
                          : editingBookingId
                            ? "Update Booking"
                            : "Add Booking"}
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* Failed / Bookings tabs, only while failed CSV rows exist */}
            {failedBookings.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex p-1 bg-gray-100/80 rounded-xl">
                  {(
                    [
                      ["bookings", `Bookings (${addedBookings.length})`],
                      ["failed", `Failed Bookings (${failedBookings.length})`],
                    ] as const
                  ).map(([tab, label]) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setBookingListTab(tab)}
                      className={cn(
                        "px-5 py-2 text-[15px] font-medium rounded-lg transition-all duration-200 cursor-pointer",
                        bookingListTab === tab
                          ? "bg-white shadow-sm " +
                              (tab === "failed"
                                ? "text-red-600"
                                : "text-[#0F2757]")
                          : "text-gray-500 hover:text-gray-700",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {bookingListTab === "failed" && hasPermission("edit") && (
                  <button
                    type="button"
                    onClick={() => setIsDeleteAllFailedOpen(true)}
                    className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-red-50 text-red-600 font-medium py-2 px-4 rounded-lg transition-colors cursor-pointer text-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete All Failed
                  </button>
                )}
              </div>
            )}

            {failedBookings.length > 0 && bookingListTab === "failed" ? (
              <FailedBookingsTable
                failedBookings={failedBookings}
                canEdit={hasPermission("edit")}
                editingId={editingFailedId}
                onEdit={handleEditFailedBooking}
                onDelete={handleDeleteFailedBooking}
              />
            ) : (
            <div className="space-y-4">
              {addedBookings.length === 0 ? (
                bookingTab === "manual" ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center text-gray-505">
                    <Users className="h-10 w-10 text-gray-300 mb-3" />
                    <p className="text-sm font-medium text-gray-700">
                      No bookings added yet.
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Use the form above to add your first booking.
                    </p>
                  </div>
                ) : null
              ) : (
                <div className="space-y-4 text-left">
                  {/* Summary Grid stats */}
                  <div className="grid grid-cols-3 gap-4">
                    {/* Bookings Card */}
                    <div className="bg-[#F6F7F8] rounded-xl p-3.5 flex items-center gap-3.5">
                      <div className="size-10 rounded-lg bg-gray-200/60 flex items-center justify-center shrink-0 text-[#0F2757]">
                        <Ticket className="w-5 h-5 text-[#0F2757]" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[20px] leading-tight font-bold text-[#111827]">
                          {addedBookings.length}
                        </span>
                        <span className="text-[13px] text-[#6B7280] mt-0.5">
                          Bookings
                        </span>
                      </div>
                    </div>

                    {/* Passengers Card */}
                    <div className="bg-[#F6F7F8] rounded-xl p-3.5 flex items-center gap-3.5">
                      <div className="size-10 rounded-lg bg-gray-200/60 flex items-center justify-center shrink-0 text-[#0F2757]">
                        <Users className="w-5 h-5 text-[#0F2757]" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[20px] leading-tight font-bold text-[#111827]">
                          {totalPassengersCount}
                        </span>
                        <span className="text-[13px] text-[#6B7280] mt-0.5">
                          Passengers
                        </span>
                      </div>
                    </div>
                    {/* Travel Class Breakdown Card */}
                    <div className="bg-[#F6F7F8] rounded-xl p-3.5 flex items-center gap-3.5">
                      <div className="size-10 rounded-lg bg-gray-200/60 flex items-center justify-center shrink-0 text-[#0F2757]">
                        <Armchair className="w-5 h-5 text-[#0F2757]" />
                      </div>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 flex-1 text-xs">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-gray-600 truncate">
                            Economy
                          </span>
                          <span className="font-semibold text-gray-900">
                            {
                              addedBookings.filter(
                                (b) =>
                                  (b.travelClass || "").toLowerCase() ===
                                  "economy",
                              ).length
                            }
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className="text-gray-600 truncate"
                            title="Premium Economy"
                          >
                            Premium economy
                          </span>
                          <span className="font-semibold text-gray-900">
                            {
                              addedBookings.filter(
                                (b) =>
                                  (b.travelClass || "").toLowerCase() ===
                                    "premium economy" ||
                                  (b.travelClass || "").toLowerCase() ===
                                    "premium_economy",
                              ).length
                            }
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-gray-600 truncate">
                            Business
                          </span>
                          <span className="font-semibold text-gray-900">
                            {
                              addedBookings.filter(
                                (b) =>
                                  (b.travelClass || "").toLowerCase() ===
                                  "business",
                              ).length
                            }
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-gray-600 truncate">
                            First class
                          </span>
                          <span className="font-semibold text-gray-900">
                            {
                              addedBookings.filter(
                                (b) =>
                                  (b.travelClass || "").toLowerCase() ===
                                    "first class" ||
                                  (b.travelClass || "").toLowerCase() ===
                                    "first_class",
                              ).length
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bookings Table */}
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[80px]">PNR</TableHead>
                          <TableHead className="min-w-[140px]">
                            Contact Name
                          </TableHead>
                          <TableHead className="min-w-[160px]">Email</TableHead>
                          <TableHead className="min-w-[120px]">Phone</TableHead>
                          <TableHead className="min-w-[130px]">
                            Passport Country
                          </TableHead>
                          <TableHead className="min-w-[80px] text-center">
                            Adults
                          </TableHead>
                          <TableHead className="min-w-[80px] text-center">
                            Children
                          </TableHead>
                          <TableHead className="min-w-[100px] text-center">
                            Class
                          </TableHead>
                          {hasPermission("edit") && (
                            <TableHead className="min-w-[80px] text-center">
                              Actions
                            </TableHead>
                          )}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {addedBookings
                          .slice(
                            (currentPage - 1) * resultsPerPage,
                            currentPage * resultsPerPage,
                          )
                          .map((b) => (
                            <TableRow key={b.id}>
                              <TableCell className="font-medium text-gray-900">
                                {b.pnr}
                              </TableCell>
                              <TableCell>
                                {b.firstName} {b.lastName}
                              </TableCell>
                              <TableCell className="text-gray-550">
                                {b.email}
                              </TableCell>
                              <TableCell className="text-gray-550">
                                {b.phone}
                              </TableCell>
                              <TableCell className="text-gray-550">
                                {countryName(b.residency)}
                              </TableCell>
                              <TableCell>{b.adults}</TableCell>
                              <TableCell>{b.children}</TableCell>
                              <TableCell>
                                <span
                                  className={cn(
                                    "rounded px-2.5 py-1 text-xs font-semibold inline-block",
                                    b.travelClass === "Business" ||
                                      b.travelClass === "First Class"
                                      ? "bg-purple-100 text-purple-800"
                                      : "bg-gray-100 text-gray-700",
                                  )}
                                >
                                  {b.travelClass}
                                </span>
                              </TableCell>
                              {hasPermission("edit") && (
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
                              )}
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
                    totalPages={Math.ceil(
                      addedBookings.length / resultsPerPage,
                    )}
                  />
                </div>
              )}
            </div>
            )}

            <Dialog.Root
              isOpen={isDeleteAllFailedOpen}
              onClose={isDeletingFailed ? () => {} : () => setIsDeleteAllFailedOpen(false)}
            >
              <Dialog.Header
                title="Delete All Failed Bookings?"
                onClose={isDeletingFailed ? () => {} : () => setIsDeleteAllFailedOpen(false)}
              />
              <Dialog.Body>
                {failedBookings.length} failed booking(s) will be deleted and
                not imported. Bookings already imported are not affected.
              </Dialog.Body>
              <Dialog.Footer>
                <Dialog.Cancel
                  onClick={() => setIsDeleteAllFailedOpen(false)}
                  disabled={isDeletingFailed}
                />
                <Dialog.Action
                  variant="danger"
                  onClick={handleDeleteAllFailedBookings}
                  disabled={isDeletingFailed}
                >
                  {isDeletingFailed ? "Deleting..." : "Delete All"}
                </Dialog.Action>
              </Dialog.Footer>
            </Dialog.Root>
          </div>
        );
      case 3:
        if (isLoadingReview && !reviewData) {
          return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <Loader2 className="h-10 w-10 text-[#0F2757] animate-spin" />
              <div className="text-center">
                <h3 className="text-lg font-semibold text-gray-900 font-figtree">
                  Loading Flight Review...
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Fetching full flight route details and passenger summary
                </p>
              </div>
            </div>
          );
        }

        return (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4">
              <div className="size-10 bg-slate-200/50 text-slate-700 rounded-lg flex justify-center items-center shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-gray-900 font-figtree">
                  Review Bookings
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Verify booking details before hotel allocation
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between bg-gray-100/40 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <Plane className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Flight</p>
                  <p className="font-semibold text-gray-900 text-base">
                    {reviewData?.flight?.flightNumber || newFlight || "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Route</p>
                  <p className="font-semibold text-gray-900 text-base">
                    {reviewData?.flight?.route?.departureAirport &&
                    reviewData?.flight?.route?.arrivalAirport
                      ? `${reviewData.flight.route.departureAirport.code} ➔ ${reviewData.flight.route.arrivalAirport.code}`
                      : newDepartureAirport && newArrivalAirport
                        ? `${newDepartureAirport} ➔ ${newArrivalAirport}`
                        : "—"}
                  </p>
                  {reviewData?.flight?.route?.departureAirport &&
                    reviewData?.flight?.route?.arrivalAirport && (
                      <p className="text-xs text-gray-500">
                        {reviewData.flight.route.departureAirport.name} to{" "}
                        {reviewData.flight.route.arrivalAirport.name}
                      </p>
                    )}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-500">Date</p>
                  <p className="font-semibold text-gray-900 text-base">
                    {reviewData?.flight?.cancellationDate
                      ? formatDateString(reviewData.flight.cancellationDate)
                      : newDate
                        ? formatDateString(newDate)
                        : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div>
                  <p className="text-xs text-gray-500">Reason</p>
                  <p className="font-semibold text-gray-900 text-base">
                    {formatCancellationReason(
                      reviewData?.flight?.cancellationReasonText ||
                        reviewData?.flight?.cancellationReason ||
                        newReason ||
                        selectedReasonTag,
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Bookings Card */}
              <div className="bg-[#F6F7F8] rounded-xl p-3.5 flex items-center gap-3.5">
                <div className="size-10 rounded-lg bg-gray-200/60 flex items-center justify-center shrink-0 text-[#0F2757]">
                  <Ticket className="w-5 h-5 text-[#0F2757]" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[20px] leading-tight font-bold text-[#111827]">
                    {reviewData?.summary?.totalBookings ?? addedBookings.length}
                  </span>
                  <span className="text-[13px] text-[#6B7280] mt-0.5">
                    Bookings
                  </span>
                </div>
              </div>

              {/* Passengers Card */}
              <div className="bg-[#F6F7F8] rounded-xl p-3.5 flex items-center gap-3.5">
                <div className="size-10 rounded-lg bg-gray-200/60 flex items-center justify-center shrink-0 text-[#0F2757]">
                  <Users className="w-5 h-5 text-[#0F2757]" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[20px] leading-tight font-bold text-[#111827]">
                    {reviewData?.summary
                      ? reviewData.summary.totalAdults +
                        reviewData.summary.totalChildren
                      : totalPassengersCount}
                  </span>
                  <span className="text-[13px] text-[#6B7280] mt-0.5">
                    Passengers
                  </span>
                </div>
              </div>

              {/* Travel Class Breakdown Card */}
              <div className="bg-[#F6F7F8] rounded-xl p-3.5 flex items-center gap-3.5">
                <div className="size-10 rounded-lg bg-gray-200/60 flex items-center justify-center shrink-0 text-[#0F2757]">
                  <Armchair className="w-5 h-5 text-[#0F2757]" />
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 flex-1 text-xs">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-gray-600 truncate">Economy</span>
                    <span className="font-semibold text-gray-900">
                      {
                        addedBookings.filter(
                          (b) =>
                            (b.travelClass || "").toLowerCase() === "economy",
                        ).length
                      }
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className="text-gray-600 truncate"
                      title="Premium Economy"
                    >
                      Premium economy
                    </span>
                    <span className="font-semibold text-gray-900">
                      {
                        addedBookings.filter(
                          (b) =>
                            (b.travelClass || "").toLowerCase() ===
                              "premium economy" ||
                            (b.travelClass || "").toLowerCase() ===
                              "premium_economy",
                        ).length
                      }
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-gray-600 truncate">Business</span>
                    <span className="font-semibold text-gray-900">
                      {
                        addedBookings.filter(
                          (b) =>
                            (b.travelClass || "").toLowerCase() === "business",
                        ).length
                      }
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-gray-600 truncate">First class</span>
                    <span className="font-semibold text-gray-900">
                      {
                        addedBookings.filter(
                          (b) =>
                            (b.travelClass || "").toLowerCase() ===
                              "first class" ||
                            (b.travelClass || "").toLowerCase() ===
                              "first_class",
                        ).length
                      }
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xl mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[80px]">PNR</TableHead>
                    <TableHead className="min-w-[140px]">
                      Contact Name
                    </TableHead>
                    <TableHead className="min-w-[160px]">Email</TableHead>
                    <TableHead className="min-w-[130px]">Phone</TableHead>
                    <TableHead className="min-w-[130px]">
                      Passport Country
                    </TableHead>
                    <TableHead className="min-w-[80px]">Adults</TableHead>
                    <TableHead className="min-w-[80px]">Children</TableHead>
                    <TableHead className="min-w-[100px]">Class</TableHead>
                    <TableHead className="min-w-[80px] text-center">
                      Action
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(addedBookings.length > 0
                    ? addedBookings
                    : ([
                        {
                          id: "1",
                          pnr: "DDJU",
                          firstName: "New",
                          lastName: "Admin",
                          email: "ops@summitair.com",
                          adults: 1,
                          children: 0,
                          travelClass: "Economy",
                        },
                      ] as typeof addedBookings)
                  )
                    .slice(
                      (step3CurrentPage - 1) * step3ResultsPerPage,
                      step3CurrentPage * step3ResultsPerPage,
                    )
                    .map((b, idx) => (
                      <TableRow key={b.id || idx}>
                        <TableCell className="font-medium text-gray-900">
                          {b.pnr}
                        </TableCell>
                        <TableCell>
                          {b.firstName} {b.lastName}
                        </TableCell>
                        <TableCell className="text-gray-550">
                          {b.email}
                        </TableCell>
                        <TableCell className="text-gray-550">
                          {b.phone || "—"}
                        </TableCell>
                        <TableCell className="text-gray-550">
                          {countryName(b.residency)}
                        </TableCell>
                        <TableCell>{b.adults}</TableCell>
                        <TableCell>{b.children}</TableCell>
                        <TableCell>
                          <span
                            className={cn(
                              "rounded px-2.5 py-1 text-xs font-semibold inline-block",
                              b.travelClass === "Business" ||
                                b.travelClass === "First Class"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-gray-100 text-gray-700",
                            )}
                          >
                            {b.travelClass}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPassengerBooking(b);
                              setIsPassengerBookingDrawerOpen(true);
                            }}
                            className="p-1.5 text-gray-400 hover:text-[#0F2757] hover:bg-gray-100 rounded-lg transition-colors cursor-pointer inline-flex items-center justify-center"
                            title="View Booking Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </TableCell>
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
              totalPages={Math.ceil(
                (addedBookings.length || 1) / step3ResultsPerPage,
              )}
            />
          </div>
        );
      case 4:
        if (isAllocating) {
          const isBooking = allocationRunProgress?.isBooking ?? false;
          const processedPercentage = allocationRunProgress?.total
            ? Math.round(
                (allocationRunProgress.done / allocationRunProgress.total) *
                  100,
              )
            : 0;
          const remainingPnrs = allocationRunProgress
            ? allocationRunProgress.total - allocationRunProgress.done
            : 0;
          const allocationStages = [
            "Reviewing passenger requirements",
            "Finding available hotel rooms",
            "Optimizing room costs",
            "Booking rooms",
          ];
          // Planning steps are 0–2; booking (3) starts once the server books a PNR.
          const currentStage = isBooking ? 3 : allocationPlanningStep;

          return (
            <div className="flex flex-col items-center justify-center -mt-2 space-y-4 animate-in fade-in duration-300">
              <div className="flex flex-col items-center gap-2">
                <div className="flex size-10 items-center justify-center rounded-full bg-[#0F2757]/5">
                  <Loader2 className="h-5 w-5 text-[#0F2757] animate-spin" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 font-figtree">
                    Hotel allocation in progress
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {!isBooking
                      ? remainingPnrs > 0
                        ? `Searching hotels and planning rooms for ${remainingPnrs} PNR${remainingPnrs === 1 ? "" : "s"}.`
                        : "Searching hotels and planning rooms."
                      : `${allocationRunProgress?.done ?? 0} of ${allocationRunProgress?.total ?? 0} PNRs processed`}
                  </p>
                </div>
              </div>

              <div className="w-full max-w-xl bg-white border border-gray-200 shadow-sm rounded-xl p-5 space-y-5">
                <div className="space-y-3">
                  {allocationStages.map((label, index) => {
                    const isDone = index < currentStage;
                    const isActive = index === currentStage;
                    return (
                      <div
                        key={label}
                        className="flex items-center gap-3 text-sm"
                      >
                        {isDone ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
                        ) : isActive ? (
                          <Loader2 className="h-5 w-5 text-[#0F2757] animate-spin shrink-0" />
                        ) : (
                          <Circle className="h-5 w-5 text-gray-300 shrink-0" />
                        )}
                        <span
                          className={
                            isActive
                              ? "font-semibold text-gray-900"
                              : isDone
                                ? "font-medium text-gray-900"
                                : "text-gray-400"
                          }
                        >
                          {label}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between text-xs font-medium">
                    <span className="text-gray-600">PNRs processed</span>
                    {isBooking && (
                      <span className="text-gray-900">
                        {processedPercentage}%
                      </span>
                    )}
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                    {isBooking ? (
                      <div
                        className="h-full rounded-full bg-[#0F2757] transition-all duration-500"
                        style={{ width: `${processedPercentage}%` }}
                      />
                    ) : (
                      <div className="h-full w-full rounded-full bg-[#0F2757]/30 animate-pulse" />
                    )}
                  </div>
                </div>

                {isBooking && (
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3">
                    {[
                      {
                        label: "Successfully booked",
                        value: allocationRunProgress?.booked ?? 0,
                        valueClass: "text-emerald-700",
                        dotClass: "bg-emerald-500",
                      },
                      {
                        label: "Manual check needed",
                        value: allocationRunProgress?.manualReview ?? 0,
                        valueClass: "text-amber-700",
                        dotClass: "bg-amber-500",
                      },
                      {
                        label: "Failed",
                        value: allocationRunProgress?.failed ?? 0,
                        valueClass: "text-red-700",
                        dotClass: "bg-red-500",
                      },
                    ].map((status) => (
                        <div
                          key={status.label}
                          className="rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-3"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`size-2 rounded-full ${status.dotClass}`}
                            />
                            <span className="text-xs font-medium text-gray-500">
                              {status.label}
                            </span>
                          </div>
                          <p
                            className={`mt-2 text-xl font-semibold tabular-nums ${status.valueClass}`}
                          >
                            {status.value}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="w-full max-w-xl rounded-lg bg-gray-50 px-4 py-3 flex items-start gap-3 border border-gray-200">
                <Info className="h-4 w-4 text-gray-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-gray-600">
                    You can leave this page. Booking will continue in the
                    background. Failed means no hotel could be booked for that
                    PNR in this run; you can run allocation again to retry.
                  </p>
                </div>
              </div>

              {allocationError && (
                <div className="flex flex-col items-center gap-2 pt-2">
                  <p className="text-sm text-red-600 font-medium">
                    {allocationError}
                  </p>
                  <button
                    type="button"
                    onClick={handleAllocateHotels}
                    className="px-4 py-2 bg-[#0F2757] hover:bg-[#162259] text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    Retry Allocation
                  </button>
                </div>
              )}
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
                <h3 className="text-lg font-semibold text-gray-900 font-figtree">
                  Hotel Allocation
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Hotels are booked live with the supplier for every booking,
                  best-rated first, based on:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6 w-full">
              <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5 flex flex-col items-center text-center">
                <Plane className="h-6 w-6 text-blue-500 mb-3" />
                <h4 className="font-semibold text-gray-900 text-sm">
                  Travel Class
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Business / Economy preferences
                </p>
              </div>
              <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5 flex flex-col items-center text-center">
                <Building2 className="h-6 w-6 text-rose-500 mb-3" />
                <h4 className="font-semibold text-gray-900 text-sm">
                  Availability
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Real-time hotel inventory
                </p>
              </div>
              <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-5 flex flex-col items-center text-center">
                <Settings className="h-6 w-6 text-purple-500 mb-3" />
                <h4 className="font-semibold text-gray-900 text-sm">
                  Preferences
                </h4>
                <p className="text-xs text-gray-500 mt-1">
                  Your airline's settings
                </p>
              </div>
            </div>

            {hotelAllocations && (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  <span className="font-semibold text-gray-900">
                    {hotelAllocations.successfulPnrs} of{" "}
                    {hotelAllocations.totalPnrs} booking(s) confirmed
                  </span>
                  {hotelAllocations.failedPnrs > 0 && (
                    <span className="text-red-600">
                      {hotelAllocations.failedPnrs} failed
                    </span>
                  )}
                  {hotelAllocations.manualCheckPnrs > 0 && (
                    <span className="text-amber-600">
                      {hotelAllocations.manualCheckPnrs} need manual check
                    </span>
                  )}
                  {hotelAllocations.notStartedPnrs > 0 && (
                    <span className="text-gray-500">
                      {hotelAllocations.notStartedPnrs} not started
                    </span>
                  )}
                </div>
                {(() => {
                  const needsAction = hotelAllocations.results.filter(
                    (r) => r.bookingStatus === "FAILED",
                  );
                  if (needsAction.length === 0 || !hasPermission("edit")) {
                    return null;
                  }
                  return (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm">
                      <div className="flex items-center gap-2 text-red-700">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>
                          <span className="font-semibold">
                            {needsAction.length} PNR
                            {needsAction.length === 1 ? "" : "s"} need
                            {needsAction.length === 1 ? "s" : ""} your action
                          </span>{" "}
                          · find and book a hotel manually.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          document
                            .getElementById(
                              `allocation-row-${needsAction[0].bookingId}`,
                            )
                            ?.scrollIntoView({
                              behavior: "smooth",
                              block: "center",
                            })
                        }
                        className="font-medium text-red-700 underline-offset-2 hover:underline cursor-pointer"
                      >
                        Show
                      </button>
                    </div>
                  );
                })()}
                <div className="border border-gray-200 rounded-xl overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[100px]">PNR</TableHead>
                        <TableHead className="min-w-[100px]">Class</TableHead>
                        <TableHead className="min-w-[180px]">Hotel</TableHead>
                        <TableHead className="min-w-[140px]">
                          Booking Status
                        </TableHead>
                        <TableHead className="min-w-[80px]">Attempts</TableHead>
                        <TableHead className="min-w-[240px]">Details</TableHead>
                        <TableHead className="w-[130px] text-right">
                          Action
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* PNRs needing action first; otherwise the API's order. */}
                      {[...hotelAllocations.results]
                        .sort(
                          (a, b) =>
                            Number(b.bookingStatus === "FAILED") -
                            Number(a.bookingStatus === "FAILED"),
                        )
                        .map((r) => (
                        <TableRow
                          key={r.bookingId}
                          id={`allocation-row-${r.bookingId}`}
                          className={cn(
                            r.bookingStatus === "FAILED" &&
                              "bg-red-50/40 hover:bg-red-50/70",
                          )}
                        >
                          <TableCell className="font-medium text-gray-900">
                            {r.pnr}
                          </TableCell>
                          <TableCell className="capitalize">
                            {ENUM_TO_TRAVEL_CLASS[r.travelClass] ||
                              r.travelClass}
                          </TableCell>
                          <TableCell>{r.hotel?.hotelName || "-"}</TableCell>
                          <TableCell>
                            <StatusBadge
                              status={
                                HOTEL_BOOKING_STATUS_LABEL[
                                  PNR_STATUS_TO_HOTEL_STATUS[r.bookingStatus]
                                ] ?? r.bookingStatus
                              }
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            {r.attempts}
                          </TableCell>
                          <TableCell className="text-xs text-gray-500 whitespace-normal">
                            {r.reason || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {r.bookingStatus === "FAILED" &&
                              hasPermission("edit") && (
                                <button
                                  type="button"
                                  onClick={() => setFailedBookingForHotel(r)}
                                  className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#0F2757] px-3 text-xs font-medium text-white transition-colors hover:bg-[#162259] cursor-pointer"
                                  title="Find and book a hotel for this PNR"
                                  aria-label={`Find a hotel for PNR ${r.pnr}`}
                                >
                                  <Building2 className="h-4 w-4" />
                                  Find hotel
                                </button>
                              )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            {allocationError && (
              <div className="w-full bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm text-left">
                {allocationError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              {hotelAllocations && hotelAllocations.successfulPnrs > 0 && (
                <button
                  type="button"
                  onClick={() => changeStep(5)}
                  className="border border-gray-300 hover:bg-gray-50 text-[#374151] font-medium py-2.5 px-5 rounded-lg transition-colors cursor-pointer text-sm"
                >
                  View Booking Summary
                </button>
              )}
              {hotelAllocations &&
                !hotelAllocations.fullyBooked &&
                !hotelAllocations.canRetry && (
                  <span className="text-sm text-gray-500">
                    Retry already used for this flight. Contact support for the
                    remaining bookings.
                  </span>
                )}
              {hotelAllocations?.awaitingSupplierCheck &&
                !hotelAllocations.fullyBooked &&
                hotelAllocations.canRetry && (
                  <span className="text-sm text-amber-600">
                    Waiting for the hotel supplier to confirm pending bookings.
                    Retry is available once that check is done.
                  </span>
                )}
              {hasPermission("edit") &&
                !hotelAllocations?.fullyBooked &&
                (hotelAllocations?.canRetry ?? true) && (
                  <button
                    type="button"
                    onClick={handleAllocateHotels}
                    disabled={
                      isAllocating ||
                      isCheckingAllocation ||
                      !!hotelAllocations?.awaitingSupplierCheck
                    }
                    className="bg-[#2B3B67] hover:bg-[#1E2B4D] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-2.5 px-6 rounded-lg transition-colors cursor-pointer text-sm inline-flex items-center gap-2"
                  >
                    <Building2 className="h-5 w-5" />
                    <span>
                      {hotelAllocations
                        ? "Retry Remaining Bookings"
                        : "Allocate Hotel Reservations"}
                    </span>
                  </button>
                )}
            </div>
          </div>
        );
      case 5:
        const roomsCount = hotelSummary?.totalRooms ?? 0;
        const baseCost = hotelSummary?.totalHotelCost ?? 0;
        const discountAmt = hotelSummary?.totalDiscount ?? 0;
        const taxAmt = hotelSummary?.totalHotelTax ?? 0;
        const feeAmt = hotelSummary?.totalPlatformFee ?? 0;
        const finalAmt = hotelSummary?.totalPayable ?? 0;

        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 pb-4">
              <div className="flex items-center gap-3">
                <div className="size-10 bg-[#ECFDF5] text-[#10B981] rounded-lg flex justify-center items-center shrink-0 border border-[#D1FAE5]">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="text-left">
                  <h3 className="text-lg font-semibold text-gray-900 font-figtree">
                    Booking Summary
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">
                    Review the booked hotels, room details, and final payment
                    amount before proceeding.
                  </p>
                </div>
              </div>
              {hasPermission("export") && (
                <button
                  type="button"
                  onClick={handleExportReport}
                  disabled={isExportingReport}
                  className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-[#374151] px-4 py-2.5 rounded-lg font-medium transition-colors cursor-pointer text-sm disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
                >
                  {isExportingReport ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {isExportingReport ? "Exporting..." : "Export Report"}
                </button>
              )}
            </div>

            {flightId &&
              !isLoadingStep5Progress &&
              step5BookingProgress &&
              !allPnrsBooked && (
                <div className="flex items-start gap-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] p-4 text-sm text-[#92400E]">
                  <Info className="h-5 w-5 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-semibold">
                      {step5BookingProgress.successfulPnrs} of{" "}
                      {step5BookingProgress.totalPnrs} booking(s) confirmed.
                      Payment is available once every booking is confirmed.
                    </p>
                    <ul className="mt-1 list-disc pl-5 space-y-0.5">
                      {step5BookingProgress.failedPnrs > 0 && (
                        <li>
                          {step5BookingProgress.failedPnrs} booking(s) failed.
                          Run allocation again to retry them.
                        </li>
                      )}
                      {step5BookingProgress.manualCheckPnrs > 0 && (
                        <li>
                          {step5BookingProgress.manualCheckPnrs} booking(s) need
                          a manual check with the supplier.
                        </li>
                      )}
                      {step5BookingProgress.pendingPnrs > 0 && (
                        <li>
                          {step5BookingProgress.pendingPnrs} booking(s) are
                          still being confirmed.
                        </li>
                      )}
                      {step5BookingProgress.notStartedPnrs > 0 && (
                        <li>
                          {step5BookingProgress.notStartedPnrs} booking(s) have
                          no hotel yet.
                        </li>
                      )}
                    </ul>
                  </div>
                  {hasPermission("edit") && (
                    <button
                      type="button"
                      onClick={() => changeStep(4)}
                      className="shrink-0 rounded-lg border border-[#F59E0B] bg-white px-3 py-1.5 text-sm font-medium text-[#92400E] hover:bg-[#FEF3C7] transition-colors cursor-pointer"
                    >
                      Go to Allocation
                    </button>
                  )}
                </div>
              )}

            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              {/* Card 1 */}
              <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
                <div className="flex items-center gap-2 text-gray-500 mb-3">
                  <Bed className="h-4 w-4" />
                  <span className="text-[13px] font-semibold uppercase">
                    Total Room Bookings
                  </span>
                </div>
                <div className="text-[24px] font-bold text-gray-900">
                  {roomsCount}
                </div>
                <div className="text-sm text-gray-400 mt-1">Rooms booked</div>
              </div>
              {/* Card 2 */}
              <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
                <div className="flex items-center gap-2 text-gray-500 mb-3">
                  <Receipt className="h-4 w-4" />
                  <span className="text-[13px] font-semibold uppercase">
                    Total Hotel Cost
                  </span>
                </div>
                <div className="text-[24px] font-bold text-gray-900">
                  {currencySymbol}
                  {baseCost.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  Hotel charges before platform discount
                </div>
              </div>
              {/* Card 3 */}
              <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
                <div className="flex items-center gap-2 text-gray-500 mb-3">
                  <Percent className="h-4 w-4" />
                  <span className="text-[13px] font-semibold uppercase">
                    Platform Discount
                  </span>
                </div>
                <div className="text-[24px] font-bold text-green-600">
                  -{currencySymbol}
                  {discountAmt.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  Discount provided by platform
                </div>
              </div>
              {/* Card 4 */}
              <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
                <div className="flex items-center gap-2 text-gray-500 mb-3">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-[13px] font-semibold uppercase">
                    Hotel Tax
                  </span>
                </div>
                <div className="text-[24px] font-bold text-gray-900">
                  {currencySymbol}
                  {taxAmt.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  Applicable hotel taxes
                </div>
              </div>
              {/* Card 5 */}
              <div className="bg-[#F6F7F8] border border-gray-200 rounded-xl p-5 text-left">
                <div className="flex items-center gap-2 text-gray-500 mb-3">
                  <Percent className="h-4 w-4" />
                  <span className="text-[13px] font-semibold uppercase">
                    Platform Fee ({PLATFORM_FEE_PERCENT}%)
                  </span>
                </div>
                <div className="text-[24px] font-bold text-gray-900">
                  {currencySymbol}
                  {feeAmt.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-sm text-gray-400 mt-1">
                  Platform fee on the hotel payment
                </div>
              </div>
              {/* Card 6 */}
              <div className="bg-[#F6F7F8] border-[2px] border-[#0F2757] rounded-xl p-5 text-left">
                <div className="flex items-center gap-2 text-[#0F2757] mb-3">
                  <Wallet className="h-4 w-4" />
                  <span className="text-[13px] font-semibold uppercase">
                    Total Payment
                  </span>
                </div>
                <div className="text-[24px] font-bold text-[#0F2757]">
                  {currencySymbol}
                  {finalAmt.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  Total amount to be charged
                </div>
              </div>
            </div>

            {/* Table Header */}
            <div className="mt-8 text-left">
              <h4 className="text-[16px] font-semibold text-[#0F2757]">
                Booked Hotels
              </h4>
              <p className="text-sm text-gray-500 mt-1">
                Review the hotel assigned to each booking and the associated
                room costs.
              </p>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-xl mt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[140px]">
                      Hotel Booking ID
                    </TableHead>
                    <TableHead className="min-w-[100px]">PNR</TableHead>
                    <TableHead className="min-w-[160px]">Contact</TableHead>
                    <TableHead className="min-w-[100px]">Class</TableHead>
                    <TableHead className="min-w-[120px]">Passengers</TableHead>
                    <TableHead className="min-w-[180px]">Hotel</TableHead>
                    <TableHead className="min-w-[140px]">
                      Booking Status
                    </TableHead>
                    <TableHead className="min-w-[100px]">Rating</TableHead>
                    <TableHead className="min-w-[80px]">Rooms</TableHead>
                    <TableHead className="min-w-[100px]">Total</TableHead>
                    <TableHead className="min-w-[80px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingHotelBookings && hotelBookings.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={11}
                        className="text-center py-10 text-gray-500"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-[#0F2757]" />
                          <span>Loading hotel bookings...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : hotelBookings.length > 0 ? (
                    hotelBookings.map((hb) => {
                      const pb = hb.passengerBooking;
                      // id 0: the PNR has no hotel booking yet (e.g. failed before any supplier booking).
                      const hasHotelBooking = hb.id > 0;
                      const hotelBookingId = String(hb.id);
                      const pnr = pb?.pnr || "-";
                      const contactName =
                        `${pb?.firstName || ""} ${pb?.lastName || ""}`.trim() ||
                        "-";
                      const email = pb?.email || "";
                      const travelClass =
                        ENUM_TO_TRAVEL_CLASS[pb?.travelClass] ||
                        pb?.travelClass ||
                        "Economy";
                      const isBusiness =
                        travelClass === "Business" ||
                        travelClass === "First Class";
                      const totalPassengers =
                        (pb?.adults || 0) + (pb?.children || 0);
                      const passengersCount = totalPassengers || 1;
                      const isConfirmed =
                        !hb.status || hb.status === "confirmed";
                      const hotelName = isConfirmed
                        ? hb.hotelName || "Transit Hotel"
                        : (hb.status === "manual_check" ||
                              hb.status === "in_progress") &&
                            hb.hotelName
                          ? `${hb.hotelName} (not confirmed)`
                          : "Not booked";
                      const ratingVal = parseFloat(hb.rating) || 4;
                      const stars = Math.min(
                        5,
                        Math.max(1, Math.round(ratingVal)),
                      );
                      const rooms = hb.totalRooms || 1;
                      const bookingCost = Number(hb.totalCost) || 0;

                      return (
                        <TableRow key={pb?.id ?? hb.id}>
                          <TableCell className="font-medium text-gray-900">
                            {hasHotelBooking ? hotelBookingId : "-"}
                          </TableCell>
                          <TableCell className="font-medium text-gray-900">
                            {pnr}
                          </TableCell>
                          <TableCell>
                            <div className="font-semibold text-gray-900">
                              {contactName}
                            </div>
                            <div className="text-xs text-gray-500">{email}</div>
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "rounded px-2.5 py-1 text-xs font-semibold inline-block capitalize",
                                isBusiness
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-gray-100 text-gray-700",
                              )}
                            >
                              {travelClass}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            {passengersCount}
                          </TableCell>
                          <TableCell className="font-medium">
                            {hotelName}
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex",
                                !isConfirmed && hb.reason && "cursor-help",
                              )}
                              title={
                                !isConfirmed && hb.reason
                                  ? hb.reason
                                  : undefined
                              }
                            >
                              <StatusBadge
                                status={
                                  HOTEL_BOOKING_STATUS_LABEL[
                                    hb.status ?? "confirmed"
                                  ] ??
                                  hb.status ??
                                  "Confirmed"
                                }
                              />
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-start text-left text-amber-400">
                              {[...Array(stars)].map((_, i) => (
                                <Star
                                  key={i}
                                  className="h-3 w-3 fill-current"
                                />
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">{rooms}</TableCell>
                          <TableCell className="font-semibold text-gray-900">
                            {currencySymbol}
                            {bookingCost.toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })}
                          </TableCell>
                          <TableCell>
                            {hasHotelBooking && (
                              <button
                                type="button"
                                disabled={loadingEyeBookingId === hb.id}
                                onClick={() =>
                                  handleOpenBookingDetails(
                                    hb,
                                    pb,
                                    hotelBookingId,
                                    hotelName,
                                    hb.rating,
                                    rooms,
                                    bookingCost,
                                    travelClass,
                                  )
                                }
                                className="p-1.5 text-gray-400 hover:text-[#0F2757] hover:bg-gray-100 rounded transition-colors cursor-pointer disabled:opacity-80"
                              >
                                {loadingEyeBookingId === hb.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin text-[#0F2757]" />
                                ) : (
                                  <Eye className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  ) : (
                    (addedBookings.length > 0
                      ? addedBookings
                      : [
                          {
                            id: "1",
                            pnr: "AAAAA",
                            firstName: "New",
                            lastName: "Admin",
                            email: "ops@summitair.com",
                            adults: 1,
                            children: 0,
                            travelClass: "Economy",
                          },
                        ]
                    )
                      .slice(
                        (step5CurrentPage - 1) * step5ResultsPerPage,
                        step5CurrentPage * step5ResultsPerPage,
                      )
                      .map((b, idx) => {
                        const isBusiness =
                          b.travelClass === "Business" ||
                          b.travelClass === "First Class";
                        const depAirportCode = newDepartureAirport || "Airport";
                        const hotelName = isBusiness
                          ? `Grand Regency ${depAirportCode}`
                          : `Transit Express ${depAirportCode}`;
                        const stars = isBusiness ? 4 : 3;
                        const rooms = Math.ceil((b.adults + b.children) / 2);
                        const bookingCost =
                          hotelAllocations?.totalSellingPrice &&
                          (addedBookings.length === 1 || !addedBookings.length)
                            ? hotelAllocations.totalSellingPrice
                            : rooms * (isBusiness ? 160 : 120);
                        const passengersCount = b.adults + b.children;

                        return (
                          <TableRow key={b.id || idx}>
                            <TableCell className="font-medium text-gray-900">
                              HB-00023{idx + 1}
                            </TableCell>
                            <TableCell className="font-medium text-gray-900">
                              {b.pnr}
                            </TableCell>
                            <TableCell>
                              <div className="font-semibold text-gray-900">
                                {b.firstName} {b.lastName}
                              </div>
                              <div className="text-xs text-gray-500">
                                {b.email}
                              </div>
                            </TableCell>
                            <TableCell>
                              <span
                                className={cn(
                                  "rounded px-2.5 py-1 text-xs font-semibold inline-block capitalize",
                                  isBusiness
                                    ? "bg-purple-100 text-purple-800"
                                    : "bg-gray-100 text-gray-700",
                                )}
                              >
                                {b.travelClass}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {passengersCount}
                            </TableCell>
                            <TableCell className="font-medium">
                              {hotelName}
                            </TableCell>
                            <TableCell>-</TableCell>
                            <TableCell>
                              <div className="flex justify-center items-center text-amber-400">
                                {[...Array(stars)].map((_, i) => (
                                  <Star
                                    key={i}
                                    className="h-3 w-3 fill-current"
                                  />
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {rooms}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-gray-900">
                              {currencySymbol}
                              {bookingCost.toLocaleString(undefined, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedBookingForDrawer(b);
                                  setSelectedDrawerFlightId(flightId);
                                  setSelectedDrawerHotelBookingId(null);
                                  setSelectedDrawerDetailData(null);
                                  setIsBookingDetailsOpen(true);
                                }}
                                className="p-1.5 text-gray-400 hover:text-[#0F2757] hover:bg-gray-100 rounded transition-colors cursor-pointer"
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                            </TableCell>
                          </TableRow>
                        );
                      })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            <Pagination
              totalResults={
                hotelBookings.length > 0
                  ? totalHotelBookings
                  : addedBookings.length || 1
              }
              currentPage={step5CurrentPage}
              setCurrentPage={setStep5CurrentPage}
              resultsPerPage={step5ResultsPerPage}
              setResultsPerPage={setStep5ResultsPerPage}
              totalPages={Math.ceil(
                (hotelBookings.length > 0
                  ? totalHotelBookings
                  : addedBookings.length || 1) / step5ResultsPerPage,
              )}
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
                <h3 className="text-xl font-semibold text-gray-900 font-figtree">
                  Payment
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Review the final amount and select the card to pay for the
                  hotel bookings.
                </p>
              </div>
            </div>

            {isLoadingHotelSummary && !hotelSummary ? (
              <div className="bg-gray-50/80 rounded-xl p-8 flex items-center justify-center gap-2 text-gray-500 border border-gray-100">
                <Loader2 className="h-5 w-5 animate-spin text-[#0F2757]" />
                <span>Loading payment details...</span>
              </div>
            ) : (
              <div className="bg-gray-50/80 rounded-xl p-6 space-y-4 text-left text-sm border border-gray-100">
                <div className="flex justify-between items-center text-gray-500">
                  <span>Hotel Cost</span>
                  <span className="font-semibold text-gray-900">
                    {currencySymbol}
                    {hotelCost.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-500">
                  <span>Platform Discount</span>
                  <span className="font-semibold text-[#1FAD53]">
                    -{currencySymbol}
                    {platformDiscount.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-500">
                  <span>Hotel Tax</span>
                  <span className="font-semibold text-gray-900">
                    {currencySymbol}
                    {hotelTax.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-gray-500">
                  <span>Platform Fee ({PLATFORM_FEE_PERCENT}%)</span>
                  <span className="font-semibold text-gray-900">
                    {currencySymbol}
                    {platformFee.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                <div className="h-px bg-gray-200 w-full" />
                <div className="flex justify-between items-center font-bold text-gray-900 text-base">
                  <span>Total Payment</span>
                  <span className="text-[20px]">
                    {currencySymbol}
                    {totalPayment.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-4 text-left pt-4">
              <div>
                <h3 className="text-base font-semibold text-gray-900 font-figtree">
                  Payment Method
                </h3>
                <p className="text-sm text-gray-500 mt-0.5">
                  Select the card to charge for these hotel bookings.
                </p>
              </div>

              <AddCardModal
                isOpen={isAddingCard}
                onClose={() => setIsAddingCard(false)}
              />

              {[
                {
                  id: "visa",
                  type: "card",
                  title: "Visa",
                  number: "4242",
                  expires: "08/28",
                  isDefault: true,
                },
                {
                  id: "mastercard",
                  type: "card",
                  title: "Mastercard",
                  number: "5599",
                  expires: "03/27",
                  isDefault: false,
                },
              ].map((method) => {
                const isSelected = paymentMethod === method.id;
                return (
                  <div
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={cn(
                      "p-4 rounded-xl border flex items-center justify-between cursor-pointer transition-all duration-150",
                      isSelected
                        ? "border-[#0F2757] bg-[#0F2757]/5 ring-1 ring-[#0F2757]"
                        : "border-gray-200 hover:border-gray-300 bg-white",
                    )}
                  >
                    <div className="flex items-center gap-4 text-left">
                      <div className="size-10 bg-white border border-gray-200 rounded-lg flex items-center justify-center text-slate-650 shrink-0 shadow-2xs">
                        <CreditCard className="h-5 w-5 text-gray-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {method.title} •••• {method.number}
                          </p>
                          {method.isDefault && (
                            <span className="text-[10px] px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full font-medium ml-2 font-figtree">
                              Default
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          Expires {method.expires}
                        </p>
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

              {hasPermission("edit") && (
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
              )}

              <div className="pt-4">
                <label className="flex items-center gap-3 p-4 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors group">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={paymentConfirmed}
                      onChange={(e) => setPaymentConfirmed(e.target.checked)}
                    />
                    <div
                      className={cn(
                        "size-5 rounded border flex items-center justify-center transition-colors shrink-0",
                        paymentConfirmed
                          ? "bg-[#0F2757] border-[#0F2757]"
                          : "border-gray-300 bg-white group-hover:border-[#0F2757]",
                      )}
                    >
                      {paymentConfirmed && (
                        <Check className="h-3.5 w-3.5 text-white stroke-[3]" />
                      )}
                    </div>
                  </div>
                  <span className="text-sm text-gray-700">
                    I confirm that I want to charge {currencySymbol}
                    {totalPayment.toLocaleString(undefined, {
                      minimumFractionDigits: 2,
                    })}{" "}
                    to the selected card.
                  </span>
                </label>
              </div>
            </div>
          </div>
        );
      case 7:
        return (
          <div className="max-w-[560px] mx-auto py-4 space-y-6 animate-in fade-in duration-300 flex flex-col items-center">
            {/* Top Centered Icon */}
            <div className="size-14 rounded-2xl bg-[#F1F5F9] flex items-center justify-center text-[#1E2B4D]">
              <Send className="w-6 h-6 rotate-[-12deg]" />
            </div>

            {/* Header Text */}
            <div className="text-center space-y-2">
              <h3 className="text-[22px] font-bold text-[#111827] tracking-tight font-figtree">
                Notify Passengers
              </h3>
              <p className="text-sm text-gray-500 max-w-[480px] mx-auto leading-relaxed">
                {FLIGHT_PAYMENT_STEP_ENABLED
                  ? "Payment is complete."
                  : "All hotels are booked and charged to your wallet."}{" "}
                Publishing will send the hotel booking confirmation email,
                including the booking confirmation PDF, to every booking
                contact address.
              </p>
            </div>

            {/* Success Alert */}
            {/* <div className="w-full bg-[#EBF7EE] border border-[#C8E6C9] px-4 py-3.5 rounded-xl text-sm flex items-center justify-start gap-2.5 text-[#2E7D32]">
              <CheckCircle2 className="w-4.5 h-4.5 text-[#2E7D32] shrink-0" />
              <span className="font-medium">
                Payment successfully processed for this cancelled flight.
              </span>
            </div> */}

            {/* Warning / Note Alert */}
            <div className="w-full bg-[#FFF8E1] border border-[#FFE082] px-4 py-3.5 rounded-xl text-sm text-[#B76E00] text-center">
              <p>
                <span className="font-bold">Note:</span> This action cannot be
                undone. Passengers will receive their hotel booking
                confirmations immediately.
              </p>
            </div>

            {/* Summary Box */}
            <div className="w-full bg-[#F8FAFC] rounded-xl p-5 space-y-3.5 text-sm border border-gray-100/80">
              <div className="flex justify-between items-center text-gray-600">
                <span className="font-medium">Confirmation Emails:</span>
                <span className="font-bold text-gray-900 text-base">
                  {totalBookingsCount}
                </span>
              </div>
              <div className="flex justify-between items-center text-gray-600">
                <span className="font-medium">Total Passengers:</span>
                <span className="font-bold text-gray-900 text-base">
                  {totalPassengersCount}
                </span>
              </div>
            </div>

            {/* Centered Publish Button */}
            {hasPermission("edit") && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handlePublishFlight}
                  disabled={isPublishingFlight}
                  className="bg-[#1E2B4D] hover:bg-[#15203A] disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-7 rounded-xl transition-all duration-150 text-sm inline-flex items-center justify-center gap-2.5 shadow-sm cursor-pointer"
                >
                  {isPublishingFlight ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Send Confirmations & Publish</span>
                    </>
                  )}
                </button>
              </div>
            )}
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
          onClick={handleBackToCancelledFlights}
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
          <div
            className={cn(
              "mt-8 pt-6 flex items-center",
              activeStep === 1 || activeStep === 5
                ? "justify-end"
                : "justify-between",
            )}
          >
            {activeStep > 1 && activeStep !== 5 && (
              <button
                onClick={handlePrevStep}
                disabled={isProcessingPayment}
                className={cn(
                  "flex items-center gap-2 border border-gray-200 bg-gray-100 hover:bg-gray-300 text-gray-700 font-medium py-2.5 px-5 rounded-lg transition-colors cursor-pointer text-sm",
                  isProcessingPayment && "opacity-50 cursor-not-allowed",
                )}
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back</span>
              </button>
            )}

            {activeStep !== 7 && hasPermission("edit") && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleNextStep}
                  disabled={
                    isCreatingFlight ||
                    isConfirmingBookings ||
                    isAllocating ||
                    isCheckingAllocation ||
                    isProcessingPayment ||
                    (activeStep === 2 && failedBookings.length > 0) ||
                    (activeStep === 5 && !!flightId && !allPnrsBooked) ||
                    (activeStep === 6 && !paymentConfirmed)
                  }
                  className={cn(
                    "flex items-center gap-2 font-medium py-2.5 px-5 rounded-lg transition-colors cursor-pointer text-sm",
                    isCreatingFlight ||
                      isConfirmingBookings ||
                      isAllocating ||
                      isCheckingAllocation ||
                      isProcessingPayment ||
                      (activeStep === 2 && failedBookings.length > 0) ||
                      (activeStep === 5 && !!flightId && !allPnrsBooked) ||
                      (activeStep === 6 && !paymentConfirmed)
                      ? "bg-[#9CA3AF] text-white cursor-not-allowed border-none"
                      : "bg-[#0F2757] hover:bg-[#162259] text-white",
                  )}
                >
                  {isCreatingFlight ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : isConfirmingBookings ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Confirming...</span>
                    </>
                  ) : isAllocating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Allocating Hotels...</span>
                    </>
                  ) : isProcessingPayment ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Processing Payment...</span>
                    </>
                  ) : activeStep === 6 ? (
                    <>
                      <CreditCard className="h-4 w-4" />
                      <span>
                        Pay {currencySymbol}
                        {totalPayment.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </>
                  ) : (
                    <>
                      <span>
                        {activeStep === 5
                          ? FLIGHT_PAYMENT_STEP_ENABLED
                            ? "Continue to Payment"
                            : "Continue to Publish"
                          : "Continue"}
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <PassengerBookingDetailDrawer
        isOpen={isPassengerBookingDrawerOpen}
        onClose={() => {
          setIsPassengerBookingDrawerOpen(false);
          setSelectedPassengerBooking(null);
        }}
        booking={selectedPassengerBooking}
      />

      <BookingDetailsDrawer
        isOpen={isBookingDetailsOpen}
        onClose={() => {
          setIsBookingDetailsOpen(false);
          setSelectedDrawerHotelBookingId(null);
          setSelectedDrawerDetailData(null);
        }}
        booking={selectedBookingForDrawer}
        flightId={selectedDrawerFlightId}
        hotelBookingId={selectedDrawerHotelBookingId}
        detailData={selectedDrawerDetailData}
        downloadType="download"
      />

      <FailedBookingHotelDrawer
        isOpen={!!failedBookingForHotel}
        flightId={flightId}
        booking={failedBookingForHotel}
        queue={(hotelAllocations?.results ?? []).filter(
          (r) => r.bookingStatus === "FAILED",
        )}
        onNavigate={setFailedBookingForHotel}
        onClose={() => setFailedBookingForHotel(null)}
        onBooked={async () => {
          if (!flightId) return;
          const response =
            await cancellationService.getHotelAllocationStatus(flightId);
          setHotelAllocations(response?.data || response);
        }}
      />
    </div>
  );
}
