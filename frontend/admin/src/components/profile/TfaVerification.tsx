"use client";

import { useState } from "react";
import { cn } from "@/src/lib/utils";

interface TfaVerificationProps {
  tfaMethod: "email" | "authenticator";
  email: string;
  onCompleteSetup: () => void;
  onCancel: () => void;
  showToast: (message: string, type?: "success" | "warning" | "info") => void;
  isShowingRecoveryCodes: boolean;
  setIsShowingRecoveryCodes: (val: boolean) => void;
}

const RECOVERY_CODES = [
  "G7E9K-67G5D",
  "Y2T4X-89W1V",
  "H8F0L-78H6E",
  "Z3U5Y-90X2W",
  "I9G1M-89I7F",
  "A4V6Z-01Y3X",
  "J0H2N-90J8G",
  "B5W7A-12Z4Y",
  "K1I3O-01K9H",
  "C6X8B-23A5Z",
];

export function TfaVerification({
  tfaMethod,
  email,
  onCompleteSetup,
  onCancel,
  showToast,
  isShowingRecoveryCodes,
  setIsShowingRecoveryCodes,
}: TfaVerificationProps) {
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(""));
  const [isRecoveryCodesChecked, setIsRecoveryCodesChecked] = useState(false);

  const handleOtpChange = (index: number, val: string) => {
    if (/[^0-9]/.test(val)) return;
    const newOtp = [...otpValues];
    newOtp[index] = val;
    setOtpValues(newOtp);
    if (val && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleOtpKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !otpValues[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handleVerify = () => {
    const code = otpValues.join("");
    if (code.length < 6) {
      showToast("Please enter a valid 6-digit code.", "warning");
      return;
    }
    if (tfaMethod === "email") {
      onCompleteSetup();
    } else {
      setIsShowingRecoveryCodes(true);
      setIsRecoveryCodesChecked(false);
    }
  };

  const handleCopyCodes = () => {
    navigator.clipboard.writeText(RECOVERY_CODES.join("\n"));
    showToast("Recovery codes copied to clipboard!", "success");
  };

  const handleDownloadCodes = () => {
    const element = document.createElement("a");
    const file = new Blob([RECOVERY_CODES.join("\n")], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = "flyvoid-recovery-codes.txt";
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    showToast("Recovery codes downloaded successfully!", "success");
  };

  if (isShowingRecoveryCodes) {
    /* State 1: Recovery Codes View */
    return (
      <>
        <div className="justify-start text-gray-800 text-lg font-medium font-figtree">
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
                <div className="justify-start text-gray-800 text-base font-medium font-figtree">
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
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="self-stretch inline-flex justify-start items-center gap-3"
              >
                <div className="flex-1 px-3 py-2 bg-white rounded-lg outline outline-1 outline-offset-[-1px] outline-gray-300 flex justify-center items-center gap-2.5">
                  <div className="justify-start text-gray-800 text-base font-medium font-figtree">
                    {RECOVERY_CODES[i * 2]}
                  </div>
                </div>
                <div className="flex-1 px-3 py-2 bg-white rounded-lg outline outline-1 outline-offset-[-1px] outline-gray-300 flex justify-center items-center gap-2.5">
                  <div className="justify-start text-gray-800 text-base font-medium font-figtree">
                    {RECOVERY_CODES[i * 2 + 1]}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="inline-flex justify-start items-start gap-3">
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
          onClick={onCompleteSetup}
          disabled={!isRecoveryCodesChecked}
          className={cn(
            "px-4 py-3 bg-blue-950 rounded-[10px] inline-flex justify-center items-center overflow-hidden transition-all duration-200 cursor-pointer relative top-0.5",
            !isRecoveryCodesChecked
              ? "opacity-40 pointer-events-none"
              : "hover:bg-primary-hover opacity-100",
          )}
        >
          <div className="justify-start text-white text-base font-medium font-figtree">
            Complete Setup
          </div>
        </button>
      </>
    );
  }

  /* State 0 OTP Inputs and QR App Setup */
  return (
    <div className="self-stretch flex flex-col justify-start items-start gap-6 pt-6 border-t border-gray-200 w-full animate-fadeIn">
      {tfaMethod === "authenticator" && (
        <div className="self-stretch p-6 bg-gray-100 rounded-xl outline outline-1 outline-offset-[-1px] outline-gray-300 flex flex-col justify-start items-start gap-6">
          <div className="flex justify-start items-center gap-2">
            <img src="/icons/qr.svg" alt="secure" className="size-5 shrink-0" />
            <span className="justify-start text-gray-800 text-lg font-medium font-figtree leading-[130%]">
              Scan QR code with your authenticator app
            </span>
          </div>

          <div className="self-stretch flex flex-col md:flex-row justify-start items-start gap-5">
            {/* QR Code and Download Button */}
            <div className="w-[177px] flex flex-col justify-start items-start gap-2 shrink-0">
              <img
                className="self-stretch h-[177px] rounded-[10px] border border-gray-300"
                src="/icons/qr1.png"
                alt="QR Code"
              />
              <button
                type="button"
                onClick={() =>
                  showToast("QR code downloaded successfully!", "success")
                }
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
                      JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(
                        "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
                      );
                      showToast("Secret key copied to clipboard!", "success");
                    }}
                    className="size-9 p-2 bg-gray-100 hover:bg-gray-200 rounded-md outline outline-1 outline-offset-[-1px] outline-gray-300 flex justify-center items-center shrink-0 cursor-pointer transition-colors"
                    title="Copy Secret Key"
                  >
                    <img src="/icons/paste.svg" alt="copy" className="size-4" />
                  </button>
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
      <div className="self-stretch flex flex-col justify-start items-start gap-6 w-full">
        <div className="flex flex-col justify-start items-start gap-1.5">
          <div className="justify-start text-gray-800 text-lg font-semibold font-figtree">
            Enter verification code
          </div>
          <div className="justify-start text-gray-500 text-sm font-normal font-figtree">
            {tfaMethod === "email"
              ? `Enter the 6-digit code sent to ${email}`
              : "Enter the 6-digit code from your authenticator app"}
          </div>
        </div>

        <div className="self-stretch flex flex-wrap justify-start items-center gap-4 w-full">
          {/* OTP Input Fields */}
          <div className="h-11 rounded-lg outline outline-1 outline-gray-300 inline-flex items-center overflow-hidden bg-gray-50/50">
            {otpValues.map((digit, idx) => (
              <input
                key={idx}
                id={`otp-${idx}`}
                type="text"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(idx, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                className="w-11 h-11 text-center bg-transparent border-r last:border-r-0 border-gray-300 outline-none text-gray-800 font-semibold font-figtree text-lg focus:bg-white transition-colors"
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex justify-start items-center gap-2.5">
            <button
              type="button"
              onClick={handleVerify}
              className="h-11 px-4 py-3 bg-blue-950 hover:bg-primary-hover text-white text-base font-medium font-figtree rounded-[10px] flex justify-center items-center cursor-pointer transition-colors shadow-sm"
            >
              Verify & Enable
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="h-11 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 text-base font-medium font-figtree rounded-[10px] outline outline-1 outline-offset-[-1px] outline-gray-200 flex justify-center items-center cursor-pointer transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
