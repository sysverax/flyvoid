"use client";

import { useState, useEffect, useRef } from "react";
import { Header } from "@/src/components/layout/Header";
import { User, Bell, Globe, Lock, Plug, Building2, Plane, Mail, ShieldCheck, Smartphone, Check, Eye, EyeOff, Info, Save, Loader2 } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { InputField } from "@/src/components/ui/InputField";
import { toast } from "react-toastify";
import { TfaVerification } from "@/src/components/profile/TfaVerification";
import { profileService } from "@/src/services/profile.service";
import { authService } from "@/src/services/auth.service";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  // { id: "notifications", label: "Notifications", icon: Bell },
  // { id: "preferences", label: "Preferences", icon: Globe },
  { id: "security", label: "Security", icon: Lock },
  // { id: "integrations", label: "Integrations", icon: Plug },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");

  return (
    <div className="flex flex-col min-h-screen">
      <div className="mb-7 flex flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%] font-figtree">
            Settings
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1 font-figtree">
            Manage your account settings and preferences
          </p>
        </div>
      </div>

      <div className="border-b border-gray-200 mt-4 mb-6">
        <div className="flex space-x-8">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 pb-4 text-sm font-medium transition-colors cursor-pointer relative",
                activeTab === tab.id
                  ? "text-[#0F2757]"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0F2757]" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 pb-16">
        {activeTab === "profile" && <ProfileTab />}
        {/* {activeTab === "notifications" && <NotificationsTab />} */}
        {/* {activeTab === "preferences" && <PreferencesTab />} */}
        {activeTab === "security" && <SecurityTab />}
        {/* {activeTab === "integrations" && <IntegrationsTab />} */}
      </div>
    </div>
  );
}

function ProfileTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const [initialFirstName, setInitialFirstName] = useState("");
  const [initialLastName, setInitialLastName] = useState("");

  const [airlineName, setAirlineName] = useState("");
  const [iataCode, setIataCode] = useState("");
  const [primaryContact, setPrimaryContact] = useState("");

  useEffect(() => {
    let isMounted = true;
    const loadProfileData = async () => {
      setIsLoading(true);
      try {
        const [userRes, orgRes] = await Promise.allSettled([
          profileService.getUserProfile(),
          profileService.getAirlineProfile(),
        ]);

        if (isMounted) {
          if (userRes.status === "fulfilled" && userRes.value) {
            const u = userRes.value;
            const fName = u.firstName || "";
            const lName = u.lastName || "";
            setFirstName(fName);
            setLastName(lName);
            setInitialFirstName(fName);
            setInitialLastName(lName);
            setEmail(u.email || "");
          }

          if (orgRes.status === "fulfilled" && orgRes.value) {
            const org = orgRes.value;
            setAirlineName(org.name || "");
            setIataCode(org.code || "");
            setPrimaryContact(
              org.contactEmail || (userRes.status === "fulfilled" ? userRes.value?.email || "" : "")
            );
          }
        }
      } catch (err: any) {
        console.error("Failed to fetch profile data:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadProfileData();
    return () => {
      isMounted = false;
    };
  }, []);

  const isProfileChanged =
    firstName.trim() !== initialFirstName.trim() ||
    lastName.trim() !== initialLastName.trim();

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isProfileChanged) return;

    if (!firstName.trim() || !lastName.trim()) {
      toast.error("First name and last name are required");
      return;
    }

    setIsSaving(true);
    try {
      const updated = await profileService.updateUserProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      setInitialFirstName(updated.firstName || firstName.trim());
      setInitialLastName(updated.lastName || lastName.trim());
      toast.success("Profile updated successfully");

      if (typeof window !== "undefined") {
        const stored = sessionStorage.getItem("airline_current_user");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            parsed.firstName = updated.firstName || firstName.trim();
            parsed.lastName = updated.lastName || lastName.trim();
            sessionStorage.setItem("airline_current_user", JSON.stringify(parsed));
          } catch (e) {
            // ignore JSON parse error
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] bg-white p-12 flex flex-col items-center justify-center gap-2 min-h-[300px]">
        <svg
          className="animate-spin h-8 w-8 text-[#0F2757]"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        <span className="text-gray-500 font-figtree text-sm">Loading profile details...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="w-full px-6 pb-8 pt-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-5">
          <div className="self-stretch flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <div className="size-8 p-2 bg-gray-100 rounded-md flex items-center justify-center shrink-0">
                  <Building2 className="size-4 text-gray-500" />
                </div>
                <h2 className="text-gray-800 text-lg font-semibold font-figtree leading-[100%] tracking-[0%]">
                  Airline Profile
                </h2>
              </div>
              <p className="text-gray-500 text-sm font-normal font-figtree">
                Your organization information
              </p>
            </div>
          </div>

          <div className="self-stretch flex flex-col justify-start items-start gap-5 w-full">
            <InputField label="Airline Name" value={airlineName || "N/A"} disabled />
            <InputField label="IATA Code" value={iataCode || "N/A"} disabled />
            <InputField label="Primary Contact" value={primaryContact || email || "N/A"} disabled />
          </div>
        </div>

        <div className="w-full px-6 pb-8 pt-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-5">
          <div className="self-stretch flex justify-between items-center">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <div className="size-8 p-2 bg-gray-100 rounded-md flex items-center justify-center shrink-0">
                  <User className="size-4 text-gray-500" />
                </div>
                <h2 className="text-gray-800 text-lg font-semibold font-figtree leading-[100%] tracking-[0%]">
                  Personal Information
                </h2>
              </div>
              <p className="text-gray-500 text-sm font-normal font-figtree">
                Your basic account details
              </p>
            </div>
          </div>

          <div className="self-stretch flex flex-col justify-start items-start gap-5 w-full">
            <InputField
              label="First Name"
              value={firstName}
              onChange={(val) => setFirstName(val)}
            />
            <InputField
              label="Last Name"
              value={lastName}
              onChange={(val) => setLastName(val)}
            />
            <InputField
              label="Email Address"
              value={email}
              disabled
              helperText="Email cannot be changed. Contact support if needed."
            />
          </div>

          <div className="pt-2 flex justify-end w-full">
            <button
              type="submit"
              disabled={isSaving || !isProfileChanged}
              className="flex h-[44px] items-center justify-center gap-2 rounded-[10px] bg-[#0F2757] px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-[#162259] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </form>
  );
}

function NotificationsTab() {
  const [emailNotif, setEmailNotif] = useState(true);
  const [hotelNotif, setHotelNotif] = useState(true);
  const [balanceNotif, setBalanceNotif] = useState(true);

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 font-figtree">Notifications</h2>
        <p className="text-sm text-gray-500 mt-0.5">Configure how you receive alerts and updates</p>

        <div className="bg-white border border-gray-200 rounded-xl p-6 mt-4">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="size-10 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center shrink-0">
                  <Mail className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Email Notifications</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Receive operational updates and summaries via email</p>
                </div>
              </div>
              <button
                onClick={() => setEmailNotif(!emailNotif)}
                className={cn(
                  "w-12 h-6.5 rounded-full p-1 cursor-pointer transition-colors duration-200 flex items-center shrink-0",
                  emailNotif ? "bg-[#0F2757] justify-end" : "bg-gray-300 justify-start"
                )}
              >
                <div className="size-4.5 rounded-full bg-white shadow-sm" />
              </button>
            </div>

            <div className="h-px bg-gray-100 w-full" />

            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="size-10 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center shrink-0">
                  <Bell className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Hotel Allocation Alerts</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Get notified when hotel allocations are completed</p>
                </div>
              </div>
              <button
                onClick={() => setHotelNotif(!hotelNotif)}
                className={cn(
                  "w-12 h-6.5 rounded-full p-1 cursor-pointer transition-colors duration-200 flex items-center shrink-0",
                  hotelNotif ? "bg-[#0F2757] justify-end" : "bg-gray-300 justify-start"
                )}
              >
                <div className="size-4.5 rounded-full bg-white shadow-sm" />
              </button>
            </div>

            <div className="h-px bg-gray-100 w-full" />

            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="size-10 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Low Balance Warnings</h3>
                  <p className="text-sm text-gray-500 mt-0.5">Alert when outstanding service fees approach your credit limit</p>
                </div>
              </div>
              <button
                onClick={() => setBalanceNotif(!balanceNotif)}
                className={cn(
                  "w-12 h-6.5 rounded-full p-1 cursor-pointer transition-colors duration-200 flex items-center shrink-0",
                  balanceNotif ? "bg-[#0F2757] justify-end" : "bg-gray-300 justify-start"
                )}
              >
                <div className="size-4.5 rounded-full bg-white shadow-sm" />
              </button>
            </div>
          </div>
        </div>

        <div className="pt-6">
          <button className="bg-[#2B3B67] hover:bg-[#1E2B4D] text-white font-medium py-2.5 px-6 rounded-lg transition-colors cursor-pointer text-sm">
            Save Notification Preferences
          </button>
        </div>
      </div>
    </div>
  );
}

