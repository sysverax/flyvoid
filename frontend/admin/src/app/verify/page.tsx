"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ArrowLeft, Lock, Eye, EyeOff } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { authService } from "@/src/services/auth.service";
import { toast } from "react-toastify";

type Step = "otp" | "reset" | "success";
type ViewType = "tfa" | "recovery";

export default function VerificationPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(() => {
    if (typeof window !== "undefined") {
      if (sessionStorage.getItem("two_factor_token")) {
        return "otp";
      }
      if (sessionStorage.getItem("reset_password_token")) {
        return "reset";
      }
    }
    return "otp";
  });
  
  // 2FA / OTP States
  const [view, setView] = useState<ViewType>("tfa");
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

  const [resetPasswordToken, setResetPasswordToken] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("reset_password_token") || "";
    }
    return "";
  });
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus the first input box when mounting OTP view
  useEffect(() => {
    const twoFactorToken = sessionStorage.getItem("two_factor_token");
    const pwdToken = sessionStorage.getItem("reset_password_token");

    if (twoFactorToken) {
      setStep("otp");
      if (view === "tfa" && inputRefs.current[0]) {
        inputRefs.current[0].focus();
      }
    } else if (pwdToken) {
      setStep("reset");
      setResetPasswordToken(pwdToken);
    } else {
      toast.error("Invalid or expired session. Please sign in again.");
      router.push("/login");
    }
  }, [view, router]);

  // Focus first OTP field on step changes
  useEffect(() => {
    if (step === "otp" && view === "tfa" && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step, view]);

  // --- OTP Verification Logic ---
  const handleCodeChange = (index: number, val: string) => {
    const targetVal = val.length > 1 ? val.slice(-1) : val;
    if (isNaN(Number(targetVal)) && targetVal !== "") return;

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
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
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
        sessionStorage.setItem(`tfa_enabled_${email}`, "true");
        sessionStorage.setItem(`tfa_method_${email}`, "authenticator");

        const today = new Date();
        const day = String(today.getDate()).padStart(2, "0");
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const year = today.getFullYear();
        sessionStorage.setItem(`tfa_date_${email}`, `${day}/${month}/${year}`);
      }

      if (result?.requiresPasswordReset) {
        setResetPasswordToken(result.resetPasswordToken || "");
        sessionStorage.setItem("reset_password_token", result.resetPasswordToken || "");
        sessionStorage.removeItem("two_factor_token");
        sessionStorage.removeItem("two_factor_email");
        sessionStorage.removeItem("two_factor_password");
        setStep("reset");
      } else {
        sessionStorage.removeItem("two_factor_token");
        sessionStorage.removeItem("two_factor_email");
        sessionStorage.removeItem("two_factor_password");
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
    const cleanedCode = recoveryCode.replace(/[\s-]/g, "").toUpperCase();
    if (!cleanedCode) {
      setErrors({ recoveryCode: "Recovery code is required" });
      return;
    }
    if (cleanedCode.length !== 10 || /[^A-Z0-9]/.test(cleanedCode)) {
      setErrors({ recoveryCode: "Recovery code must be exactly 10 alphanumeric characters" });
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const email = sessionStorage.getItem("two_factor_email") || "";
      const password = sessionStorage.getItem("two_factor_password") || "";
      const result = await authService.recoverSigninTfa(email, password, cleanedCode);

      if (email) {
        sessionStorage.removeItem(`tfa_enabled_${email}`);
        sessionStorage.removeItem(`tfa_method_${email}`);
        sessionStorage.removeItem(`tfa_date_${email}`);
      }

      sessionStorage.removeItem("two_factor_token");
      sessionStorage.removeItem("two_factor_email");
      sessionStorage.removeItem("two_factor_password");

      toast.success(result.message || "2FA recovered and disabled. Please sign in again.");
      router.push("/login");
    } catch (err: any) {
      toast.error(err.message || "Recovery failed.");
      if (err.status === 401) {
        sessionStorage.removeItem("two_factor_token");
        sessionStorage.removeItem("two_factor_email");
        sessionStorage.removeItem("two_factor_password");
        router.push("/login");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- Password Reset Logic ---
  const validatePassword = (value: string): string => {
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

  const validateConfirmPassword = (confirmVal: string, passwordVal: string): string => {
    if (!confirmVal) {
      return "Please confirm your password";
    }
    if (confirmVal !== passwordVal) {
      return "Passwords do not match";
    }
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
        <div className="w-16 h-16 bg-primary rounded-[12px] flex items-center justify-center mb-6">
          <img src="/icons/plane1.svg" alt="FlyVoid Logo" className="h-8 w-8" />
        </div>
        <h1 className="text-gray-800 text-[24px] font-bold leading-[100%] py-1">
          FlyVoid Admin
        </h1>
        <p className="text-gray-500 text-[14px] font-normal mt-1 font-figtree">
          Disruption Hotel Allocation Platform
        </p>
      </div>

      {/* Main Container Card */}
      <div className="w-full bg-white rounded-[16px] border border-gray-200 p-[31px] flex flex-col gap-6 animate-fadeIn">
        
        {/* Step 1: OTP / Recovery Form */}
        {step === "otp" && (
          <>
            {view === "tfa" ? (
              <div className="flex flex-col gap-6">
                <div className="flex flex-col gap-3">
                  <div className="w-12 h-12 bg-[#192E571A] rounded-[8px] flex items-center justify-center text-primary">
                    <KeyRound className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-gray-800 text-lg font-semibold leading-tight font-figtree">
                      Two-factor authentication
                    </h2>
                    <p className="text-gray-500 text-[14px] font-normal leading-tight font-figtree">
                      Enter the 6-digit code from your authenticator app
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCodeSubmit} className="flex flex-col gap-6">
                  <div className="flex items-center justify-center">
                    {code.map((digit, idx) => (
                      <input
                        key={idx}
                        type="text"
                        value={digit}
                        ref={(el) => { inputRefs.current[idx] = el; }}
                        onChange={(e) => handleCodeChange(idx, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(idx, e)}
                        onPaste={handlePaste}
                        disabled={isLoading}
                        className={cn(
                          "w-[40px] h-[40px] border border-[#DDDFE3] text-center text-base font-bold font-figtree outline-none transition-all",
                          "focus:bg-white focus:ring-2 focus:ring-[#0F2757]/10 focus:border-[#0F2757] focus:relative focus:z-10",
                          idx === 0 && "rounded-l-[6px]",
                          idx === 5 && "rounded-r-[6px]",
                          idx !== 0 && "-ml-[1px]",
                          errors.code ? "border-rose-300 focus:ring-rose-500/10 focus:border-rose-400" : "",
                          "disabled:opacity-70"
                        )}
                      />
                    ))}
                  </div>

                  {errors.code && (
                    <span className="text-rose-500 text-xs font-medium -mt-3 pl-1 text-center font-figtree">
                      {errors.code}
                    </span>
                  )}

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-[48px] rounded-[10px] bg-primary hover:bg-[#1a3465] active:bg-[#091a3c] active:scale-[0.98] text-white text-base transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-default shadow-lg shadow-[#0F2757]/10 mt-0.5 font-figtree"
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
                      <span>Verify & Sign in</span>
                    )}
                  </button>
                </form>

                <div className="flex flex-col items-center gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setView("recovery");
                      setErrors({});
                    }}
                    disabled={isLoading}
                    className="text-[#1F2937] hover:text-[#1a3465] transition-colors text-[13px] underline cursor-pointer disabled:opacity-50 font-figtree"
                  >
                    Use a recovery code instead
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-6 pt-1">
                <div className="flex flex-col gap-3 -translate-y-1">
                  <div className="w-12 h-12 bg-[#192E571A] rounded-[8px] flex items-center justify-center text-primary">
                    <KeyRound className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h2 className="text-gray-800 text-lg font-semibold leading-tight font-figtree">
                      Recovery code
                    </h2>
                    <p className="text-gray-500 text-[14px] font-normal leading-tight font-figtree">
                      Enter a 10-character alphanumeric recovery code
                    </p>
                  </div>
                </div>

                <form onSubmit={handleRecoverySubmit} className="flex flex-col gap-5 -translate-y-1">
                  <div className="flex flex-col gap-2">
                    <label className="text-gray-800 text-base font-semibold font-figtree leading-tight">
                      Recovery Code
                    </label>
                    <div className={cn(
                      "relative h-[47px] w-full rounded-[6px] border bg-[#F9FAFB] transition-all flex items-center px-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0F2757]/10",
                      errors.recoveryCode ? "border-rose-300 focus-within:ring-rose-500/10 focus-within:border-rose-400" : "border-gray-200 focus-within:border-[#0F2757]"
                    )}>
                      <input
                        type="text"
                        placeholder="XXXXX-XXXXX"
                        value={recoveryCode}
                        onChange={(e) => {
                          setRecoveryCode(e.target.value);
                          setErrors((prev) => ({ ...prev, recoveryCode: undefined }));
                        }}
                        disabled={isLoading}
                        className="w-full h-full bg-transparent outline-none text-gray-800 font-figtree text-[16px] placeholder-gray-500"
                      />
                    </div>
                    {errors.recoveryCode && (
                      <span className="text-rose-500 text-xs font-medium font-figtree pl-1">
                        {errors.recoveryCode}
                      </span>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full h-[48px] rounded-[10px] bg-primary hover:bg-[#1a3465] active:bg-[#091a3c] active:scale-[0.98] text-white text-base transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-default shadow-lg shadow-[#0F2757]/10 mt-1 font-figtree"
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
                      <span>Verify Recovery Code</span>
                    )}
                  </button>
                </form>

                <div className="flex flex-col items-center gap-3 justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      setView("tfa");
                      setErrors({});
                    }}
                    disabled={isLoading}
                    className="text-[#1F2937] hover:text-[#1a3465] transition-colors text-[13px] flex items-center gap-1.5 cursor-pointer disabled:opacity-50 font-figtree"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Go back
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Step 2: Initial Password Reset */}
        {step === "reset" && (
          <div className="flex flex-col gap-6 animate-fadeIn">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-gray-100 rounded-[8px] flex items-center justify-center text-primary">
                <Lock className="w-6 h-6 text-primary" />
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
              {/* New Password */}
              <div className="flex flex-col gap-2">
                <label className="text-gray-800 text-base font-semibold font-figtree leading-tight">
                  New Password
                </label>
                <div className={cn(
                  "relative h-[47px] w-full rounded-[6px] border bg-[#F9FAFB] transition-all flex items-center px-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0F2757]/10",
                  errors.password ? "border-rose-300 focus-within:ring-rose-500/10 focus-within:border-rose-400" : "border-gray-200 focus-within:border-[#0F2757]"
                )}>
                  <Lock className="w-4 h-4 text-gray-500 shrink-0" />
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
                  <span className="text-rose-500 text-xs font-medium font-figtree pl-1">
                    {errors.password}
                  </span>
                )}
              </div>

              {/* Confirm Password */}
              <div className="flex flex-col gap-2">
                <label className="text-gray-800 text-base font-semibold font-figtree leading-tight">
                  Confirm Password
                </label>
                <div className={cn(
                  "relative h-[47px] w-full rounded-[6px] border bg-[#F9FAFB] transition-all flex items-center px-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0F2757]/10",
                  errors.confirmPassword ? "border-rose-300 focus-within:ring-rose-500/10 focus-within:border-rose-400" : "border-gray-200 focus-within:border-[#0F2757]"
                )}>
                  <Lock className="w-4 h-4 text-gray-500 shrink-0" />
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
                  <span className="text-rose-500 text-xs font-medium font-figtree pl-1">
                    {errors.confirmPassword}
                  </span>
                )}
              </div>

              {/* Submit Reset Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[48px] rounded-[10px] bg-primary hover:bg-[#1a3465] active:bg-[#091a3c] text-white text-base transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 font-figtree mt-1.5"
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

        {/* Step 3: Success Screen */}
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
              className="w-full h-[48px] rounded-[10px] bg-primary hover:bg-[#1a3465] active:bg-[#091a3c] text-white text-base font-figtree transition-colors duration-150 cursor-pointer translate-y-0.5"
            >
              Continue to login
            </button>
          </div>
        )}
      </div>

      {/* Footer Security Shield */}
      <div className="mt-7.5 flex items-center gap-1.5 text-gray-400 select-none animate-fadeIn">
        <img src={"/icons/sheild1.svg"} alt="lock" className="w-4 h-4 text-gray-400 relative bottom-[2px]" />
        <span className="text-[13px] font-normal font-figtree">
          Protected by enterprise-grade security
        </span>
      </div>
    </div>
  );
}
