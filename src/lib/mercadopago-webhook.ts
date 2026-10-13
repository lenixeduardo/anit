import { createHmac, timingSafeEqual } from "node:crypto";

/** Verifies Mercado Pago Webhooks. Never trust payment status from the request body. */
export function verifyMercadoPagoSignature(args: {
  dataId: string; requestId: string; signature: string; secret: string;
  now?: number;
}): boolean {
  const parts = Object.fromEntries(args.signature.split(",").map(part => {
    const index = part.indexOf("=");
    return index < 0 ? ["", ""] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
  }));
  if (!/^\d+$/.test(parts.ts || "") || !/^[a-f0-9]{64}$/i.test(parts.v1 || "")) return false;
  const ms = Number(parts.ts);
  if (!Number.isFinite(ms) || Math.abs((args.now ?? Date.now()) - ms) > 5 * 60_000) return false;
  if (!args.dataId || !args.requestId || !args.secret) return false;
  const manifest = `id:${args.dataId.toLowerCase()};request-id:${args.requestId};ts:${parts.ts};`;
  const expected = createHmac("sha256", args.secret).update(manifest).digest();
  const received = Buffer.from(parts.v1, "hex");
  return expected.length === received.length && timingSafeEqual(expected, received);
}
