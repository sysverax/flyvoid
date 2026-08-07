"use client";

import { useState, useEffect } from "react";
import { Save, Mail, Smartphone } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { toast } from "react-toastify";
import { InputField } from "@/src/components/ui/InputField";
import { TfaVerification } from "@/src/components/profile/TfaVerification";
import { authService } from "@/src/services/auth.service";

export default function AdminProfilePage() {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [tfaMethod, setTfaMethod] = useState<"email" | "authenticator">(
    "email",
  );
  const [isConfiguringTfa, setIsConfiguringTfa] = useState(false);
  const [isGeneratingSetup, setIsGeneratingSetup] = useState(false);
  const [tfaSetupData, setTfaSetupData] = useState<{
    manualEntryKey: string;
    qrCodeDataUrl: string;
  } | null>(null);

  // TFA State Machine states
  const [isTfaEnabled, setIsTfaEnabled] = useState(false);
  const [tfaEnabledMethod, setTfaEnabledMethod] = useState<
    "email" | "authenticator"
  >("email");
  const [tfaEnabledDate, setTfaEnabledDate] = useState("");
  const [isShowingRecoveryCodes, setIsShowingRecoveryCodes] = useState(false);

  useEffect(() => {
    const user = authService.getCurrentUser();
    if (user?.email) {
      setEmail(user.email);
      const parts = user.email.split("@")[0].split(/[._-]/);
      setFullName(parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(" "));

      const enabled = sessionStorage.getItem(`tfa_enabled_${user.email}`) === "true";
      const method = sessionStorage.getItem(`tfa_method_${user.email}`) as "email" | "authenticator";
      const date = sessionStorage.getItem(`tfa_date_${user.email}`);

      setTimeout(() => {
        if (enabled) {
          setIsTfaEnabled(true);
        }
        if (method) {
          setTfaEnabledMethod(method);
        }
        if (date) {
          setTfaEnabledDate(date);
        }
      }, 0);
    }
  }, []);

  const handleCancelTfa = () => {
    setIsConfiguringTfa(false);
    setIsShowingRecoveryCodes(false);
    setTfaSetupData(null);
  };

  const handleCompleteSetup = () => {
    setIsTfaEnabled(true);
    setTfaEnabledMethod(tfaMethod);
    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = today.getFullYear();
    const dateStr = `${day}/${month}/${year}`;
    setTfaEnabledDate(dateStr);
    setIsShowingRecoveryCodes(false);
    setIsConfiguringTfa(false);

    const user = authService.getCurrentUser();
    if (user?.email) {
      sessionStorage.setItem(`tfa_enabled_${user.email}`, "true");
      sessionStorage.setItem(`tfa_method_${user.email}`, tfaMethod);
      sessionStorage.setItem(`tfa_date_${user.email}`, dateStr);
    }
  };

  const handleDisableTfa = async () => {
    const code = window.prompt("Enter your 6-digit verification code to disable Two-Factor Authentication:");
    if (code === null) return; // User cancelled
    if (code.length < 6 || isNaN(Number(code))) {
      showToast("Please enter a valid 6-digit code.", "warning");
      return;
    }

    try {
      const result = await authService.disableTfa(code);
      setIsTfaEnabled(false);
      setIsConfiguringTfa(false);
      setIsShowingRecoveryCodes(false);

      const user = authService.getCurrentUser();
      if (user?.email) {
        sessionStorage.removeItem(`tfa_enabled_${user.email}`);
        sessionStorage.removeItem(`tfa_method_${user.email}`);
        sessionStorage.removeItem(`tfa_date_${user.email}`);
      }

      showToast(result.message, "success");
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Failed to disable 2FA.";
      showToast(errorMsg, "warning");
    }
  };

  const showToast = (
    message: string,
    type: "success" | "warning" | "info" = "success",
  ) => {
    if (type === "success") {
      toast.success(message);
    } else if (type === "warning") {
      toast.error(message);
    } else {
      toast(message);
    }
  };

  const handleSaveChanges = () => {
    if (!fullName.trim()) {
      showToast("Full name cannot be empty.", "warning");
      return;
    }
    showToast("Profile changes saved successfully!", "success");
  };

  const handleChangePassword = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showToast("Please fill in all password fields.", "warning");
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast("New password and confirm password do not match.", "warning");
      return;
    }
    if (newPassword.length < 8) {
      showToast("New password must be at least 8 characters long.", "warning");
      return;
    }
    showToast("Password updated successfully!", "success");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
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
        showToast(result.message, "success");
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : "Failed to generate Authenticator QR code.";
        showToast(errorMsg, "warning");
      } finally {
        setIsGeneratingSetup(false);
      }
    } else {
      setIsConfiguringTfa(true);
      showToast(`Verification OTP sent successfully to ${email}!`, "success");
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      {/* Header section */}
      <div className="mb-7 flex flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-[24px] font-semibold text-[#1F2937] leading-[100%] tracking-[0%]">
            Admin Profile
          </h1>
          <p className="text-[14px] text-[#6B7280] mt-1">
            Manage your account settings and preferences
          </p>
        </div>
        <button
          onClick={handleSaveChanges}
          className="group flex h-[50px] items-center justify-center gap-2 rounded-[10px] bg-primary px-4 py-[9px] text-[16px] font-medium text-white transition-colors duration-200 hover:bg-primary-hover cursor-pointer relative -top-0.5"
        >
          <Save className="h-5 w-5" />
          <span>Save Changes</span>
        </button>
      </div>

      {/* Profile Form Cards Grid */}
      <div className="space-y-6">
        {/* Top Grid Column */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: Personal Information */}
          <div className="w-full px-6 pb-8 pt-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-5">
            {/* Card Header */}
            <div className="self-stretch flex justify-between items-center">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  {/* Icon */}
                  <div className="size-8 p-2 bg-gray-100 rounded-md flex items-center justify-center shrink-0">
                    <img
                      src="/icons/user1.svg"
                      alt="user"
                      className="size-4 placeholder:text-gray-400"
                    />
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

            {/* Form Fields */}
            <div className="self-stretch flex flex-col justify-start items-start gap-5">
              {/* Full Name */}
              <InputField
                label="Full Name"
                value={fullName}
                onChange={setFullName}
                placeholder="Full Name"
              />

              {/* Email Address */}
              <InputField
                label="Email Address"
                value={email}
                disabled
                placeholder="email@example.com"
                helperText="Email cannot be changed. Contact support if needed."
              />

              {/* Role */}
              <div className="self-stretch min-h-16 flex flex-col gap-2 w-full">
                <label className="text-gray-800 text-base font-medium font-figtree leading-[100%] tracking-[0%]">
                  Role
                </label>
                <div className="self-stretch h-[41px] px-4 pt-4 pb-3 bg-gray-100 rounded-[10px] outline outline-1 outline-offset-[-1px] outline-gray-300 flex items-center gap-2 overflow-hidden select-none w-full">
                  {/* Icon */}
                  <img
                    src="/icons/secure.svg"
                    alt="role"
                    className="size-5 shrink-0"
                  />

                  <span className="text-gray-800 text-base font-medium font-figtree">
                    Platform Admin
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Password & Security */}
          <div className="w-full px-6 pb-8 pt-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-5">
            {/* Card Header */}
            <div className="self-stretch flex justify-between items-center">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1.5">
                  {/* Icon */}
                  <div className="size-8 p-2 bg-gray-100 rounded-md flex items-center justify-center shrink-0">
                    <img
                      src="/icons/lock.svg"
                      alt="security"
                      className="size-4"
                    />
                  </div>
                  <h2 className="text-gray-800 text-lg font-semibold font-figtree leading-[100%] tracking-[0%]">
                    Password & Security
                  </h2>
                </div>

                <p className="text-gray-500 text-sm font-normal font-figtree">
                  Manage your account security
                </p>
              </div>
              {/* hidden spacer button for figma layout balance */}
              <div className="hidden sm:block opacity-0 select-none pointer-events-none">
                <div className="px-4 py-3 bg-blue-950 rounded-[10px] text-white text-base font-medium">
                  Change Password
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="self-stretch flex flex-col justify-start items-start gap-5.5">
              {/* Current Password */}
              <InputField
                label="Current Password"
                type="password"
                value={currentPassword}
                onChange={setCurrentPassword}
                placeholder="••••••••••••"
              />

              {/* New Password */}
              <InputField
                label="New Password"
                type="password"
                value={newPassword}
                onChange={setNewPassword}
                placeholder="••••••••••••"
              />

              {/* Confirm New Password */}
              <InputField
                label="Confirm New Password"
                type="password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                placeholder="••••••••••••"
              />
            </div>

            {/* Change Password Button */}
            <button
              onClick={handleChangePassword}
              className="self-stretch h-11 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-base font-medium font-figtree rounded-[10px] border border-gray-300 inline-flex justify-center items-center cursor-pointer transition-colors"
            >
              Change Password
            </button>
          </div>
        </div>

        {/* Card 3: Two-Factor Authentication */}
        <div className="w-full p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-6 relative -top-1.5">
          {/* Card Header */}
          <div className="self-stretch flex flex-col justify-start items-start gap-1.5">
            <div className="inline-flex justify-start items-center gap-2.5">
              <div className="flex justify-start items-center gap-1.5">
                {/* Icon */}
                <div className="size-8 p-2 bg-gray-100 rounded-md flex items-center justify-center shrink-0">
                  <img
                    src="/icons/sheild.svg"
                    alt="secure"
                    className="size-4 placeholder:text-gray-400"
                  />
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
                    {tfaEnabledDate}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDisableTfa}
                className="h-[43px] px-4 py-3 bg-[#DC2626] hover:bg-red-700 text-white text-base font-medium font-figtree rounded-[10px] inline-flex justify-center items-center overflow-hidden cursor-pointer transition-colors relative top-1 -mb-2.5"
              >
                <div className="justify-start text-white text-base font-medium font-figtree">
                  Disable 2FA
                </div>
              </button>
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
                          : "outline-gray-300 hover:bg-gray-50/50",
                      )}
                    >
                      <div
                        className={cn(
                          "size-4 relative rounded-full overflow-hidden flex items-center justify-center border shrink-0",
                          tfaMethod === "email"
                            ? "bg-blue-950 border-blue-950"
                            : "bg-white border-gray-300",
                        )}
                      >
                        {tfaMethod === "email" && (
                          <div className="size-1.5 bg-white rounded-full"></div>
                        )}
                      </div>
                      <div className="flex justify-start items-center gap-2.5">
                        <Mail className="size-5 text-gray-800 shrink-0 " />
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
                          : "outline-gray-300 hover:bg-gray-50/50",
                      )}
                    >
                      <div
                        className={cn(
                          "size-4 relative rounded-full overflow-hidden flex items-center justify-center border shrink-0",
                          tfaMethod === "authenticator"
                            ? "bg-blue-950 border-blue-950"
                            : "bg-white border-gray-300",
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
                            Use Google Authenticator, Authy, Microsoft
                            Authenticator, or 1Password
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Send OTP button */}
                  {!isConfiguringTfa && (
                    <div className="self-stretch flex flex-col items-start gap-6">
                      <div className="self-stretch h-px bg-gray-200"></div>
                      <button
                        onClick={handleSendOtp}
                        disabled={isGeneratingSetup}
                        className="h-[43px] px-4 py-3 bg-primary hover:bg-[#1a3465] active:bg-[#091a3c] active:scale-[0.98] text-white text-base font-medium font-figtree rounded-[10px] inline-flex justify-center items-center overflow-hidden cursor-pointer transition-all relative top-0.5 disabled:opacity-75 disabled:cursor-default shadow-lg shadow-[#0F2757]/10"
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
                  showToast={showToast}
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
