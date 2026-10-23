"use client";

import { use, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import CancellationWizard, {
  getMaxAllowedStep,
} from "../../CancellationWizard";
import CancelledFlightNotFound from "../../CancelledFlightNotFound";
import {
  cancellationService,
  ReviewFlightResponse,
} from "@/src/services/cancellation.service";
import { Loader2 } from "lucide-react";

interface StepPageProps {
  params: Promise<{
    id: string;
    step: string;
  }>;
}

export default function CancelledFlightStepPage({ params }: StepPageProps) {
  const router = useRouter();
  const { id, step } = use(params);

  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);
  const [review, setReview] = useState<ReviewFlightResponse | null>(null);
  const allowedRef = useRef<{ flightId: number; maxStep: number } | null>(
    null,
  );

  const flightIdNum = useMemo(() => {
    const parsed = Number(id);
    return isNaN(parsed) || parsed <= 0 ? null : parsed;
  }, [id]);

  const stepNumber = useMemo(() => {
    const parsed = parseInt(step.replace(/^step-?/i, ""), 10);
    return isNaN(parsed) || parsed < 1 || parsed > 7 ? 1 : parsed;
  }, [step]);

  useEffect(() => {
    if (!flightIdNum) {
      setIsNotFound(true);
      setIsLoading(false);
      return;
    }

    // The max step only grows while the flight is open, so lower steps are allowed.
    const allowed = allowedRef.current;
    if (allowed?.flightId === flightIdNum && stepNumber <= allowed.maxStep) {
      return;
    }

    let isMounted = true;

    const validateStepAccess = async () => {
      try {
        const res = await cancellationService.reviewFlight(flightIdNum);
        const flight = res?.data?.flight || (res as any)?.flight;

        if (!flight) {
          if (isMounted) {
            setIsNotFound(true);
            setIsLoading(false);
          }
          return;
        }

        const status = (flight.status || "").toLowerCase();

        // 1. Opening step URLs of a published record redirects to /cancelled-flight/{id}
        if (status === "published") {
          router.replace(`/cancelled-flight/${id}`);
          return;
        }

        // 2. Opening a step beyond the user's progress redirects to the furthest allowed step
        const summary = res?.data?.summary || (res as any)?.summary;
        const maxStep = getMaxAllowedStep(flight, summary);
        allowedRef.current = { flightId: flightIdNum, maxStep };

        if (stepNumber > maxStep) {
          router.replace(`/cancelled-flight/${id}/step-${maxStep}`);
          return;
        }

        if (isMounted) {
          setReview(res?.data || (res as any));
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setIsNotFound(true);
          setIsLoading(false);
        }
      }
    };

    validateStepAccess();

    return () => {
      isMounted = false;
    };
  }, [flightIdNum, id, stepNumber, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] w-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#0F2757]" />
      </div>
    );
  }

  if (isNotFound) {
    return (
      <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
        <CancelledFlightNotFound id={id} />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      <CancellationWizard
        flightId={flightIdNum}
        initialStep={stepNumber}
        initialReview={review}
        onClose={() => {
          router.push("/cancelled-flight");
        }}
        onStepChange={(nextStep, currentFlightId) => {
          const fId = currentFlightId || id;
          router.push(`/cancelled-flight/${fId}/step-${nextStep}`);
        }}
        onSave={() => {
          router.push(`/cancelled-flight/${id}`);
        }}
      />
    </div>
  );
}
