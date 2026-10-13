"use client";

import { use, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import PublishedDetailView from "../PublishedDetailView";
import CancelledFlightNotFound from "../CancelledFlightNotFound";
import { cancellationService } from "@/src/services/cancellation.service";
import { getMaxAllowedStep } from "../CancellationWizard";
import { Loader2 } from "lucide-react";

interface PublishedPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default function CancelledFlightPublishedPage({
  params,
}: PublishedPageProps) {
  const router = useRouter();
  const { id } = use(params);

  const [isLoading, setIsLoading] = useState(true);
  const [isNotFound, setIsNotFound] = useState(false);

  const flightIdNum = useMemo(() => {
    const parsed = Number(id);
    return isNaN(parsed) || parsed <= 0 ? null : parsed;
  }, [id]);

  useEffect(() => {
    if (!flightIdNum) {
      setIsNotFound(true);
      setIsLoading(false);
      return;
    }

    let isMounted = true;

    const checkFlight = async () => {
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

        const status = (flight?.status || "").toLowerCase();

        if (status !== "published") {
          const summary = res?.data?.summary || (res as any)?.summary;
          const furthestStep = getMaxAllowedStep(flight, summary);
          router.replace(`/cancelled-flight/${id}/step-${furthestStep}`);
          return;
        }

        if (isMounted) {
          setIsLoading(false);
        }
      } catch {
        if (isMounted) {
          setIsNotFound(true);
          setIsLoading(false);
        }
      }
    };

    checkFlight();

    return () => {
      isMounted = false;
    };
  }, [flightIdNum, id, router]);

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
      <PublishedDetailView
        flightId={id}
        onClose={() => {
          router.push("/cancelled-flight");
        }}
      />
    </div>
  );
}
