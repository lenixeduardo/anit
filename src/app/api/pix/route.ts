import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createPixPayload, PIX_KEY } from "@/lib/pix";
export async function GET() {
  const payload = createPixPayload();
  const qr = await QRCode.toDataURL(payload, { width: 512, margin: 4, errorCorrectionLevel: "M" });
  return NextResponse.json({ key: PIX_KEY, receiver: "ANIT HEADSHOP", city: "SAO PAULO", payload, qr });
}
