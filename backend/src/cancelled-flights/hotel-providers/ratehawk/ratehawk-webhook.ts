import * as crypto from "node:crypto";

export interface RatehawkBookingWebhook {
  partnerOrderId: string;
  status: string;
  signature: string;
  timestamp: number;
  token: string;
}

/** ETG sends `{ data: {...}, signature: {...} }`; some setups send the fields at the top level. */
export function parseRatehawkBookingWebhook(
  body: unknown,
): RatehawkBookingWebhook | null {
  if (!body || typeof body !== "object") return null;
  const root = body as Record<string, any>;
  const data = root.data && typeof root.data === "object" ? root.data : root;
  const signed =
    root.signature && typeof root.signature === "object"
      ? root.signature
      : root;

  const partnerOrderId = String(data.partner_order_id ?? "").trim();
  const status = String(data.status ?? "")
    .trim()
    .toLowerCase();
  const signature = String(signed.signature ?? "").trim();
  const token = String(signed.token ?? "").trim();
  const timestamp = Number(signed.timestamp);
  if (
    !partnerOrderId ||
    !status ||
    !signature ||
    !token ||
    !Number.isFinite(timestamp)
  ) {
    return null;
  }
  return { partnerOrderId, status, signature, timestamp, token };
}

/** HMAC-SHA256 of `${timestamp}${token}` keyed with our API key, hex encoded. */
export function isValidRatehawkSignature(
  webhook: Pick<RatehawkBookingWebhook, "signature" | "timestamp" | "token">,
  apiKey: string,
): boolean {
  if (!apiKey) return false;
  const expected = crypto
    .createHmac("sha256", apiKey)
    .update(`${webhook.timestamp}${webhook.token}`)
    .digest("hex");
  const received = webhook.signature.toLowerCase();
  return (
    received.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected))
  );
}
