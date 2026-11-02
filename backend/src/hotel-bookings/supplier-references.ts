/**
 * The supplier's booking references for a confirmed hotel booking, for the
 * voucher and the portals. Values are shown exactly as the supplier issued
 * them; nothing is generated, shortened or reformatted.
 *
 * Where each supplier's reference is stored (hotel_booking_rooms):
 * - Hotelbeds: booking.reference from the Bookings API -> partner_order_id.
 * - RateHawk (ETG): ETG's order_id -> provider_order_id. partner_order_id is
 *   our own partner_order_id (a UUID we generate), not a supplier reference.
 *   The hotel's own confirmation number is in the stored order info
 *   (hotel_bookings.provider_order_info[].supplier_data.confirmation_id) once
 *   ETG has it.
 */

/** One stored room of a hotel booking, with its references. */
export interface SupplierRoomSource {
  roomNo: number;
  status: string;
  partnerOrderId: string | null;
  providerOrderId: string | null;
}

export interface SupplierReferenceSource {
  /** providers.code, e.g. "ratehawk", "hotelbeds". */
  providerCode: string;
  rooms: SupplierRoomSource[];
  /** Raw supplier order info (RateHawk hotel/order/info), when fetched. */
  orderInfo: unknown[] | null;
}

export interface SupplierReferenceGroup {
  /** Room numbers (1-based) the reference covers. */
  rooms: number[];
  /** The supplier's booking reference, exactly as issued. */
  reference: string;
  /** The hotel's own confirmation number, when the supplier gives it. */
  hotelConfirmation: string | null;
}

export interface SupplierReferences {
  provider: string;
  /** One entry per distinct reference, in room order. */
  groups: SupplierReferenceGroup[];
  /** Booked rooms with no supplier reference stored. */
  missingRooms: number[];
}

const text = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const result = String(value).trim();
  return result ? result : null;
};

/** RateHawk order info for one partner_order_id. */
function ratehawkOrderInfo(
  orderInfo: unknown[] | null,
  partnerOrderId: string | null,
): Record<string, any> | null {
  if (!Array.isArray(orderInfo) || !partnerOrderId) return null;
  return (
    (orderInfo as Array<Record<string, any>>).find(
      (order) =>
        text(order?.partner_data?.order_id) === partnerOrderId ||
        text(order?.partner_order_id) === partnerOrderId,
    ) ?? null
  );
}

export function supplierReferencesOf(
  source: SupplierReferenceSource,
): SupplierReferences {
  const provider = source.providerCode.trim().toLowerCase();
  const booked = [...source.rooms]
    .filter((room) => room.status !== "failed")
    .sort((a, b) => a.roomNo - b.roomNo);

  const groups: SupplierReferenceGroup[] = [];
  const missingRooms: number[] = [];
  for (const room of booked) {
    let reference: string | null;
    let hotelConfirmation: string | null = null;
    if (provider === "ratehawk") {
      const info = ratehawkOrderInfo(source.orderInfo, room.partnerOrderId);
      reference = text(room.providerOrderId) ?? text(info?.order_id);
      hotelConfirmation = text(info?.supplier_data?.confirmation_id);
    } else {
      reference = text(room.partnerOrderId);
    }
    if (!reference) {
      missingRooms.push(room.roomNo);
      continue;
    }
    const existing = groups.find((group) => group.reference === reference);
    if (existing) {
      existing.rooms.push(room.roomNo);
      existing.hotelConfirmation ??= hotelConfirmation;
    } else {
      groups.push({ rooms: [room.roomNo], reference, hotelConfirmation });
    }
  }
  if (booked.length === 0) missingRooms.push(1);
  return { provider, groups, missingRooms };
}

/** All references joined for display in lists: "R1, R2". */
export const supplierReferenceText = (references: SupplierReferences): string =>
  references.groups.map((group) => group.reference).join(", ");

/** Why a confirmed booking's voucher cannot be issued. */
export const VOUCHER_ISSUE = {
  SUPPLIER_REFERENCE_MISSING: "SUPPLIER_REFERENCE_MISSING",
} as const;
export type VoucherIssue = (typeof VOUCHER_ISSUE)[keyof typeof VOUCHER_ISSUE];
