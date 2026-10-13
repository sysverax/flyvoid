"use client";

import { useRouter } from "next/navigation";
import CancellationWizard from "../CancellationWizard";

export default function CreateCancelledFlightPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      <CancellationWizard
        initialStep={1}
        onClose={() => {
          router.push("/cancelled-flight");
        }}
        onStepChange={(nextStep, flightId) => {
          if (flightId) {
            router.push(`/cancelled-flight/${flightId}/step-${nextStep}`);
          }
        }}
        onSave={() => {
          router.push("/cancelled-flight");
        }}
      />
    </div>
  );
}
