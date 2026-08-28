"use client";

import { useState } from "react";
import { cn } from "@/src/lib/utils";
import { authService } from "@/src/services/auth.service";

interface TfaVerificationProps {
  tfaMethod: "email" | "authenticator";
  email: string;
  onCompleteSetup: () => void;
  onCancel: () => void;
  showToast: (message: string, type?: "success" | "warning" | "info") => void;
  isShowingRecoveryCodes: boolean;
  setIsShowingRecoveryCodes: (val: boolean) => void;
  manualEntryKey?: string;
  qrCodeDataUrl?: string;
}



export function TfaVerification({
  tfaMethod,
  email,
  onCompleteSetup,
  onCancel,
  showToast,
  isShowingRecoveryCodes,
  setIsShowingRecoveryCodes,
  manualEntryKey,
  qrCodeDataUrl,
}: TfaVerificationProps) {
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(""));
  const [isRecoveryCodesChecked, setIsRecoveryCodesChecked] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [hasError, setHasError] = useState(false);
  const [areCodesCopied, setAreCodesCopied] = useState(false);
  const [areCodesDownloaded, setAreCodesDownloaded] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isCompletingSetup, setIsCompletingSetup] = useState(false);

  const handleOtpChange = (index: number, val: string) => {
    if (/[^0-9]/.test(val)) return;
    const newOtp = [...otpValues];
    newOtp[index] = val;
    setOtpValues(newOtp);
    setError(null);
    setHasError(false);
    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace") {
      if (!otpValues[index] && index > 0) {
        const prevInput = document.getElementById(`otp-${index - 1}`);
        prevInput?.focus();
        const newOtp = [...otpValues];
        newOtp[index - 1] = "";
        setOtpValues(newOtp);
      } else {
        const newOtp = [...otpValues];
        newOtp[index] = "";
        setOtpValues(newOtp);
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    } else if (e.key === "ArrowRight" && index < 5) {
      e.preventDefault();
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").trim();
    if (pasteData.length === 6 && /^\d+$/.test(pasteData)) {
      const splitCode = pasteData.split("");
      setOtpValues(splitCode);
      setError(null);
      setHasError(false);
      const targetInput = document.getElementById("otp-5");
      targetInput?.focus();
    }
  };

  const handleVerify = async () => {
    const code = otpValues.join("");
    if (code.length < 6) {
      setError("Please enter a valid 6-digit code.");
      setHasError(true);
      return;
    }
    setError(null);
    setHasError(false);
    if (tfaMethod === "email") {
      setIsVerifying(true);
      try {
        onCompleteSetup();
      } finally {
        setIsVerifying(false);
      }
    } else {
      setIsVerifying(true);
      try {
        const result = await authService.enableTfa(code);

        const today = new Date();
        const day = String(today.getDate()).padStart(2, "0");
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const year = today.getFullYear();
        const dateStr = `${day}/${month}/${year}`;

        sessionStorage.setItem(`tfa_enabled_${email}`, "true");
        sessionStorage.setItem(`tfa_method_${email}`, tfaMethod);
        sessionStorage.setItem(`tfa_date_${email}`, dateStr);

        setRecoveryCodes(result.recoveryCodes);
        showToast(result.message, "success");
        setIsShowingRecoveryCodes(true);
        setIsRecoveryCodesChecked(false);
      } catch (err: any) {
        const errMsg = err.message || "Failed to enable 2FA.";
        setError(null);
        setHasError(true);
        showToast(errMsg, "warning");
      } finally {
        setIsVerifying(false);
      }
    }
  };

  const handleCompleteSetupClick = () => {
    setIsCompletingSetup(true);
    setTimeout(() => {
      setIsCompletingSetup(false);
      onCompleteSetup();
    }, 1500);
  };

  const handleCopyCodes = () => {
    navigator.clipboard.writeText(recoveryCodes.join("\n"));
    setAreCodesCopied(true);
    setTimeout(() => setAreCodesCopied(false), 2000);
  };

  const handleDownloadQr = () => {
    if (!qrCodeDataUrl) {
      showToast("No QR code available to download.", "warning");
      return;
    }
    const element = document.createElement("a");
    element.href = qrCodeDataUrl;
    element.download = "flyvoid-2fa-qr.png";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast("QR code downloaded successfully", "success");
  };

  const handleDownloadCodes = () => {
    const element = document.createElement("a");
    const file = new Blob([recoveryCodes.join("\n")], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = "flyvoid-recovery-codes.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    setAreCodesDownloaded(true);
    setTimeout(() => setAreCodesDownloaded(false), 2000);
  };

  if (isShowingRecoveryCodes) {
    /* State 1: Recovery Codes View */
    return (
      <>
        <div className="justify-start text-gray-800 text-[19px] font-medium font-figtree leading-[100%]">
          Choose verification method
        </div>
        <div className="self-stretch flex flex-col justify-start items-start gap-5 w-full">
          <div className="self-stretch px-4 py-3.5 bg-orange-50 rounded-[10px] outline outline-1 outline-offset-[-1px] outline-orange-300 inline-flex justify-start items-center gap-4">
            <div className="flex justify-start items-center gap-2.5">
              <img
                src="/icons/danger2.svg"
                alt="danger"
                className="size-5 shrink-0 mt-0.5"
              />
              <div className="inline-flex flex-col justify-start items-start gap-1">
                <div className="justify-start text-gray-800 text-base font-medium font-figtree leading-[100%]">
                  Save your recovery codes
                </div>
                <div className="justify-start text-gray-500 text-sm font-normal font-figtree leading-normal">
                  Store these in a secure location. They will only be shown once
                  and cannot be retrieved or regenerated later.
                </div>
              </div>
            </div>
          </div>
          <div className="self-stretch flex flex-col justify-start items-start gap-3 w-full">
            {Array.from({ length: Math.ceil(recoveryCodes.length / 2) }, (_, i) => (
              <div
                key={i}
                className="self-stretch inline-flex justify-start items-center gap-3"
              >
                <div className="h-[35px] flex-1 px-3 py-2 bg-white rounded-lg outline outline-1 outline-offset-[-1px] outline-gray-300 flex justify-center items-center gap-2.5">
                  <div className="justify-start text-gray-800 text-base font-medium font-figtree">
                    {recoveryCodes[i * 2]}
                  </div>
                </div>
                {recoveryCodes[i * 2 + 1] && (
                  <div className="h-[35px] flex-1 px-3 py-2 bg-white rounded-lg outline outline-1 outline-offset-[-1px] outline-gray-300 flex justify-center items-center gap-2.5">
                    <div className="justify-start text-gray-800 text-base font-medium font-figtree">
                      {recoveryCodes[i * 2 + 1]}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="inline-flex justify-start items-start gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={handleCopyCodes}
              className="h-10 pl-3.5 pr-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-[10px] outline outline-1 outline-offset-[-1px] outline-gray-300 flex justify-center items-center gap-2 overflow-hidden cursor-pointer transition-colors"
            >
              <img
                src="/icons/paste.svg"
                alt="copy"
                className="size-5 shrink-0"
              />
              <div className="justify-start text-gray-800 text-base font-medium font-figtree">
                Copy
              </div>
            </button>
            {areCodesCopied && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-gray-500 text-white text-xs font-medium font-figtree rounded-full whitespace-nowrap shadow-lg animate-fadeIn z-20">
                Codes Copied!
                <div className="absolute top-[85%] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-gray-500 rotate-45"></div>
              </div>
            )}
          </div>
          <div className="relative">
            <button
              type="button"
              onClick={handleDownloadCodes}
              className="h-10 pl-3.5 pr-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-[10px] outline outline-1 outline-offset-[-1px] outline-gray-300 flex justify-center items-center gap-2 overflow-hidden cursor-pointer transition-colors"
            >
              <img
                src="/icons/download.svg"
                alt="download"
                className="size-5 shrink-0"
              />
              <div className="justify-start text-gray-800 text-base font-medium font-figtree">
                Download
              </div>
            </button>
            {areCodesDownloaded && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-gray-500 text-white text-xs font-medium font-figtree rounded-full whitespace-nowrap shadow-lg animate-fadeIn z-20">
                Downloaded!
                <div className="absolute top-[85%] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-gray-500 rotate-45"></div>
              </div>
            )}
          </div>
        </div>
        <label className="inline-flex justify-start items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isRecoveryCodesChecked}
            onChange={(e) => setIsRecoveryCodesChecked(e.target.checked)}
            className="sr-only"
          />
          <div
            className={cn(
              "size-4 rounded-[4px] border flex items-center justify-center transition-colors shrink-0",
              isRecoveryCodesChecked
                ? "bg-blue-950 border-blue-950 text-white"
                : "bg-white border-gray-300 text-transparent",
            )}
          >
            <svg
              className="size-2.5 stroke-[3px]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <div className="justify-start text-gray-500 text-base font-normal font-figtree">
            I have saved these recovery codes
          </div>
        </label>
        <button
          type="button"
          onClick={handleCompleteSetupClick}
          disabled={!isRecoveryCodesChecked || isCompletingSetup}
          className={cn(
            "px-4 py-3 text-white rounded-[10px] inline-flex justify-center items-center overflow-hidden transition-all duration-150 relative -top-1.5 active:scale-[0.98] shadow-lg shadow-[#0F2757]/10",
            (!isRecoveryCodesChecked || isCompletingSetup)
              ? "bg-[#0F2757]/40 cursor-default"
              : "bg-primary hover:bg-[#1a3465] active:bg-[#091a3c] cursor-pointer",
          )}
        >
          {isCompletingSetup ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              <span>Saving...</span>
            </span>
          ) : (
            <span className="justify-start text-white text-base font-medium font-figtree">
              Complete Setup
            </span>
          )}
        </button>
      </>
    );
  }

  /* State 0 OTP Inputs and QR App Setup */
  return (
    <div className="self-stretch flex flex-col justify-start items-start gap-6 w-full animate-fadeIn">
      {tfaMethod === "authenticator" && (
        <div className="self-stretch p-6 bg-gray-100 rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-300 flex flex-col justify-start items-start gap-6">
          <div className="flex justify-start items-center gap-2.5">
            <img src="/icons/qr.svg" alt="secure" className="size-5 shrink-0" />
            <span className="justify-start text-gray-800 text-lg font-medium font-figtree">
              Scan QR code with your authenticator app
            </span>
          </div>

          <div className="self-stretch flex flex-col md:flex-row justify-start items-start gap-5">
            {/* QR Code and Download Button */}
            <div className="w-[177px] flex flex-col justify-start items-start gap-2 shrink-0">
              <img
                className="self-stretch h-[177px] rounded-[10px] border border-gray-300 object-contain p-2 bg-white"
                src={qrCodeDataUrl || "/icons/qr1.png"}
                alt="QR Code"
              />
              <button
                type="button"
                onClick={handleDownloadQr}
                className="self-stretch h-[42px] px-3.5 pr-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-[10px] outline outline-1 outline-offset-[-1px] outline-gray-300 flex justify-center items-center gap-2 cursor-pointer transition-colors"
              >
                <svg
                  className="size-4 text-gray-800 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span className="justify-start text-gray-800 text-base font-medium font-figtree">
                  Download QR
                </span>
              </button>
            </div>

            {/* QR Code Meta Details */}
            <div className="flex-1 flex flex-col justify-start items-start gap-4.5 w-full">
              <div className="flex flex-col justify-start items-start">
                <span className="text-gray-500 text-sm font-normal font-figtree leading-[100%]">
                  Issuer
                </span>
                <span className="text-gray-800 text-base font-medium font-figtree">
                  FlyVoid Admin
                </span>
              </div>

              <div className="flex flex-col justify-start items-start">
                <span className="text-gray-500 text-sm font-normal font-figtree leading-[100%]">
                  Account
                </span>
                <span className="text-gray-800 text-base font-medium font-figtree">
                  {email}
                </span>
              </div>

              <div className="self-stretch flex flex-col justify-start items-start gap-1 w-full">
                <span className="text-gray-500 text-sm font-normal font-figtree">
                  Secret Key
                </span>
                <div className="self-stretch flex justify-start items-center gap-2 w-full">
                  <div className="flex-1 px-3 py-2 bg-white rounded-lg outline outline-1 outline-offset-[-1px] outline-gray-300 flex justify-start items-start">
                    <span className="text-gray-800 text-base font-medium font-figtree select-all break-all">
                      {manualEntryKey || "JBSWY3DPEHPK3PXP"}
                    </span>
                  </div>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(
                          manualEntryKey || "JBSWY3DPEHPK3PXP",
                        );
                        setIsCopied(true);
                        setTimeout(() => setIsCopied(false), 2000);
                      }}
                      className="size-9 p-2 bg-gray-100 hover:bg-gray-200 rounded-md outline outline-1 outline-offset-[-1px] outline-gray-300 flex justify-center items-center shrink-0 cursor-pointer transition-colors"
                      title="Copy Secret Key"
                    >
                      <img src="/icons/paste.svg" alt="copy" className="size-4" />
                    </button>
                    {isCopied && (
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-gray-500 text-white text-xs font-medium font-figtree rounded-full whitespace-nowrap shadow-lg animate-fadeIn z-20">
                        Key Copied!
                        <div className="absolute top-[85%] left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-gray-500 rotate-45"></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <p className="text-gray-500 text-sm font-normal font-figtree">
                Can't scan? Enter the secret key manually in your authenticator
                app.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Enter Verification Code Section */}
      <div className={cn(
        "self-stretch flex flex-col justify-start items-start gap-6 w-full pt-5.5",
        tfaMethod === "authenticator" && "border-t border-gray-200 relative -top-1"
      )}>
        <div className="flex flex-col justify-start items-start gap-1">
          <div className="justify-start text-gray-800 text-lg font-semibold font-figtree">
            Enter verification code
          </div>
          <div className="justify-start text-gray-500 text-sm font-normal font-figtree leading-[100%]">
            {tfaMethod === "email"
              ? `Enter the 6-digit code sent to ${email}`
              : "Enter the 6-digit code from your authenticator app"}
          </div>
        </div>

        <div className="self-stretch flex flex-wrap justify-start items-start gap-3 w-full">
          {/* OTP Input Fields Wrapper */}
          <div className="flex flex-col items-start gap-2">
            <div className={cn(
              "h-11 rounded-lg outline outline-1 inline-flex items-center overflow-hidden bg-gray-50/50 transition-all",
              hasError ? "outline-rose-300 focus-within:ring-2 focus-within:ring-rose-500/10 focus-within:outline-rose-400" : "outline-gray-300 focus-within:ring-2 focus-within:ring-[#0F2757]/10 focus-within:outline-[#0F2757]"
            )}>
              {otpValues.map((digit, idx) => (
                <input
                  key={idx}
                  id={`otp-${idx}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(idx, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                  onPaste={idx === 0 ? handlePaste : undefined}
                  disabled={isVerifying}
                  className={cn(
                    "w-11 h-11 text-center bg-transparent border-r last:border-r-0 outline-none text-gray-800 font-semibold font-figtree text-lg focus:bg-white transition-colors disabled:opacity-70",
                    hasError ? "border-rose-200" : "border-gray-300"
                  )}
                />
              ))}
            </div>
            {error && (
              <span className="text-rose-500 text-xs font-medium font-figtree pl-1 animate-fadeIn">
                {error}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-start items-center gap-2.5">
            <button
              type="button"
              onClick={handleVerify}
              disabled={isVerifying}
              className="h-11 px-4 py-3 bg-primary hover:bg-[#1a3465] active:bg-[#091a3c] active:scale-[0.98] text-white text-base font-medium font-figtree rounded-[10px] flex justify-center items-center cursor-pointer transition-all shadow-lg shadow-[#0F2757]/10 disabled:opacity-75 disabled:cursor-default"
            >
              {isVerifying ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>Verifying...</span>
                </span>
              ) : (
                <span>Verify & Enable</span>
              )}
            </button>
            <button
              type="button"
              onClick={onCancel}
              disabled={isVerifying}
              className="h-11 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 text-base font-medium font-figtree rounded-[10px] outline outline-1 outline-offset-[-1px] outline-gray-200 flex justify-center items-center cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-default"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
