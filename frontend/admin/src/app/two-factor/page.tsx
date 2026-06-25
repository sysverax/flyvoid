"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ArrowLeft } from "lucide-react";
import { cn } from "@/src/lib/utils";

type ViewType = "tfa" | "recovery";

export default function TwoFactorPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewType>("tfa");
  const [code, setCode] = useState<string[]>(Array(6).fill(""));
  const [recoveryCode, setRecoveryCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ code?: string; recoveryCode?: string }>({});

  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus the first input box when mounting or switching views
  useEffect(() => {
    if (view === "tfa" && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [view]);

  // Handle single character digit change (with overwrite capability)
  const handleCodeChange = (index: number, val: string) => {
    // If user types a new digit in a field that already has one, overwrite with the new character
    const targetVal = val.length > 1 ? val.slice(-1) : val;

    // Permit only digits or empty string
    if (isNaN(Number(targetVal)) && targetVal !== "") return;

    const newCode = [...code];
    newCode[index] = targetVal;
    setCode(newCode);
    setErrors((prev) => ({ ...prev, code: undefined }));

    // Move focus forward if we typed or overwrote a digit
    if (targetVal !== "" && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // Handle backspace navigation between inputs
  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (code[index] === "" && index > 0) {
        // Box is empty: focus previous input and clear its digit
        inputRefs.current[index - 1]?.focus();
        const newCode = [...code];
        newCode[index - 1] = "";
        setCode(newCode);
      } else {
        // Box has character: just clear it
        const newCode = [...code];
        newCode[index] = "";
        setCode(newCode);
      }
    }
  };

  // Handle paste input into any of the input boxes
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\s/g, ""); // remove whitespace
    if (pasteData.length === 6 && /^\d+$/.test(pasteData)) {
      const splitCode = pasteData.split("");
      setCode(splitCode);
      inputRefs.current[5]?.focus();
      setErrors((prev) => ({ ...prev, code: undefined }));
    }
  };

  // Handle 6-digit code submission
  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const enteredCode = code.join("");
    if (enteredCode.length < 6) {
      setErrors({ code: "Please enter the full 6-digit verification code" });
      return;
    }

    setErrors({});
    setIsLoading(true);

    // Simulate verification and redirect to home
    setTimeout(() => {
      setIsLoading(false);
      router.push("/");
    }, 1500);
  };

  // Handle recovery code submission
  const handleRecoverySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryCode.trim()) {
      setErrors({ recoveryCode: "Recovery code is required" });
      return;
    }

    setErrors({});
    setIsLoading(true);

    // Simulate recovery verification and redirect to home
    setTimeout(() => {
      setIsLoading(false);
      router.push("/");
    }, 1500);
  };

  return (
    <div className="w-full lg:w-[480px] flex flex-col items-center justify-center min-h-screen px-4 font-figtree">
      {/* Top Header Logo Block */}
      <div className="flex flex-col items-center mb-8 text-center select-none animate-fadeIn">
        <div className="w-16 h-16 bg-[#0F2757] rounded-[12px] flex items-center justify-center mb-6">
          <img
            src="/icons/plane1.svg"
            alt="FlyVoid Logo"
            className="h-8 w-8"
          />
        </div>
        <h1 className="text-gray-800 text-[24px] font-bold leading-[100%] py-1">
          FlyVoid Admin
        </h1>
        <p className="text-gray-500 text-[14px] font-normal mt-1">
          Disruption Hotel Allocation Platform
        </p>
      </div>

      {/* The White Card Container */}
      <div className="w-full bg-white rounded-[16px] border border-gray-200 p-[31px] flex flex-col gap-6 animate-fadeIn">

        {view === "tfa" ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3">
              {/* Rounded Key Icon Box */}
              <div className="w-12 h-12 bg-[#192E571A] rounded-[8px] flex items-center justify-center text-primary">
                <KeyRound className="w-6 h-6 text-primary" />
              </div>

              <div className="flex flex-col gap-1">
                <h2 className="text-gray-800 text-lg font-semibold leading-tight">
                  Two-factor authentication
                </h2>
                <p className="text-gray-500 text-[14px] font-normal leading-tight">
                  Enter the 6-digit code from your authenticator app
                </p>
              </div>
            </div>

            <form onSubmit={handleCodeSubmit} className="flex flex-col gap-6">
              {/* 6 Digit Input Group */}
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
                <span className="text-rose-500 text-xs font-medium -mt-3 pl-1 text-center">
                  {errors.code}
                </span>
              )}

              {/* Verify & Sign in Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[48px] rounded-[10px] bg-primary hover:bg-[#1a3465] active:bg-[#091a3c] text-white text-base transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed mt-0.5"
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
                className="text-[#1F2937] hover:text-[#1a3465] transition-colors text-[13px] underline cursor-pointer"
              >
                Use a recovery code instead
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-6 pt-1">
            <div className="flex flex-col gap-3 -translate-y-1">
              {/* Rounded Key Icon Box */}
              <div className="w-12 h-12 bg-[#192E571A] rounded-[8px] flex items-center justify-center text-primary">
                <KeyRound className="w-6 h-6 text-primary" />
              </div>

              <div className="flex flex-col gap-1">
                <h2 className="text-gray-800 text-lg font-semibold leading-tight">
                  Recovery code
                </h2>
                <p className="text-gray-500 text-[14px] font-normal leading-tight">
                  Lost access to your authenticator app? Enter one of the recovery codes you saved when enabling 2FA.
                </p>
              </div>
            </div>

            <form onSubmit={handleRecoverySubmit} className="flex flex-col gap-6 -translate-y-0.5">
              <div className="flex flex-col gap-2">
                <label className="text-gray-800 text-base font-semibold leading-tight">
                  Recovery code
                </label>
                <div className={cn(
                  "relative h-[47px] w-full rounded-[6px] border bg-[#F6F7F8] transition-all flex items-center px-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0F2757]/10",
                  errors.recoveryCode ? "border-rose-300 focus-within:ring-rose-500/10 focus-within:border-rose-400" : "border-[#DDDFE3] focus-within:border-[#0F2757]"
                )}>
                  <input
                    type="text"
                    placeholder="XXXXX-XXXXX"
                    value={recoveryCode}
                    onChange={(e) => {
                      setRecoveryCode(e.target.value);
                      if (errors.recoveryCode) setErrors((prev) => ({ ...prev, recoveryCode: undefined }));
                    }}
                    disabled={isLoading}
                    className="w-full h-full pr-2 outline-none text-gray-800 text-[16px] placeholder-gray-500"
                  />
                </div>
                <p className="text-gray-500 text-sm font-normal">
                  Each recovery code can only be used once.
                </p>
                {errors.recoveryCode && (
                  <span className="text-rose-500 text-xs font-medium mt-0.5 pl-1">
                    {errors.recoveryCode}
                  </span>
                )}
              </div>

              {/* Sign In with Recovery Code Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-[48px] rounded-[10px] bg-primary hover:bg-[#1a3465] active:bg-[#091a3c] text-white text-base transition-all duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed -translate-y-0.5"
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
                  <span>Sign In with Recovery Code</span>
                )}
              </button>
            </form>
          </div>
        )}

        <div className="flex justify-center -mt-1.5">
          {view === "tfa" ? (
            <button
              type="button"
              onClick={() => router.push("/login")}
              className="text-gray-500 hover:text-gray-800 transition-colors text-sm flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to login</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setView("tfa");
                setErrors({});
              }}
              className="text-gray-500 hover:text-gray-800 transition-colors text-[13px] flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to verification</span>
            </button>
          )}
        </div>

      </div>

      {/* Footer Security Badge */}
      <div className="mt-6 flex items-center gap-1.5 text-gray-400 select-none animate-fadeIn">
        <img src={"/icons/sheild1.svg"} alt="lock" className="w-4 h-4 text-gray-400 relative bottom-[2px]" />
        <span className="text-[13px] font-normal">
          Protected by enterprise-grade security
        </span>
      </div>
    </div>
  );
}
