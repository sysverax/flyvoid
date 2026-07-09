"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Mail, Lock, Eye, EyeOff, KeyRound, ArrowLeft, Check } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { toast } from "react-toastify";
import { authService } from "@/src/services/auth.service";

type Step = 1 | 2 | 3 | "success";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [resetPasswordToken, setResetPasswordToken] = useState("");

  const [touched, setTouched] = useState<{
    email?: boolean;
    newPassword?: boolean;
    confirmPassword?: boolean;
  }>({});
  const [errors, setErrors] = useState<{
    email?: string;
    code?: string;
    password?: string;
    confirmPassword?: string;
  }>({});

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input on step 2
  useEffect(() => {
    if (step === 2 && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  const validateEmail = (val: string): string => {
    if (!val) {
      return "Email address is required";
    }
    if (!/\S+@\S+\.\S+/.test(val)) {
      return "Please enter a valid email address";
    }
    return "";
  };

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (touched.email) {
      setErrors((prev) => ({
        ...prev,
        email: validateEmail(val) || undefined,
      }));
    }
  };

  const handleEmailBlur = () => {
    setTouched((prev) => ({ ...prev, email: true }));
    setErrors((prev) => ({
      ...prev,
      email: validateEmail(email) || undefined,
    }));
  };

  // Handle email submission (Step 1)
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched((prev) => ({ ...prev, email: true }));
    const emailErr = validateEmail(email);

    if (emailErr) {
      setErrors((prev) => ({ ...prev, email: emailErr }));
      return;
    }

    setErrors((prev) => ({ ...prev, email: undefined }));
    setIsLoading(true);

    try {
      const successMsg = await authService.sendForgotPasswordOtp(email);
      toast.success(successMsg);
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || "Failed to send verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle code change (Step 2)
  const handleCodeChange = (index: number, val: string) => {
    if (isNaN(Number(val)) && val !== "") return; // Only numeric inputs

    const newCode = [...code];
    newCode[index] = val;
    setCode(newCode);
    setErrors((prev) => ({ ...prev, code: undefined }));

    // Move to next input if filled
    if (val !== "" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace and arrow navigation between inputs
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

  // Handle paste in code inputs
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    if (pasteData.length === 6 && /^\d+$/.test(pasteData)) {
      const splitCode = pasteData.split("");
      setCode(splitCode);
      inputRefs.current[5]?.focus();
    }
  };

  // Handle code verification submission (Step 2)
  const handleCodeVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredCode = code.join("");
    if (enteredCode.length < 6) {
      setErrors({ code: "Please enter the full 6-digit verification code" });
      return;
    }

    setErrors({});
    setIsLoading(true);

    try {
      const result = await authService.verifyForgotPasswordOtp(email, enteredCode);
      setResetPasswordToken(result.resetPasswordToken);
      toast.success(result.message);
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "Invalid or expired verification code.");
    } finally {
      setIsLoading(false);
    }
  };


  const validatePassword = (value: string): string => {
    if (!value) {
      return "Password is required";
    }
    const hasMinLength = value.length >= 8;
    const hasUppercase = /[A-Z]/.test(value);
    const hasLowercase = /[a-z]/.test(value);
    const hasNumber = /\d/.test(value);
    const hasSpecial = /[@#$!%*?&]/.test(value);
    const hasForbidden = /[^a-zA-Z\d@#$!%*?&]/.test(value);

    if (!hasMinLength || !hasUppercase || !hasLowercase || !hasNumber || !hasSpecial || hasForbidden) {
      return "Password must be at least 8 characters and include uppercase, lowercase, number, and special character (@#$!%*?&)";
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

  const handleConfirmPasswordChange = (val: string) => {
    setConfirmPassword(val);
    if (touched.confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: validateConfirmPassword(val, newPassword) || undefined,
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

  const handleConfirmPasswordBlur = () => {
    setTouched((prev) => ({ ...prev, confirmPassword: true }));
    setErrors((prev) => ({
      ...prev,
      confirmPassword: validateConfirmPassword(confirmPassword, newPassword) || undefined,
    }));
  };

  // Handle password reset submission (Step 3)
  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched((prev) => ({ ...prev, newPassword: true, confirmPassword: true }));

    const passwordErr = validatePassword(newPassword);
    const confirmPasswordErr = validateConfirmPassword(confirmPassword, newPassword);

    if (passwordErr || confirmPasswordErr) {
      setErrors((prev) => ({
        ...prev,
        password: passwordErr || undefined,
        confirmPassword: confirmPasswordErr || undefined,
      }));
      return;
    }

    setErrors((prev) => ({ ...prev, password: undefined, confirmPassword: undefined }));
    setIsLoading(true);

    try {
      const successMsg = await authService.resetPassword(resetPasswordToken, newPassword);
      toast.success(successMsg);
      setStep("success");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password.");
    } finally {
      setIsLoading(false);
    }
  };

  // Render step circles at the top of the card
  const renderStepper = () => {
    if (step === "success") return null;

    return (
      <div className="flex items-center justify-center gap-2 mb-4 relative select-none">
        {/* Step 1 */}
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold font-figtree transition-all duration-300",
          step > 1 ? "bg-[#1FAD53] text-white" : "bg-primary text-white"
        )}>
          {step > 1 ? (
            <img src="/icons/tick.svg" alt="tick" className="w-4 h-4" />
          ) : "1"}
        </div>

        {/* Line 1-2 */}
        <div className={cn("h-[1px] w-8 transition-all duration-300", step > 1 ? "bg-[#1FAD53]" : "bg-[#DDDFE3]")} />

        {/* Step 2 */}
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold font-figtree transition-all duration-300",
          step > 2 ? "bg-[#1FAD53] text-white" : step === 2 ? "bg-primary text-white" : "bg-[#EEEFF1] text-gray-500"
        )}>
          {step > 2 ? (
            <img src="/icons/tick.svg" alt="tick" className="w-4 h-4" />
          ) : "2"}
        </div>

        {/* Line 2-3 */}
        <div className={cn("h-[1px] w-8 transition-all duration-300", step > 2 ? "bg-[#1FAD53]" : "bg-gray-300")} />

        {/* Step 3 */}
        <div className={cn(
          "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold font-figtree transition-all duration-300",
          step === 3 ? "bg-primary text-white" : "bg-[#EEEFF1] text-gray-500"
        )}>
          3
        </div>
      </div>
    );
  };

  return (
    <div className="w-full lg:w-[480px] flex flex-col items-center justify-center min-h-screen px-4">
      {/* Top Brand Header Section */}
      <div className="flex flex-col items-center mb-8 text-center select-none animate-fadeIn">
        <div className="w-16 h-16 bg-primary rounded-[12px] flex items-center justify-center mb-6">
          <img
            src="/icons/plane1.svg"
            alt="FlyVoid Logo"
            className="h-8 w-8"
          />
        </div>
        <h1 className="text-gray-800 text-[24px] font-bold tracking-tight leading-[100%] py-1">
          FlyVoid Admin
        </h1>
        <p className="text-gray-500 text-[14px] font-normal mt-1 font-figtree">
          Reset your password
        </p>
      </div>

      {/* The White Card Container */}
      <div className="w-full bg-white rounded-[16px] border border-gray-200 p-[31px] flex flex-col animate-fadeIn">
        {/* Render Step indicators */}
        {renderStepper()}

        {/* Step 1: Forgot Password (Email request) */}
        {step === 1 && (
          <div className="flex flex-col gap-6 mt-1.5 translate-y-1">
            <div className="flex flex-col gap-1">
              <h2 className="text-gray-800 text-lg font-semibold font-figtree leading-tight">
                Forgot your password?
              </h2>
              <p className="text-gray-500 text-[14px] font-normal font-figtree leading-tight">
                Enter your email and we'll send you a verification code
              </p>
            </div>

            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-5" noValidate>
              <div className="flex flex-col gap-2 mb-1.5">
                <label className="text-gray-800 text-base font-semibold font-figtree leading-tight">
                  Email Address
                </label>
                <div className={cn(
                  "relative h-[47px] w-full rounded-[6px] border bg-[#F9FAFB] transition-all flex items-center px-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0F2757]/10",
                  errors.email ? "border-rose-300 focus-within:ring-rose-500/10 focus-within:border-rose-400" : "border-gray-200 focus-within:border-[#0F2757]"
                )}>
                  <Mail className={cn("w-4 h-4 text-gray-500 shrink-0 transition-colors text-gray-400")} />
                  <input
                    type="email"
                    placeholder="you@flyvoid.com"
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    onBlur={handleEmailBlur}
                    onInvalid={(e) => e.preventDefault()}
                    disabled={isLoading}
                    className="w-full h-full bg-transparent pl-[13px] pr-2 outline-none text-gray-800 font-figtree text-[16px] placeholder-gray-500"
                  />
                </div>
                {errors.email && (
                  <span className="text-rose-500 text-xs font-medium font-figtree pl-1">
                    {errors.email}
                  </span>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[48px] rounded-[10px] bg-primary hover:bg-[#1a3465] active:bg-[#091a3c] text-white text-base transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 font-figtree font-medium"
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>Sending code...</span>
                  </>
                ) : (
                  <span>Send verification code</span>
                )}
              </button>
            </form>

            <div className="flex justify-center -mt-1">
              <button
                type="button"
                onClick={() => router.push("/login")}
                disabled={isLoading}
                className="text-gray-500 hover:text-gray-800 transition-colors text-sm flex items-center gap-1.5 cursor-pointer font-figtree disabled:opacity-50"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back to login</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Verification Code Input Screen */}
        {step === 2 && (
          <div className="flex flex-col gap-6 mt-2">
            <div className="flex flex-col gap-3">
              {/* Rounded Key Icon Box */}
              <div className="w-12 h-12 bg-[#192E571A] rounded-[8px] flex items-center justify-center text-primary">
                <KeyRound className="w-6 h-6 text-primary" />
              </div>

              <div className="flex flex-col gap-1">
                <h2 className="text-gray-800 text-lg font-semibold font-figtree leading-tight">
                  Enter verification code
                </h2>
                <p className="text-gray-500 text-[14px] font-normal font-figtree leading-tight">
                  We sent a 6-digit code to <span className="font-semibold text-gray-800">{email}</span>
                </p>
              </div>
            </div>

            <form onSubmit={handleCodeVerify} className="flex flex-col gap-6" noValidate>
              {/* 6 Digit Input Group */}
              <div className="flex items-center justify-center">
                {code.map((digit, idx) => (
                  <input
                    key={idx}
                    type="text"
                    maxLength={1}
                    value={digit}
                    ref={(el) => { inputRefs.current[idx] = el; }}
                    onChange={(e) => handleCodeChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    onPaste={idx === 0 ? handlePaste : undefined}
                    disabled={isLoading}
                    className={cn(
                      "w-[40px] h-[40px] border text-center text-base font-bold font-figtree outline-none transition-all focus:bg-white focus:ring-2 focus:relative focus:z-10 disabled:opacity-70",
                      errors.code ? "border-rose-300 focus:border-rose-400 focus:ring-rose-500/10" : "border-[#DDDFE3] focus:border-[#0F2757] focus:ring-[#0F2757]/10",
                      idx === 0 && "rounded-l-[6px]",
                      idx === 5 && "rounded-r-[6px]",
                      idx !== 0 && "-ml-[1px]"
                    )}
                  />
                ))}
              </div>
              {errors.code && (
                <span className="text-rose-500 text-xs font-medium font-figtree -mt-3 pl-1 text-center">
                  {errors.code}
                </span>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[48px] rounded-[10px] bg-primary hover:bg-[#1a3465] active:bg-[#091a3c] text-white text-base transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 font-figtree mt-0.5"
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

            <div className="flex flex-col items-center gap-3 justify-center -mt-1">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setCode(Array(6).fill(""));
                }}
                disabled={isLoading}
                className="text-gray-500 hover:text-gray-800 transition-colors text-sm flex items-center gap-1.5 cursor-pointer font-figtree translate-y-1 disabled:opacity-50"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Use a different email</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Choose New Password */}
        {step === 3 && (
          <div className="flex flex-col gap-6 mt-2 translate-y-0.5">
            <div className="flex flex-col gap-3">
              <div className="w-12 h-12 bg-gray-100 rounded-[8px] flex items-center justify-center text-primary">
                <Lock className="w-6 h-6 text-primary" />
              </div>
              <div className="flex flex-col gap-1">
                <h2 className="text-gray-800 text-lg font-semibold font-figtree leading-tight">
                  Set new password
                </h2>
                <p className="text-gray-500 text-[14px] font-normal font-figtree leading-tight">
                  Choose a strong password you haven't used before
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordReset} className="flex flex-col gap-5" noValidate>
              {/* New Password field */}
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

              {/* Confirm Password field */}
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
                    <span>Resetting...</span>
                  </>
                ) : (
                  <span>Reset password</span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Password reset success screen */}
        {step === "success" && (
          <div className="flex flex-col items-center text-center gap-4 animate-fadeIn">
            {/* Green Check Circle */}
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
