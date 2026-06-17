"use client";

import { useState } from "react";
import { Save, User, Lock, Mail, Smartphone, Eye, EyeOff } from "lucide-react";
import { Toast } from "@/src/types/common";
import { ToastList } from "@/src/components/ui/ToastList";
import { cn } from "@/src/lib/utils";

export default function AdminProfilePage() {
  const [fullName, setFullName] = useState("John Smith");
  const [email] = useState("john@flyvoid.com");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [tfaMethod, setTfaMethod] = useState<"email" | "authenticator">("email");
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Password visibility states
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const showToast = (message: string, type: "success" | "warning" | "info" = "success") => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(
      () => setToasts((prev) => prev.filter((t) => t.id !== id)),
      3000
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
    if (tfaMethod === "email") {
      showToast(`Verification OTP sent successfully to ${email}!`, "success");
    } else {
      showToast("Authenticator App setup screen opened.", "info");
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
          className="group flex h-[44px] items-center justify-center gap-2 rounded-[10px] bg-primary px-4 py-[9px] text-[16px] font-medium text-white transition-colors duration-200 hover:bg-primary-hover cursor-pointer shadow-sm"
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
          <div className="w-full p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-5 shadow-[0px_2px_4px_0px_rgba(0,0,0,0.08)]">
            
            {/* Card Header */}
            <div className="flex flex-col justify-start items-start gap-1.5">
              <div className="inline-flex justify-start items-center gap-1.5">
                <div className="size-8 p-2.5 bg-gray-100 rounded-md flex justify-center items-center gap-2.5 shrink-0">
                  <User className="size-5 text-blue-950 stroke-[1.8]" />
                </div>
                <h2 className="justify-start text-gray-800 text-lg font-semibold font-figtree">Personal Information</h2>
              </div>
              <p className="justify-start text-gray-500 text-sm font-normal font-figtree">Your basic account details</p>
            </div>

            {/* Form Fields */}
            <div className="self-stretch flex flex-col justify-start items-start gap-5">
              
              {/* Full Name */}
              <div className="self-stretch flex flex-col justify-start items-start gap-2">
                <label className="justify-start text-gray-800 text-base font-medium font-figtree">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="self-stretch px-4 py-3 bg-gray-100 rounded-[10px] border border-gray-300 text-gray-800 text-base font-normal font-figtree focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  placeholder="Full Name"
                />
              </div>

              {/* Email Address */}
              <div className="self-stretch flex flex-col justify-start items-start gap-1.5">
                <div className="self-stretch flex flex-col justify-start items-start gap-2">
                  <label className="justify-start text-gray-800 text-base font-medium font-figtree">Email Address</label>
                  <input
                    type="email"
                    value={email}
                    disabled
                    className="self-stretch px-4 py-3 bg-gray-100 rounded-[10px] border border-gray-300 text-gray-500 text-base font-normal font-figtree cursor-not-allowed select-none"
                    placeholder="email@example.com"
                  />
                </div>
                <p className="justify-start text-gray-500 text-xs font-normal font-figtree">
                  Email cannot be changed. Contact support if needed.
                </p>
              </div>

              {/* Role */}
              <div className="self-stretch flex flex-col justify-start items-start gap-2">
                <label className="justify-start text-gray-800 text-base font-medium font-figtree">Role</label>
                <div className="self-stretch px-4 py-3 bg-gray-100 rounded-[10px] border border-gray-300 inline-flex justify-start items-center gap-2 overflow-hidden select-none">
                  <Lock className="size-5 text-gray-800" />
                  <span className="text-gray-800 text-base font-medium font-figtree">Platform Admin</span>
                </div>
              </div>

            </div>
          </div>

          {/* Card 2: Password & Security */}
          <div className="w-full p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-5 shadow-[0px_2px_4px_0px_rgba(0,0,0,0.08)]">
            
            {/* Card Header */}
            <div className="self-stretch inline-flex justify-between items-center">
              <div className="flex flex-col justify-start items-start gap-1.5">
                <div className="inline-flex justify-start items-center gap-1.5">
                  <div className="size-8 p-2.5 bg-gray-100 rounded-md flex justify-center items-center gap-2.5 shrink-0">
                    <Lock className="size-5 text-blue-950 stroke-[1.8]" />
                  </div>
                  <h2 className="justify-start text-gray-800 text-lg font-semibold font-figtree">Password & Security</h2>
                </div>
                <p className="justify-start text-gray-500 text-sm font-normal font-figtree">Manage your account security</p>
              </div>
              {/* hidden spacer button for figma layout balance */}
              <div className="hidden sm:block opacity-0 select-none pointer-events-none">
                <div className="px-4 py-3 bg-blue-950 rounded-[10px] text-white text-base font-medium">Change Password</div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="self-stretch flex flex-col justify-start items-start gap-5">
              
              {/* Current Password */}
              <div className="self-stretch flex flex-col justify-start items-start gap-2">
                <label className="justify-start text-gray-800 text-base font-medium font-figtree">Current Password</label>
                <div className="self-stretch relative flex items-center">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="self-stretch flex-1 px-4 py-3 bg-gray-100 rounded-[10px] border border-gray-300 text-gray-800 text-base font-normal font-figtree focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-4 text-gray-500 hover:text-gray-800 cursor-pointer"
                  >
                    {showCurrentPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div className="self-stretch flex flex-col justify-start items-start gap-2">
                <label className="justify-start text-gray-800 text-base font-medium font-figtree">New Password</label>
                <div className="self-stretch relative flex items-center">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="self-stretch flex-1 px-4 py-3 bg-gray-100 rounded-[10px] border border-gray-300 text-gray-800 text-base font-normal font-figtree focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 text-gray-500 hover:text-gray-800 cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="self-stretch flex flex-col justify-start items-start gap-2">
                <label className="justify-start text-gray-800 text-base font-medium font-figtree">Confirm New Password</label>
                <div className="self-stretch relative flex items-center">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="self-stretch flex-1 px-4 py-3 bg-gray-100 rounded-[10px] border border-gray-300 text-gray-800 text-base font-normal font-figtree focus:border-primary focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 text-gray-500 hover:text-gray-800 cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
              </div>

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
        <div className="w-full p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-6 shadow-[0px_2px_4px_0px_rgba(0,0,0,0.08)]">
          
          {/* Card Header */}
          <div className="flex flex-col justify-start items-start gap-1.5">
            <div className="inline-flex justify-start items-center gap-1.5">
              <div className="size-8 p-2.5 bg-gray-100 rounded-md flex justify-center items-center gap-2.5 shrink-0">
                <Lock className="size-5 text-blue-950 stroke-[1.8]" />
              </div>
              <h2 className="justify-start text-gray-800 text-lg font-semibold font-figtree">Two-Factor Authentication</h2>
            </div>
            <p className="justify-start text-gray-500 text-sm font-normal font-figtree">Add an extra layer of security to your account</p>
          </div>

          <h3 className="justify-start text-gray-800 text-base font-medium font-figtree">Choose verification method</h3>

          {/* Verification Options */}
          <div className="self-stretch flex flex-col justify-start items-start gap-3.5">
            
            {/* Email OTP option */}
            <div
              onClick={() => setTfaMethod("email")}
              className={cn(
                "self-stretch px-4 py-3.5 rounded-[10px] outline outline-1 outline-offset-[-1px] inline-flex justify-start items-center gap-4 cursor-pointer transition-all",
                tfaMethod === "email" ? "outline-blue-950 bg-blue-50/20" : "outline-gray-300 hover:bg-gray-50/50"
              )}
            >
              <div className={cn(
                "size-4 relative rounded-full overflow-hidden flex items-center justify-center border",
                tfaMethod === "email" ? "bg-blue-950 border-blue-950" : "bg-white border-gray-300"
              )}>
                {tfaMethod === "email" && <div className="size-1.5 bg-white rounded-full"></div>}
              </div>
              <div className="flex justify-start items-center gap-2.5">
                <Mail className="size-5 text-gray-800 shrink-0" />
                <div className="inline-flex flex-col justify-start items-start gap-1">
                  <span className="justify-start text-gray-800 text-base font-medium font-figtree">Email OTP</span>
                  <span className="justify-start text-gray-500 text-sm font-normal font-figtree">
                    Receive a 6-digit code at john@flyvoid.com
                  </span>
                </div>
              </div>
            </div>

            {/* Authenticator App option */}
            <div
              onClick={() => setTfaMethod("authenticator")}
              className={cn(
                "self-stretch px-4 py-3.5 rounded-[10px] outline outline-1 outline-offset-[-1px] inline-flex justify-start items-center gap-4 cursor-pointer transition-all",
                tfaMethod === "authenticator" ? "outline-blue-950 bg-blue-50/20" : "outline-gray-300 hover:bg-gray-50/50"
              )}
            >
              <div className={cn(
                "size-4 relative rounded-full overflow-hidden flex items-center justify-center border",
                tfaMethod === "authenticator" ? "bg-blue-950 border-blue-950" : "bg-white border-gray-300"
              )}>
                {tfaMethod === "authenticator" && <div className="size-1.5 bg-white rounded-full"></div>}
              </div>
              <div className="flex justify-start items-center gap-2.5">
                <Smartphone className="size-5 text-gray-800 shrink-0" />
                <div className="inline-flex flex-col justify-start items-start gap-1">
                  <span className="justify-start text-gray-800 text-base font-medium font-figtree">Authenticator App</span>
                  <span className="justify-start text-gray-500 text-sm font-normal font-figtree">
                    Use Google Authenticator, Authy, Microsoft Authenticator, or 1Password
                  </span>
                </div>
              </div>
            </div>

          </div>

          <div className="self-stretch h-px bg-gray-200"></div>

          {/* Send OTP button */}
          <button
            onClick={handleSendOtp}
            className="px-4 py-3 bg-blue-950 hover:bg-blue-900 text-white text-base font-medium font-figtree rounded-[10px] inline-flex justify-center items-center overflow-hidden cursor-pointer transition-colors shadow-sm"
          >
            {tfaMethod === "email" ? "Send OTP" : "Configure Authenticator"}
          </button>
        </div>

      </div>

      {/* Global Toast stack */}
      <ToastList toasts={toasts} />
    </div>
  );
}
