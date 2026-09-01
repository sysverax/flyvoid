"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { airlinesService, UpdateAirlineRequest, mapAirlineDTOToAirline } from "@/src/services/airlines.service";
import { getCountryCode } from "@/src/lib/utils";
import { Airline } from "@/src/types/airlines";
import { AirlineDetailsView } from "@/src/components/airlines/AirlineDetailsView";
import { EditAirlineModal } from "@/src/components/airlines/EditAirlineModal";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";

export default function AirlineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const router = useRouter();
  const [airline, setAirline] = useState<Airline | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editTarget, setEditTarget] = useState<Airline | null>(null);

  useEffect(() => {
    const fetchAirline = async () => {
      try {
        const dto = await airlinesService.getAirlineDetail(Number(resolvedParams.id));
        setAirline(mapAirlineDTOToAirline(dto));
      } catch (error: any) {
        toast.error(error.message || "Failed to fetch airline details");
        router.push("/airlines");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAirline();
  }, [resolvedParams.id, router]);

  const handleSaveEdit = async (updatedFields: Partial<Airline>, assignAirportIds: number[], disableAirportIds: number[]) => {
    if (!editTarget) return;

    setIsSaving(true);
    try {
      const status = editTarget.status;
      const isActive = status === "Active";
      const isSuspended = status === "Suspended";

      const payload: Partial<UpdateAirlineRequest> = {
        name: updatedFields.airlineName,
        code: updatedFields.airlineCode,
        countryCode: getCountryCode(updatedFields.country || "United States"),
        companyRegistrationNumber: updatedFields.companyReg,
        website: updatedFields.website || undefined,
        contactEmail: updatedFields.contactEmail,
        contactPhone: updatedFields.contactPhone,
        timezone: updatedFields.timezone,
        logo: updatedFields.logoUrl || undefined,
        currency: updatedFields.currency,
        address: updatedFields.address,
        isActive,
        isSuspended,
        adminFirstName: updatedFields.adminFirstName,
        adminLastName: updatedFields.adminLastName,
        adminEmail: updatedFields.adminEmail,
        adminJobTitle: updatedFields.adminJobTitle,
      };

      const response = await airlinesService.updateAirline(Number(editTarget.id), payload);
      
      if (assignAirportIds.length > 0 || disableAirportIds.length > 0) {
        await airlinesService.updateAirlineAirportAssignments(Number(editTarget.id), {
          assignAirportIds,
          disableAirportIds,
        });
      }

      toast.success(response.message || "Airline updated successfully");
      setEditTarget(null);

      const mapped = mapAirlineDTOToAirline(response.data);
      setAirline(mapped);
    } catch (err: any) {
      toast.error(err.message || "Failed to update airline");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="mt-4 text-gray-500">Loading airline details...</span>
      </div>
    );
  }

  if (!airline) return null;

  return (
    <div className="flex flex-col pb-16 lg:w-full lg:max-w-[calc(100vw-304px)]">
      <AirlineDetailsView
        airline={airline}
        onBack={() => router.push("/airlines")}
        onEditClick={() => setEditTarget(airline)}
      />
      <EditAirlineModal
        isOpen={!!editTarget}
        airline={editTarget}
        onClose={() => setEditTarget(null)}
        onSave={handleSaveEdit}
        isSaving={isSaving}
      />
    </div>
  );
}