function PreferencesTab() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 font-figtree">Preferences</h2>
        <p className="text-sm text-gray-500 mt-0.5">Customize your portal experience</p>

        <div className="bg-white border border-gray-200 rounded-xl p-6 mt-4 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Timezone</label>
            <div className="relative">
              <select className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F2757]/20 focus:border-[#0F2757] transition-all cursor-pointer">
                <option>Eastern Time (ET)</option>
                <option>Central Time (CT)</option>
                <option>Mountain Time (MT)</option>
                <option>Pacific Time (PT)</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-2">Used for displaying dates and scheduling reports</p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Default Hotel Class (Economy Passengers)</label>
            <div className="relative">
              <select className="w-full appearance-none bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#0F2757]/20 focus:border-[#0F2757] transition-all cursor-pointer">
                <option>3-Star Hotels</option>
                <option>4-Star Hotels</option>
              </select>
              <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 p-4 rounded-xl text-sm flex items-start gap-3 text-left">
            <Info className="h-5 w-5 text-slate-500 shrink-0 mt-0.5" />
            <p className="text-slate-600 text-sm leading-relaxed">
              <span className="font-semibold text-gray-700">Business class passengers</span> are automatically allocated to 4-star or higher hotels based on availability and airline policy. This setting only affects economy class allocations.
            </p>
          </div>

          <div className="pt-2">
            <button className="bg-[#2B3B67] hover:bg-[#1E2B4D] text-white font-medium py-2.5 px-6 rounded-lg transition-colors cursor-pointer text-sm">
              Save Preferences
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecurityTab() {
  const [email, setEmail] = useState("admin@skyways.com");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const [tfaMethod, setTfaMethod] = useState<"email" | "authenticator">("email");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // 2FA state
  const [isConfiguringTfa, setIsConfiguringTfa] = useState(false);
  const [isShowingRecoveryCodes, setIsShowingRecoveryCodes] = useState(false);
  const [isGeneratingSetup, setIsGeneratingSetup] = useState(false);
  const [tfaSetupData, setTfaSetupData] = useState<{
    manualEntryKey: string;
    qrCodeDataUrl: string;
  } | null>(null);

  const [isTfaEnabled, setIsTfaEnabled] = useState(false);
  const [tfaEnabledMethod, setTfaEnabledMethod] = useState<"email" | "authenticator">("email");
  const [tfaEnabledDate, setTfaEnabledDate] = useState("");

  // Inline Disable 2FA state
  const [isDisablingTfa, setIsDisablingTfa] = useState(false);
  const [disableCode, setDisableCode] = useState<string[]>(Array(6).fill(""));
  const [isSubmittingDisable, setIsSubmittingDisable] = useState(false);
  const [disableError, setDisableError] = useState("");
  const disableInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (isDisablingTfa && disableInputRefs.current[0]) {
      disableInputRefs.current[0].focus();
    }
  }, [isDisablingTfa]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("airline_current_user");
      if (stored) {
        try {
          const user = JSON.parse(stored);
          if (user?.email) {
            setEmail(user.email);
            const enabled = sessionStorage.getItem(`airline_tfa_enabled_${user.email}`) === "true";
            const method = sessionStorage.getItem(`airline_tfa_method_${user.email}`) as "email" | "authenticator";
            const date = sessionStorage.getItem(`airline_tfa_date_${user.email}`);

            if (enabled) setIsTfaEnabled(true);
            if (method) setTfaEnabledMethod(method);
            if (date) setTfaEnabledDate(date);
          }
        } catch (e) {
          // ignore error
        }
      }
    }
  }, []);

  const [passwordTouched, setPasswordTouched] = useState<{
    currentPassword?: boolean;
    newPassword?: boolean;
    confirmPassword?: boolean;
  }>({});
  const [passwordErrors, setPasswordErrors] = useState<{
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  }>({});

  const validatePasswordRule = (value: string): string => {
    if (!value) {
      return "Password is required";
    }
    const hasMinLength = value.length >= 8;
    const hasUppercase = /[A-Z]/.test(value);
    const hasLowercase = /[a-z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSpecial = /[!@#$%^&*?]/.test(value);
    const hasForbidden = /[^a-zA-Z\d!@#$%^&*?]/.test(value);

    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial || hasForbidden) {
      return "Password must be at least 8 characters and include uppercase, lowercase, number, and special character (!@#$%^&*?)";
    }
    return "";
  };

  const validateConfirmPasswordRule = (confirmVal: string, passwordVal: string): string => {
    if (!confirmVal) {
      return "Please confirm your password";
    }
    if (confirmVal !== passwordVal) {
      return "Passwords do not match";
    }
    return "";
  };

  const isPasswordChanged =
    currentPassword.trim().length > 0 ||
    newPassword.trim().length > 0 ||
    confirmPassword.trim().length > 0;

  const handlePasswordChange = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isPasswordChanged) return;
    setPasswordTouched({
      currentPassword: true,
      newPassword: true,
      confirmPassword: true,
    });

    const currentErr = !currentPassword ? "Current password is required" : "";
    const newErr = validatePasswordRule(newPassword);
    const confirmErr = validateConfirmPasswordRule(confirmPassword, newPassword);

    if (currentErr || newErr || confirmErr) {
      setPasswordErrors({
        currentPassword: currentErr || undefined,
        newPassword: newErr || undefined,
        confirmPassword: confirmErr || undefined,
      });
      return;
    }

    setPasswordErrors({});
    setIsUpdatingPassword(true);
    try {
      const msg = await authService.changePassword(currentPassword, newPassword);
      toast.success(msg || "Password updated successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordTouched({});
    } catch (err: any) {
      toast.error(err.message || "Failed to update password.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSendOtp = async () => {
    if (tfaMethod === "authenticator") {
      setIsGeneratingSetup(true);
      try {
        const result = await authService.setupTfa();
        setTfaSetupData({
          manualEntryKey: result.manualEntryKey,
          qrCodeDataUrl: result.qrCodeDataUrl,
        });
        setIsConfiguringTfa(true);
        toast.success(result.message || "Authenticator setup generated");
      } catch (err: any) {
        toast.error(err.message || "Failed to generate Authenticator QR code.");
      } finally {
        setIsGeneratingSetup(false);
      }
    } else {
      setIsGeneratingSetup(true);
      try {
        const message = await authService.sendForgotPasswordOtp(email);
        setIsConfiguringTfa(true);
        toast.success(message || `Verification OTP sent to ${email}`);
      } catch (err: any) {
        toast.error(err.message || `Failed to send OTP to ${email}`);
      } finally {
        setIsGeneratingSetup(false);
      }
    }
  };

  const handleCancelTfa = () => {
    setIsConfiguringTfa(false);
    setIsShowingRecoveryCodes(false);
    setTfaSetupData(null);
  };

  const handleCompleteSetup = () => {
    setIsTfaEnabled(true);
    setTfaEnabledMethod(tfaMethod);
    const today = new Date();
    const dateStr = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
    setTfaEnabledDate(dateStr);
    setIsConfiguringTfa(false);
    setIsShowingRecoveryCodes(false);

    if (email && typeof window !== "undefined") {
      sessionStorage.setItem(`airline_tfa_enabled_${email}`, "true");
      sessionStorage.setItem(`airline_tfa_method_${email}`, tfaMethod);
      sessionStorage.setItem(`airline_tfa_date_${email}`, dateStr);
    }
  };

  const handleDisableCodeChange = (index: number, val: string) => {
    if (isNaN(Number(val)) && val !== "") return;
    const newCode = [...disableCode];
    newCode[index] = val;
    setDisableCode(newCode);
    setDisableError("");

    if (val !== "" && index < 5) {
      disableInputRefs.current[index + 1]?.focus();
    }
  };

  const handleDisableKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (disableCode[index] === "" && index > 0) {
        disableInputRefs.current[index - 1]?.focus();
        const newCode = [...disableCode];
        newCode[index - 1] = "";
        setDisableCode(newCode);
      } else {
        const newCode = [...disableCode];
        newCode[index] = "";
        setDisableCode(newCode);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      disableInputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      disableInputRefs.current[index + 1]?.focus();
    }
  };

  const handleDisablePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    if (pasteData.length === 6 && /^\d+$/.test(pasteData)) {
      setDisableCode(pasteData.split(""));
      setDisableError("");
      disableInputRefs.current[5]?.focus();
    }
  };

  const handleConfirmDisableTfa = async () => {
    const codeStr = disableCode.join("");
    if (codeStr.length < 6) {
      setDisableError("Please enter the full 6-digit verification code.");
      return;
    }

    setDisableError("");
    setIsSubmittingDisable(true);

    try {
      const result = await authService.disableTfa(codeStr);
      setIsTfaEnabled(false);
      setIsDisablingTfa(false);
      setDisableCode(Array(6).fill(""));
      setIsConfiguringTfa(false);
      setIsShowingRecoveryCodes(false);
      setTfaSetupData(null);

      if (email && typeof window !== "undefined") {
        sessionStorage.removeItem(`airline_tfa_enabled_${email}`);
        sessionStorage.removeItem(`airline_tfa_method_${email}`);
        sessionStorage.removeItem(`airline_tfa_date_${email}`);
      }

      toast.success(result.message || "Two-Factor Authentication disabled.");
    } catch (err: any) {
      const errMsg = err.message || "Failed to disable 2FA.";
      setDisableError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmittingDisable(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 font-figtree">Security</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account security</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4 items-start">
          <form onSubmit={handlePasswordChange} className="w-full p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-5" noValidate>
            <h3 className="text-sm font-semibold text-gray-900">Update Password</h3>

            <div className="self-stretch flex flex-col gap-4 w-full">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrent ? "text" : "password"}
                    placeholder="Enter current password"
                    value={currentPassword}
                    onChange={(e) => {
                      setCurrentPassword(e.target.value);
                      if (passwordTouched.currentPassword) {
                        setPasswordErrors((prev) => ({
                          ...prev,
                          currentPassword: !e.target.value ? "Current password is required" : undefined,
                        }));
                      }
                    }}
                    onBlur={() => {
                      setPasswordTouched((prev) => ({ ...prev, currentPassword: true }));
                      setPasswordErrors((prev) => ({
                        ...prev,
                        currentPassword: !currentPassword ? "Current password is required" : undefined,
                      }));
                    }}
                    className={cn(
                      "w-full bg-white border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all pr-10",
                      passwordErrors.currentPassword
                        ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/10"
                        : "border-gray-200 focus:ring-[#0F2757]/20 focus:border-[#0F2757]"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.currentPassword && (
                  <span className="text-rose-500 text-xs font-medium font-figtree mt-1 block">
                    {passwordErrors.currentPassword}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (passwordTouched.newPassword) {
                        setPasswordErrors((prev) => ({
                          ...prev,
                          newPassword: validatePasswordRule(e.target.value) || undefined,
                        }));
                      }
                      if (passwordTouched.confirmPassword) {
                        setPasswordErrors((prev) => ({
                          ...prev,
                          confirmPassword: validateConfirmPasswordRule(confirmPassword, e.target.value) || undefined,
                        }));
                      }
                    }}
                    onBlur={() => {
                      setPasswordTouched((prev) => ({ ...prev, newPassword: true }));
                      setPasswordErrors((prev) => ({
                        ...prev,
                        newPassword: validatePasswordRule(newPassword) || undefined,
                      }));
                    }}
                    className={cn(
                      "w-full bg-white border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all pr-10",
                      passwordErrors.newPassword
                        ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/10"
                        : "border-gray-200 focus:ring-[#0F2757]/20 focus:border-[#0F2757]"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.newPassword && (
                  <span className="text-rose-500 text-xs font-medium font-figtree mt-1 block">
                    {passwordErrors.newPassword}
                  </span>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (passwordTouched.confirmPassword) {
                        setPasswordErrors((prev) => ({
                          ...prev,
                          confirmPassword: validateConfirmPasswordRule(e.target.value, newPassword) || undefined,
                        }));
                      }
                    }}
                    onBlur={() => {
                      setPasswordTouched((prev) => ({ ...prev, confirmPassword: true }));
                      setPasswordErrors((prev) => ({
                        ...prev,
                        confirmPassword: validateConfirmPasswordRule(confirmPassword, newPassword) || undefined,
                      }));
                    }}
                    className={cn(
                      "w-full bg-white border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 transition-all pr-10",
                      passwordErrors.confirmPassword
                        ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/10"
                        : "border-gray-200 focus:ring-[#0F2757]/20 focus:border-[#0F2757]"
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {passwordErrors.confirmPassword && (
                  <span className="text-rose-500 text-xs font-medium font-figtree mt-1 block">
                    {passwordErrors.confirmPassword}
                  </span>
                )}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isUpdatingPassword || !isPasswordChanged}
                  className="bg-[#0F2757] hover:bg-[#162259] active:scale-[0.98] transition-all text-white font-medium py-2.5 px-6 rounded-lg cursor-pointer text-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isUpdatingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Password</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>

        <div className="w-full p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-6 mt-6">
          {/* Card Header */}
          <div className="self-stretch flex flex-col justify-start items-start gap-1.5">
            <div className="inline-flex justify-start items-center gap-2.5">
              <div className="flex justify-start items-center gap-1.5">
                <div className="size-8 p-2 bg-gray-100 rounded-md flex items-center justify-center shrink-0">
                  <ShieldCheck className="size-4 text-gray-500" />
                </div>
                <h2 className="text-gray-800 text-lg font-semibold font-figtree leading-[100%] tracking-[0%]">
                  Two-Factor Authentication
                </h2>
              </div>
              {isTfaEnabled && (
                <div className="px-2.5 py-0.5 bg-green-100 rounded-2xl flex justify-center items-center shrink-0">
                  <span className="text-center text-green-800 text-xs font-medium font-inter leading-4">
                    Enabled
                  </span>
                </div>
              )}
            </div>
            <p className="text-gray-500 text-sm font-normal font-figtree">
              Add an extra layer of security to your account
            </p>
          </div>

          {isTfaEnabled ? (
            /* State 2: TFA Enabled View */
            <>
              <div className="self-stretch rounded-xl inline-flex justify-start items-start gap-4">
                <div className="flex-1 px-3 py-2.5 bg-gray-100 rounded-[10px] outline outline-1 outline-offset-[-1px] outline-gray-200 inline-flex flex-col justify-start items-start gap-0.5">
                  <div className="justify-start text-gray-500 text-sm font-normal font-figtree leading-[100%]">
                    Status
                  </div>
                  <div className="justify-start text-gray-800 text-lg font-medium font-figtree leading-[100%]">
                    Enabled
                  </div>
                </div>
                <div className="flex-1 px-3 py-2.5 bg-gray-100 rounded-[10px] outline outline-1 outline-offset-[-1px] outline-gray-200 inline-flex flex-col justify-start items-start gap-0.5">
                  <div className="justify-start text-gray-500 text-sm font-normal font-figtree leading-[100%]">
                    Method
                  </div>
                  <div className="justify-start text-gray-800 text-lg font-medium font-figtree leading-[100%]">
                    {tfaEnabledMethod === "email"
                      ? "Email OTP"
                      : "Authenticator App"}
                  </div>
                </div>
                <div className="flex-1 px-3 py-2.5 bg-gray-100 rounded-[10px] outline outline-1 outline-offset-[-1px] outline-gray-200 inline-flex flex-col justify-start items-start gap-0.5">
                  <div className="justify-start text-gray-500 text-sm font-normal font-figtree leading-[100%]">
                    Enabled on
                  </div>
                  <div className="justify-start text-gray-800 text-lg font-medium font-figtree leading-[100%]">
                    {tfaEnabledDate || "N/A"}
                  </div>
                </div>
              </div>
              {isDisablingTfa ? (
                <div className="self-stretch flex flex-col gap-4 p-5 bg-red-50/40 border border-red-200 rounded-xl animate-in fade-in duration-200">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-gray-900 text-base font-semibold font-figtree">
                      Disable Two-Factor Authentication
                    </h3>
                    <p className="text-gray-600 text-sm font-figtree">
                      Enter the 6-digit verification code from your {tfaEnabledMethod === "email" ? "email" : "authenticator app"} to confirm disabling 2FA.
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      {disableCode.map((digit, idx) => (
                        <input
                          key={idx}
                          type="text"
                          maxLength={1}
                          value={digit}
                          ref={(el) => { disableInputRefs.current[idx] = el; }}
                          onChange={(e) => handleDisableCodeChange(idx, e.target.value)}
                          onKeyDown={(e) => handleDisableKeyDown(idx, e)}
                          onPaste={idx === 0 ? handleDisablePaste : undefined}
                          disabled={isSubmittingDisable}
                          className={cn(
                            "w-[42px] h-[42px] border text-center text-base font-bold font-figtree rounded-lg bg-white outline-none transition-all focus:border-[#0F2757] focus:ring-2 focus:ring-[#0F2757]/10 disabled:opacity-60",
                            disableError ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10" : "border-gray-300"
                          )}
                        />
                      ))}
                    </div>
                    {disableError && (
                      <span className="text-rose-600 text-xs font-medium font-figtree">
                        {disableError}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={handleConfirmDisableTfa}
                      disabled={isSubmittingDisable}
                      className="h-[40px] px-4 bg-[#DC2626] hover:bg-red-700 active:bg-red-800 text-white text-sm font-medium font-figtree rounded-[8px] flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60 shadow-sm"
                    >
                      {isSubmittingDisable ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-white" />
                          <span>Disabling...</span>
                        </>
                      ) : (
                        <span>Confirm & Disable 2FA</span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsDisablingTfa(false);
                        setDisableCode(Array(6).fill(""));
                        setDisableError("");
                      }}
                      disabled={isSubmittingDisable}
                      className="h-[40px] px-4 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium font-figtree rounded-[8px] flex items-center justify-center cursor-pointer transition-colors disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsDisablingTfa(true);
                    setDisableCode(Array(6).fill(""));
                    setDisableError("");
                  }}
                  className="h-[43px] px-4 py-3 bg-[#DC2626] hover:bg-red-700 text-white text-base font-medium font-figtree rounded-[10px] inline-flex justify-center items-center overflow-hidden cursor-pointer transition-colors relative top-1 -mb-2.5"
                >
                  <div className="justify-start text-white text-base font-medium font-figtree">
                    Disable 2FA
                  </div>
                </button>
              )}
            </>
          ) : (
            /* State 0: Choose Verification Method & OTP Verification */
            <>
              {!isShowingRecoveryCodes && (
                <>
                  <div className="justify-start text-gray-800 text-[19px] font-medium font-figtree leading-[100%]">
                    Choose verification method
                  </div>

                  {/* Verification Options */}
                  <div className="self-stretch flex flex-col justify-start items-start gap-3.5">
                    {/* Email OTP option */}
                    <div
                      onClick={() => {
                        setTfaMethod("email");
                        setIsConfiguringTfa(false);
                      }}
                      className={cn(
                        "self-stretch px-4 py-3.5 rounded-[10px] outline outline-1 outline-offset-[-1px] inline-flex justify-start items-center gap-4 cursor-pointer transition-all",
                        tfaMethod === "email"
                          ? "outline-blue-950 bg-blue-50/20"
                          : "outline-gray-300 hover:bg-gray-50/50"
                      )}
                    >
                      <div
                        className={cn(
                          "size-4 relative rounded-full overflow-hidden flex items-center justify-center border shrink-0",
                          tfaMethod === "email"
                            ? "bg-[#0F2757] border-[#0F2757]"
                            : "bg-white border-gray-300"
                        )}
                      >
                        {tfaMethod === "email" && (
                          <div className="size-1.5 bg-white rounded-full"></div>
                        )}
                      </div>
                      <div className="flex justify-start items-center gap-2.5">
                        <Mail className="size-5 text-gray-800 shrink-0" />
                        <div className="inline-flex flex-col justify-start items-start gap-1">
                          <span className="justify-start text-gray-800 text-base font-medium font-figtree">
                            Email OTP
                          </span>
                          <span className="justify-start text-gray-500 text-sm font-normal font-figtree leading-[100%]">
                            Receive a 6-digit code at {email}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Authenticator App option */}
                    <div
                      onClick={() => {
                        setTfaMethod("authenticator");
                        setIsConfiguringTfa(false);
                      }}
                      className={cn(
                        "h-[70px] self-stretch px-4 py-3.5 rounded-[10px] outline outline-1 outline-offset-[-1px] inline-flex justify-start items-center gap-4 cursor-pointer transition-all",
                        tfaMethod === "authenticator"
                          ? "outline-blue-950 bg-blue-50/20"
                          : "outline-gray-300 hover:bg-gray-50/50"
                      )}
                    >
                      <div
                        className={cn(
                          "size-4 relative rounded-full overflow-hidden flex items-center justify-center border shrink-0",
                          tfaMethod === "authenticator"
                            ? "bg-[#0F2757] border-[#0F2757]"
                            : "bg-white border-gray-300"
                        )}
                      >
                        {tfaMethod === "authenticator" && (
                          <div className="size-1.5 bg-white rounded-full"></div>
                        )}
                      </div>
                      <div className="flex justify-start items-center gap-2.5">
                        <Smartphone className="size-5 text-gray-800 shrink-0" />
                        <div className="inline-flex flex-col justify-start items-start gap-1">
                          <span className="justify-start text-gray-800 text-base font-medium font-figtree leading-[100%]">
                            Authenticator App
                          </span>
                          <span className="justify-start text-gray-500 text-sm font-normal font-figtree">
                            Use Google Authenticator, Authy, Microsoft Authenticator, or 1Password
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Send OTP button */}
                  {!isConfiguringTfa && (
                    <div className="self-stretch flex flex-col items-start gap-6 mt-1">
                      <div className="self-stretch h-px bg-gray-200"></div>
                      <button
                        onClick={handleSendOtp}
                        disabled={isGeneratingSetup}
                        className="h-[43px] px-4 py-3 bg-[#0F2757] hover:bg-[#162259] active:bg-[#091a3c] active:scale-[0.98] text-white text-base font-medium font-figtree rounded-[10px] inline-flex justify-center items-center overflow-hidden cursor-pointer transition-all relative top-0.5 disabled:opacity-75 disabled:cursor-default shadow-lg shadow-[#0F2757]/10"
                      >
                        {isGeneratingSetup ? (
                          <span className="flex items-center gap-2">
                            <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            {tfaMethod === "email" ? "Sending..." : "Generating..."}
                          </span>
                        ) : (
                          tfaMethod === "email" ? "Send OTP" : "Generate Setup"
                        )}
                      </button>
                    </div>
                  )}
                </>
              )}

              {/* Conditional Verification Setup Sections */}
              {isConfiguringTfa && (
                <TfaVerification
                  tfaMethod={tfaMethod}
                  email={email}
                  onCompleteSetup={handleCompleteSetup}
                  onCancel={handleCancelTfa}
                  showToast={(msg, type) => {
                    if (type === "warning" || type === "info") {
                      toast.info(msg);
                    } else if (type === "success") {
                      toast.success(msg);
                    }
                  }}
                  isShowingRecoveryCodes={isShowingRecoveryCodes}
                  setIsShowingRecoveryCodes={setIsShowingRecoveryCodes}
                  manualEntryKey={tfaSetupData?.manualEntryKey}
                  qrCodeDataUrl={tfaSetupData?.qrCodeDataUrl}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function IntegrationsTab() {
  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 font-figtree">Integrations</h2>
        <p className="text-sm text-gray-500 mt-0.5">Connect third-party services to enhance your portal</p>

        <div className="bg-white border border-gray-200 rounded-xl p-6 mt-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="size-10 bg-gray-50 border border-gray-200 rounded-lg flex items-center justify-center shrink-0">
              <Mail className="h-5 w-5 text-gray-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-gray-900">Email Provider</h3>
                <span className="bg-gray-100 text-gray-500 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                  Coming Soon
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">Custom email notifications and templates</p>
            </div>
          </div>
          <button className="border border-gray-200 bg-gray-50 text-gray-500 font-medium py-2 px-4 rounded-lg cursor-not-allowed text-sm">
            Coming Soon
          </button>
        </div>

        <p className="text-sm text-gray-500 mt-6">
          Need a different integration? Contact your account manager to discuss custom integration options.
        </p>
      </div>
    </div>
  );
}
