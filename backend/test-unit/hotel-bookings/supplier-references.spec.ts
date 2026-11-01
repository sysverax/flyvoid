import { describe, expect, it } from "@jest/globals";
import {
  supplierReferencesOf,
  supplierReferenceText,
} from "../../src/hotel-bookings/supplier-references";

const room = (
  roomNo: number,
  partnerOrderId: string | null,
  providerOrderId: string | null = null,
  status = "booked",
) => ({ roomNo, status, partnerOrderId, providerOrderId });

describe("supplierReferencesOf", () => {
  it("Hotelbeds: uses the stored booking reference exactly, one group per reference", () => {
    const refs = supplierReferencesOf({
      providerCode: "hotelbeds",
      rooms: [room(2, "102-7654321"), room(1, "102-1234567"), room(3, "102-1234567")],
      orderInfo: null,
    });
    expect(refs.missingRooms).toEqual([]);
    expect(refs.groups).toEqual([
      { rooms: [1, 3], reference: "102-1234567", hotelConfirmation: null },
      { rooms: [2], reference: "102-7654321", hotelConfirmation: null },
    ]);
    expect(supplierReferenceText(refs)).toBe("102-1234567, 102-7654321");
  });

  it("RateHawk: uses ETG's order id, never our partner_order_id", () => {
    const refs = supplierReferencesOf({
      providerCode: "ratehawk",
      rooms: [room(1, "our-uuid-1", "987654321"), room(2, "our-uuid-1", "987654321")],
      orderInfo: [
        { partner_data: { order_id: "our-uuid-1" }, order_id: 987654321, supplier_data: { confirmation_id: "HTL-55" } },
      ],
    });
    expect(refs.groups).toEqual([
      { rooms: [1, 2], reference: "987654321", hotelConfirmation: "HTL-55" },
    ]);
  });

  it("RateHawk: falls back to the order id in the stored order info", () => {
    const refs = supplierReferencesOf({
      providerCode: "ratehawk",
      rooms: [room(1, "our-uuid-2", null)],
      orderInfo: [{ partner_data: { order_id: "our-uuid-2" }, order_id: 1122, supplier_data: { confirmation_id: null } }],
    });
    expect(refs.groups).toEqual([{ rooms: [1], reference: "1122", hotelConfirmation: null }]);
    expect(refs.missingRooms).toEqual([]);
  });

  it("reports rooms with no reference instead of substituting another value", () => {
    const ratehawk = supplierReferencesOf({
      providerCode: "ratehawk",
      rooms: [room(1, "our-uuid-3", null)],
      orderInfo: null,
    });
    expect(ratehawk.groups).toEqual([]);
    expect(ratehawk.missingRooms).toEqual([1]);

    const hotelbeds = supplierReferencesOf({
      providerCode: "hotelbeds",
      rooms: [room(1, "102-1"), room(2, null)],
      orderInfo: null,
    });
    expect(hotelbeds.missingRooms).toEqual([2]);
  });

  it("ignores failed rooms and treats a booking with no rooms as missing", () => {
    expect(
      supplierReferencesOf({
        providerCode: "hotelbeds",
        rooms: [room(1, "102-1"), room(2, null, null, "failed")],
        orderInfo: null,
      }).missingRooms,
    ).toEqual([]);
    expect(
      supplierReferencesOf({ providerCode: "hotelbeds", rooms: [], orderInfo: null }).missingRooms,
    ).toEqual([1]);
  });
});
