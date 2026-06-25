"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { authService } from "@/src/services/auth.service";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = "Email address is required";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = "Please enter a valid email address";
    }

    if (!password) {
      newErrors.password = "Password is required";
    } else if (password.length < 6) {
      newErrors.password = "Password must be at least 6 characters";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsLoading(true);

    // Simulate logging in the user and redirecting directly to the home dashboard
    setTimeout(() => {
      setIsLoading(false);
      authService.login(email, password);
      router.push("/");
    }, 1500);
  };


  return (
    <div className="w-full lg:w-[480px] flex flex-col items-center justify-center min-h-screen px-4">
      {/* Top Header Logo Block */}
      <div className="flex flex-col items-center mb-8 text-center select-none animate-fadeIn ">
        {/* Rounded Blue Square Logo Box */}
        <div className="w-16 h-16 bg-primary rounded-[12px] flex items-center justify-center mb-6">
          <img
            src="/icons/plane1.svg"
            alt="FlyVoid Logo"
            className="h-8 w-8"
          />
        </div>
        <h1 className="text-gray-800 text-[24px] font-bold leading-[100%] py-1">
          FlyVoid Admin
        </h1>
        <p className="text-gray-500 text-[14px] font-normal mt-1 font-figtree">
          Disruption Hotel Allocation Platform
        </p>
      </div>

      {/* The White Card Container */}
      <div className="w-full bg-white rounded-[16px] border border-gray-200 p-6 sm:p-8 flex flex-col gap-6 animate-fadeIn">
        {/* Welcome titles */}
        <div className="flex flex-col gap-1">
          <h2 className="text-gray-800 text-lg font-semibold font-figtree leading-tight">
            Welcome back
          </h2>
          <p className="text-gray-500 text-sm font-normal font-figtree leading-tight">
            Sign in to your account to continue
          </p>
        </div>

        <form onSubmit={handleSignIn} className="flex flex-col gap-5">
          {/* Email input field */}
          <div className="flex flex-col gap-2">
            <label className="text-gray-800 text-base font-semibold font-figtree leading-tight">
              Email Address
            </label>
            <div className={cn(
              "relative h-[47px] w-full rounded-[6px] border bg-[#F9FAFB] transition-all flex items-center px-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0F2757]/10",
              errors.email ? "border-rose-300 focus-within:ring-rose-500/10 focus-within:border-rose-400" : "border-gray-200 focus-within:border-[#0F2757]"
            )}>
              <Mail className={cn("w-4 h-4 text-gray-500 shrink-0 transition-colors", errors.email ? "text-rose-400" : "text-gray-400")} />
              <input
                type="email"
                placeholder="you@flyvoid.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
                }}
                disabled={isLoading}
                className="w-full h-full bg-transparent pl-[13px] pr-2 outline-none text-gray-800 font-figtree text-[16px] placeholder-gray-500"
              />
            </div>
            {errors.email && (
              <span className="text-rose-500 text-xs font-medium font-figtree mt-0.5 pl-1">
                {errors.email}
              </span>
            )}
          </div>

          {/* Password input field */}
          <div className="flex flex-col gap-2">
            <label className="text-gray-800 text-base font-semibold font-figtree leading-tight">
              Password
            </label>
            <div className={cn(
              "relative h-[47px] w-full rounded-[6px] border bg-[#F9FAFB] transition-all flex items-center px-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0F2757]/10",
              errors.password ? "border-rose-300 focus-within:ring-rose-500/10 focus-within:border-rose-400" : "border-gray-200 focus-within:border-[#0F2757]"
            )}>
              <Lock className={cn("w-4 h-4 text-gray-500 shrink-0 transition-colors", errors.password ? "text-rose-400" : "text-gray-400")} />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                }}
                disabled={isLoading}
                className="w-full h-full bg-transparent pl-[13px] pr-2 outline-none text-gray-800 font-figtree text-[16px]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {errors.password && (
              <span className="text-rose-500 text-xs font-medium font-figtree mt-0.5 pl-1">
                {errors.password}
              </span>
            )}
          </div>

          {/* Forgot password section */}
          <div className="flex justify-end mt-[1px] mb-2">
            <button
              type="button"
              onClick={() => router.push("/forgot-password")}
              className="text-primary text-sm font-semibold hover:underline cursor-pointer font-figtree leading-tight"
            >
              Forgot password?
            </button>
          </div>

          {/* Sign in Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-[48px] rounded-[10px] bg-primary hover:bg-[#1a3465] active:bg-[#091a3c] text-white text-lg transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-[#0F2757]/10 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed font-figtree -translate-y-0.5"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign in</span>
            )}
          </button>
        </form>
      </div>

      {/* Footer Security Badge */}
      <div className="mt-6 flex items-center gap-1.5 text-gray-400 select-none animate-fadeIn">
        <img src={"/icons/sheild1.svg"} alt="lock" className="w-4 h-4 text-gray-400 relative bottom-[2px]" />
        <span className="text-[13px] font-normal font-figtree">
          Protected by enterprise-grade security
        </span>
      </div>
    </div>
  );
}
