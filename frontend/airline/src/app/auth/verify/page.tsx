"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, ShieldCheck, KeyRound } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { authService } from "@/src/services/auth.service";
import { toast } from "react-toastify";

type Step = "otp" | "reset" | "success";
type View = "tfa" | "recovery";

export default function VerifyPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("otp");
  const [view, setView] = useState<View>("tfa");

  // 2FA / OTP States
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [recoveryCode, setRecoveryCode] = useState("");

  // Password Reset States
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Common UI States
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{
    code?: string;
    recoveryCode?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [touched, setTouched] = useState<{
    newPassword?: boolean;
    confirmPassword?: boolean;
  }>({});

  const [resetPasswordToken, setResetPasswordToken] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const twoFactorToken = sessionStorage.getItem("two_factor_token");
      const pwdToken = sessionStorage.getItem("reset_password_token");

      if (twoFactorToken) {
        setStep("otp");
      } else if (pwdToken) {
        setStep("reset");
        setResetPasswordToken(pwdToken);
      } else {
        toast.error("Invalid or expired session. Please sign in again.");
        router.push("/auth/login");
      }
    }
  }, [router]);

  useEffect(() => {
    if (step === "otp" && view === "tfa" && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step, view]);

  // --- OTP Verification Logic ---
  const handleCodeChange = (index: number, val: string) => {
    const targetVal = val.length > 1 ? val.slice(-1) : val;
    if (/[^0-9]/.test(targetVal) && targetVal !== "") return;

    const newCode = [...code];
    newCode[index] = targetVal;
    setCode(newCode);
    setErrors((prev) => ({ ...prev, code: undefined }));

    if (targetVal !== "" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (code[index] === "" && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const newCode = [...code];
        newCode[index - 1] = "";
        setCode(newCode);
      } else {
        const newCode = [...code];
        newCode[index] = "";
        setCode(newCode);
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\s/g, "");
    if (pasteData.length === 6 && /^\d+$/.test(pasteData)) {
      const splitCode = pasteData.split("");
      setCode(splitCode);
      inputRefs.current[5]?.focus();
      setErrors((prev) => ({ ...prev, code: undefined }));
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredCode = code.join("");
    if (enteredCode.length < 6) {
      setErrors({ code: "Please enter the full 6-digit verification code" });
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const token = sessionStorage.getItem("two_factor_token") || "";
      const email = sessionStorage.getItem("two_factor_email") || "";
      const result = await authService.verifySigninTfa(token, enteredCode);

      if (email) {
        sessionStorage.setItem(`airline_tfa_enabled_${email}`, "true");
        sessionStorage.setItem(`airline_tfa_method_${email}`, "authenticator");

        const today = new Date();
        const day = String(today.getDate()).padStart(2, "0");
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const year = today.getFullYear();
        sessionStorage.setItem(`airline_tfa_date_${email}`, `${day}/${month}/${year}`);
      }

      if (result?.requiresPasswordReset) {
        setResetPasswordToken(result.resetPasswordToken || "");
        sessionStorage.setItem("reset_password_token", result.resetPasswordToken || "");
        sessionStorage.removeItem("two_factor_token");
        sessionStorage.removeItem("two_factor_email");
        setStep("reset");
      } else {
        sessionStorage.removeItem("two_factor_token");
        sessionStorage.removeItem("two_factor_email");
        toast.success(result.message || "Successfully verified");
        router.push("/");
      }
    } catch (err: any) {
      toast.error(err.message || "Verification failed.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Recovery Code Logic ---
  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryCode.trim()) {
      setErrors({ recoveryCode: "Please enter your recovery code" });
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const email = sessionStorage.getItem("two_factor_email") || "";
      const result = await authService.recoverTfa(email, recoveryCode.trim());

      if (email) {
        sessionStorage.removeItem(`airline_tfa_enabled_${email}`);
        sessionStorage.removeItem(`airline_tfa_method_${email}`);
        sessionStorage.removeItem(`airline_tfa_date_${email}`);
      }

      sessionStorage.removeItem("two_factor_token");
      sessionStorage.removeItem("two_factor_email");
      toast.success(result.message || "2FA recovered and disabled. Please sign in again.");
      router.push("/auth/login");
    } catch (err: any) {
      toast.error(err.message || "Failed to recover 2FA.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Password Reset Logic ---
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
        {step === "otp" && view === "tfa" && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-[8px] flex items-center justify-center text-[#0F2757]">
                <ShieldCheck className="w-6 h-6 text-[#0F2757]" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-gray-800 text-lg font-semibold font-figtree leading-tight">
                  Two-factor authentication
                </h2>
                <p className="text-gray-500 text-[14px] font-normal font-figtree leading-tight">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
            </div>

            <form onSubmit={handleCodeSubmit} className="flex flex-col gap-6" noValidate>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between gap-2">
                  {code.map((digit, idx) => (
                    <input
                      key={idx}
                      ref={(el) => { inputRefs.current[idx] = el; }}
                      type="text"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => handleCodeChange(idx, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(idx, e)}
                      onPaste={idx === 0 ? handlePaste : undefined}
                      disabled={isLoading}
                      className={cn(
                        "w-12 h-12 text-center text-xl font-bold font-figtree rounded-[8px] border bg-[#F9FAFB] outline-none transition-all focus:bg-white focus:ring-2 focus:ring-[#0F2757]/10 disabled:opacity-50",
                        errors.code ? "border-red-500 focus:ring-red-500/10 border-red-500" : "border-gray-200 focus:border-[#0F2757]"
                      )}
                    />
                  ))}
                </div>
                {errors.code && (
                  <span className="text-red-500 text-xs font-medium font-figtree pl-1">
                    {errors.code}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[48px] rounded-[10px] bg-[#0F2757] hover:bg-[#162259] active:bg-[#091a3c] text-white text-base font-medium transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-[#0F2757]/10 cursor-pointer disabled:opacity-75 font-figtree"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Verifying...</span>
                  </>
                ) : (
                  <span>Verify code</span>
                )}
              </button>
            </form>

            <div className="flex flex-col items-center gap-3 pt-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setView("recovery")}
                className="text-[#0F2757] text-sm font-semibold hover:underline cursor-pointer font-figtree"
              >
                Use a recovery code
              </button>
            </div>
          </div>
        )}

        {step === "otp" && view === "recovery" && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-[8px] flex items-center justify-center text-[#0F2757]">
                <KeyRound className="w-6 h-6 text-[#0F2757]" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-gray-800 text-lg font-semibold font-figtree leading-tight">
                  Enter recovery code
                </h2>
                <p className="text-gray-500 text-[14px] font-normal font-figtree leading-tight">
                  Enter one of your emergency recovery codes to regain access
                </p>
              </div>
            </div>

            <form onSubmit={handleRecoverySubmit} className="flex flex-col gap-5" noValidate>
              <div className="flex flex-col gap-2">
                <label className="text-gray-800 text-base font-semibold font-figtree leading-tight">
                  Recovery Code
                </label>
                <div className={cn(
                  "relative h-[47px] w-full rounded-[6px] border bg-[#F9FAFB] transition-all flex items-center px-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0F2757]/10",
                  errors.recoveryCode ? "border-red-500 focus-within:ring-red-500/10 focus-within:border-red-500" : "border-gray-200 focus-within:border-[#0F2757]"
                )}>
                  <input
                    type="text"
                    placeholder="e.g. XXXX-XXXX-XXXX"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    disabled={isLoading}
                    className="w-full h-full bg-transparent outline-none text-gray-800 font-figtree text-[16px] placeholder-gray-400"
                  />
                </div>
                {errors.recoveryCode && (
                  <span className="text-red-500 text-xs font-medium font-figtree pl-1">
                    {errors.recoveryCode}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[48px] rounded-[10px] bg-[#0F2757] hover:bg-[#162259] active:bg-[#091a3c] text-white text-base font-medium transition-all duration-150 flex items-center justify-center gap-2 shadow-lg shadow-[#0F2757]/10 cursor-pointer disabled:opacity-75 font-figtree"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Recovering...</span>
                  </>
                ) : (
                  <span>Recover Account</span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setView("tfa")}
                className="text-gray-500 text-sm hover:underline cursor-pointer font-figtree text-center mt-1"
              >
                Back to 2FA code
              </button>
            </form>
          </div>
        )}
        
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
                    onChange={(e) => setNewPassword(e.target.value)}
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
                    onChange={(e) => setConfirmPassword(e.target.value)}
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
              onClick={() => router.push("/auth/login")}
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
