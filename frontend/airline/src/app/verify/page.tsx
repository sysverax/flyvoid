"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { authService } from "@/src/services/auth.service";
import { toast } from "react-toastify";

type Step = "reset" | "success";

export default function VerifyPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("reset");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});
  const [touched, setTouched] = useState<{
    newPassword?: boolean;
    confirmPassword?: boolean;
  }>({});

  const [resetPasswordToken, setResetPasswordToken] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const token = sessionStorage.getItem("reset_password_token");
      if (token) {
        setResetPasswordToken(token);
      } else {
        toast.error("Invalid or expired session. Please sign in again.");
        router.push("/login");
      }
    }
  }, [router]);

  const validatePassword = (value: string): string => {
    if (!value) return "Password is required";
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

  const validateConfirmPassword = (confirmVal: string, passwordVal: string): string => {
    if (!confirmVal) return "Please confirm your password";
    if (confirmVal !== passwordVal) return "Passwords do not match";
    return "";
  };

  const handleNewPasswordChange = (val: string) => {
    setNewPassword(val);
    if (touched.newPassword) {
      setErrors((prev) => ({
        ...prev,
        password: validatePassword(val) || undefined,
      }));
    }
    if (touched.confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: validateConfirmPassword(confirmPassword, val) || undefined,
      }));
    }
  };

  const handleNewPasswordBlur = () => {
    setTouched((prev) => ({ ...prev, newPassword: true }));
    setErrors((prev) => ({
      ...prev,
      password: validatePassword(newPassword) || undefined,
    }));
  };

  const handleConfirmPasswordChange = (val: string) => {
    setConfirmPassword(val);
    if (touched.confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: validateConfirmPassword(val, newPassword) || undefined,
      }));
    }
  };

  const handleConfirmPasswordBlur = () => {
    setTouched((prev) => ({ ...prev, confirmPassword: true }));
    setErrors((prev) => ({
      ...prev,
      confirmPassword: validateConfirmPassword(confirmPassword, newPassword) || undefined,
    }));
  };

  const handlePasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ newPassword: true, confirmPassword: true });

    const passwordErr = validatePassword(newPassword);
    const confirmPasswordErr = validateConfirmPassword(confirmPassword, newPassword);

    if (passwordErr || confirmPasswordErr) {
      setErrors({
        password: passwordErr || undefined,
        confirmPassword: confirmPasswordErr || undefined,
      });
      return;
    }

    setIsLoading(true);

    try {
      const msg = await authService.resetInitialPassword(resetPasswordToken, newPassword);
      toast.success(msg);
      sessionStorage.removeItem("reset_password_token");
      setStep("success");
    } catch (err: any) {
      toast.error(err.message || "Failed to update password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full lg:w-[480px] flex flex-col items-center justify-center min-h-screen px-4">
      {/* Top Logo */}
      <div className="flex flex-col items-center mb-8 text-center select-none animate-fadeIn">
        <div className="w-16 h-16 bg-[#0F2757] rounded-[12px] flex items-center justify-center mb-6">
          <img
            src="/icons/plane1.svg"
            alt="Airbook Logo"
            className="h-8 w-8 brightness-0 invert"
          />
        </div>
        <h1 className="text-gray-800 text-[24px] font-bold leading-[100%] py-1">
          Airline Portal
        </h1>
        <p className="text-gray-500 text-[14px] font-normal mt-1 font-figtree">
          Flight Management & Hotel Allocation
        </p>
      </div>

      {/* Main Container Card */}
      <div className="w-full bg-white rounded-[16px] border border-gray-200 p-[31px] flex flex-col gap-6 animate-fadeIn">
        
        {step === "reset" && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-[8px] flex items-center justify-center text-[#0F2757]">
                <Lock className="w-6 h-6 text-[#0F2757]" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-gray-800 text-lg font-semibold font-figtree leading-tight">
                  Set initial password
                </h2>
                <p className="text-gray-500 text-[14px] font-normal font-figtree leading-tight">
                  Choose a new secure password for your first login
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordResetSubmit} className="flex flex-col gap-5" noValidate>
              <div className="flex flex-col gap-2">
                <label className="text-gray-800 text-base font-semibold font-figtree leading-tight">
                  New Password
                </label>
                <div className={cn(
                  "relative h-[47px] w-full rounded-[6px] border bg-[#F9FAFB] transition-all flex items-center px-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0F2757]/10",
                  errors.password ? "border-red-500 focus-within:ring-red-500/10 focus-within:border-red-500" : "border-gray-200 focus-within:border-[#0F2757]"
                )}>
                  <Lock className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    value={newPassword}
                    onChange={(e) => handleNewPasswordChange(e.target.value)}
                    onBlur={handleNewPasswordBlur}
                    disabled={isLoading}
                    className="w-full h-full bg-transparent pl-[13px] pr-10 outline-none text-gray-800 font-figtree text-[16px] placeholder-gray-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full transition-colors cursor-pointer"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <span className="text-red-500 text-xs font-medium font-figtree pl-1">
                    {errors.password}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-gray-800 text-base font-semibold font-figtree leading-tight">
                  Confirm Password
                </label>
                <div className={cn(
                  "relative h-[47px] w-full rounded-[6px] border bg-[#F9FAFB] transition-all flex items-center px-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0F2757]/10",
                  errors.confirmPassword ? "border-red-500 focus-within:ring-red-500/10 focus-within:border-red-500" : "border-gray-200 focus-within:border-[#0F2757]"
                )}>
                  <Lock className="w-4 h-4 text-gray-400 shrink-0" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                    onBlur={handleConfirmPasswordBlur}
                    disabled={isLoading}
                    className="w-full h-full bg-transparent pl-[13px] pr-10 outline-none text-gray-800 font-figtree text-[16px] placeholder-gray-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-full transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <span className="text-red-500 text-xs font-medium font-figtree pl-1">
                    {errors.confirmPassword}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[48px] rounded-[10px] bg-[#0F2757] hover:bg-[#162259] active:bg-[#091a3c] text-white text-base transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-[#0F2757]/10 cursor-pointer disabled:opacity-75 disabled:cursor-default font-figtree mt-1.5"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Reset password</span>
                )}
              </button>
            </form>
          </div>
        )}

        {step === "success" && (
          <div className="flex flex-col items-center text-center gap-4 animate-fadeIn">
            <div className="w-16 h-16 bg-[#1FAD531A] rounded-full flex items-center justify-center text-[#1FAD53]">
              <img src="/icons/tick1.svg" alt="success" className="h-8 w-8" />
            </div>

            <div className="flex flex-col gap-4 mb-2.5 translate-y-0.5">
              <h2 className="text-gray-800 text-lg font-semibold font-figtree leading-tight">
                Password updated
              </h2>
              <p className="text-gray-500 text-[14px] font-normal font-figtree leading-tight">
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
            </div>

            <button
              onClick={() => router.push("/login")}
              className="w-full h-[48px] rounded-[10px] bg-[#0F2757] hover:bg-[#162259] active:bg-[#091a3c] text-white text-base font-figtree transition-colors duration-150 cursor-pointer translate-y-0.5"
            >
              Continue to login
            </button>
          </div>
        )}
      </div>

      {/* Footer Security Badge */}
      <div className="mt-7.5 flex items-center gap-1.5 text-gray-400 select-none animate-fadeIn">
        <img src={"/icons/sheild1.svg"} alt="lock" className="w-4 h-4 text-gray-400 relative bottom-[2px]" />
        <span className="text-[13px] font-normal font-figtree">
          Protected by enterprise-grade security
        </span>
      </div>
    </div>
  );
}
