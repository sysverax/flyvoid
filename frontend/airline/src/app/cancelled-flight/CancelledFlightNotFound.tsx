"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, AlertCircle } from "lucide-react";

interface CancelledFlightNotFoundProps {
  id?: string;
  onBack?: () => void;
}

export default function CancelledFlightNotFound({
  id,
  onBack,
}: CancelledFlightNotFoundProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push("/cancelled-flight");
    }
  };

  return (
    <div className="flex min-h-[500px] w-full flex-col items-center justify-center p-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-red-50 text-red-500 mb-5 border border-red-100 shadow-sm">
        <AlertCircle className="h-10 w-10" />
      </div>
      <h2 className="text-2xl font-bold text-[#1F2937] mb-2 font-figtree">
        Cancelled Flight Not Found
      </h2>
      <p className="text-[#6B7280] max-w-md text-base mb-6 leading-relaxed">
        {id
          ? `The cancelled flight record with ID "${id}" could not be found or does not exist.`
          : "The requested cancelled flight could not be found or does not exist."}
      </p>
      <button
        type="button"
        onClick={handleBack}
        className="inline-flex items-center gap-2 rounded-[10px] bg-[#0F2757] hover:bg-[#162259] px-5 py-2.5 text-sm font-medium text-white transition-colors duration-200 cursor-pointer shadow-sm"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Back to Cancelled Flights</span>
      </button>
    </div>
  );
}
