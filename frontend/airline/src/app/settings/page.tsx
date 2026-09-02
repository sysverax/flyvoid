"use client";

import { useState } from "react";
import { Header } from "@/src/components/layout/Header";
import { User, Bell, Globe, Lock, Plug, Building2, Plane, Mail, ShieldCheck, Smartphone, Check, Eye, EyeOff, Info, Save } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { InputField } from "@/src/components/ui/InputField";
import { toast } from "react-toastify";
import { TfaVerification } from "@/src/components/profile/TfaVerification";

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "preferences", label: "Preferences", icon: Globe },
  { id: "security", label: "Security", icon: Lock },
  { id: "integrations", label: "Integrations", icon: Plug },
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
        <button className="group flex h-[50px] items-center justify-center gap-2 rounded-[10px] bg-[#0F2757] px-4 py-[9px] text-[16px] font-medium text-white transition-colors duration-200 hover:bg-[#162259] cursor-pointer relative -top-0.5">
          <Save className="h-5 w-5" />
          <span>Save Changes</span>
        </button>
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
        {activeTab === "notifications" && <NotificationsTab />}
        {activeTab === "preferences" && <PreferencesTab />}
        {activeTab === "security" && <SecurityTab />}
        {activeTab === "integrations" && <IntegrationsTab />}
      </div>
    </div>
  );
}

function ProfileTab() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
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
            <InputField label="Airline Name" value="SkyWays Airlines" disabled />
            <InputField label="IATA Code" value="SW" disabled />
            <InputField label="Primary Contact" value="admin@skyways.com" disabled />
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
            <InputField label="First Name" value="John" />
            <InputField label="Last Name" value="Mitchell" />
            <InputField label="Email Address" value="admin@skyways.com" disabled helperText="Email cannot be changed. Contact support if needed." />
          </div>
        </div>
      </div>
    </div>
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
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
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
  const [tfaMethod, setTfaMethod] = useState<"email" | "authenticator">("email");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // 2FA state
  const [isConfiguringTfa, setIsConfiguringTfa] = useState(false);
  const [isShowingRecoveryCodes, setIsShowingRecoveryCodes] = useState(false);
  const [isGeneratingSetup, setIsGeneratingSetup] = useState(false);
  const [isTfaEnabled, setIsTfaEnabled] = useState(false);
  const [tfaEnabledMethod, setTfaEnabledMethod] = useState<"email" | "authenticator">("email");
  const [tfaEnabledDate, setTfaEnabledDate] = useState("15/01/2024");

  const email = "admin@skyways.com";

  const handleSendOtp = () => {
    setIsGeneratingSetup(true);
    setTimeout(() => {
      setIsGeneratingSetup(false);
      setIsConfiguringTfa(true);
      if (tfaMethod === "email") {
        toast.success(`OTP sent to ${email}`);
      } else {
        toast.success("Authenticator setup generated");
      }
    }, 1000);
  };

  const handleCancelTfa = () => {
    setIsConfiguringTfa(false);
    setIsShowingRecoveryCodes(false);
  };

  const handleCompleteSetup = () => {
    setIsTfaEnabled(true);
    setTfaEnabledMethod(tfaMethod);
    const today = new Date();
    setTfaEnabledDate(`${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`);
    setIsConfiguringTfa(false);
    setIsShowingRecoveryCodes(false);
    if (tfaMethod === "email") {
      toast.success("Two-Factor Authentication has been successfully enabled.");
    }
  };

  const handleDisableTfa = () => {
    const code = window.prompt("Enter your 6-digit verification code to disable Two-Factor Authentication:");
    if (!code || code.length !== 6 || !/^\d+$/.test(code)) {
      if (code !== null) toast.error("Invalid verification code. Disable action cancelled.");
      return;
    }
    setIsTfaEnabled(false);
    toast.success("Two-Factor Authentication disabled.");
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 font-figtree">Security</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage your account security</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4 items-start">
          <div className="w-full p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-5">
            <h3 className="text-sm font-semibold text-gray-900">Update Password</h3>
            
            <div className="self-stretch flex flex-col gap-4 w-full">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Current Password</label>
                <div className="relative">
                  <input 
                    type={showCurrent ? "text" : "password"} 
                    placeholder="Enter current password"
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2757]/20 focus:border-[#0F2757] transition-all pr-10"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">New Password</label>
                <div className="relative">
                  <input 
                    type={showNew ? "text" : "password"} 
                    placeholder="Enter new password"
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2757]/20 focus:border-[#0F2757] transition-all pr-10"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowNew(!showNew)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Confirm New Password</label>
                <div className="relative">
                  <input 
                    type={showConfirm ? "text" : "password"} 
                    placeholder="Confirm new password"
                    className="w-full bg-white border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#0F2757]/20 focus:border-[#0F2757] transition-all pr-10"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button className="bg-[#0F2757] hover:bg-[#162259] active:scale-[0.98] transition-all text-white font-medium py-2.5 px-6 rounded-lg cursor-pointer text-sm">
                  Update Password
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full p-6 bg-white rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-200 flex flex-col justify-start items-start gap-6 mt-6">
            {/* Card Header */}
            <div className="self-stretch flex flex-col justify-start items-start gap-1.5">
              <div className="inline-flex justify-start items-center gap-2.5">
                <div className="flex justify-start items-center gap-1.5">
                  {/* Icon */}
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
