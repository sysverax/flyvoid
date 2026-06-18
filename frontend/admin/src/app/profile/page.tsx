"use client";

import { useState } from "react";
import { Save, Mail, Smartphone } from "lucide-react";
import { Toast } from "@/src/types/common";
import { ToastList } from "@/src/components/ui/ToastList";
import { cn } from "@/src/lib/utils";
import { InputField } from "@/src/components/ui/InputField";
import { TfaVerification } from "@/src/components/profile/TfaVerification";

export default function AdminProfilePage() {
  const [fullName, setFullName] = useState("John Smith");
  const [email] = useState("john@flyvoid.com");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [tfaMethod, setTfaMethod] = useState<"email" | "authenticator">(
    "email",
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [isConfiguringTfa, setIsConfiguringTfa] = useState(false);

  // TFA State Machine states
  const [isTfaEnabled, setIsTfaEnabled] = useState(false);
  const [tfaEnabledMethod, setTfaEnabledMethod] = useState<
    "email" | "authenticator"
  >("email");
  const [tfaEnabledDate, setTfaEnabledDate] = useState("");
  const [isShowingRecoveryCodes, setIsShowingRecoveryCodes] = useState(false);

  const handleCancelTfa = () => {
    setIsConfiguringTfa(false);
    setIsShowingRecoveryCodes(false);
  };

  const handleCompleteSetup = () => {
    setIsTfaEnabled(true);
    setTfaEnabledMethod(tfaMethod);
    const today = new Date();
    const day = String(today.getDate()).padStart(2, "0");
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const year = today.getFullYear();
    setTfaEnabledDate(`${day}/${month}/${year}`);
    setIsShowingRecoveryCodes(false);
    setIsConfiguringTfa(false);
    showToast("Two-Factor Authentication enabled successfully!", "success");
  };

  const handleDisableTfa = () => {
    setIsTfaEnabled(false);
    setIsConfiguringTfa(false);
    setIsShowingRecoveryCodes(false);
    showToast("Two-Factor Authentication disabled.", "info");
  };

  const showToast = (
    message: string,
    type: "success" | "warning" | "info" = "success",
  ) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      3000,
    );
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

  const handleSendOtp = () => {
    setIsConfiguringTfa(true);
    if (tfaMethod === "email") {
      showToast(`Verification OTP sent successfully to ${email}!`, "success");
    } else {
      showToast("Authenticator QR code generated successfully.", "success");
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
                        className="h-[43px] px-4 py-3 bg-blue-950 hover:bg-primary-hover text-white text-base font-medium font-figtree rounded-[10px] inline-flex justify-center items-center overflow-hidden cursor-pointer transition-colors relative top-0.5"
                      >
                        {tfaMethod === "email" ? "Send OTP" : "Generate Setup"}
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
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Global Toast stack */}
      <ToastList toasts={toasts} />
    </div>
  );
}
