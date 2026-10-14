import { NextResponse } from "next/server";
import QRCode from "qrcode";
import { createPixPayload, PIX_KEY } from "@/lib/pix";
export async function GET() {
  if(process.env.PAYMENT_PROVIDER === 'mercadopago') return NextResponse.json({error:'Utilize a cobrança vinculada ao pedido'},{status:410});
  const payload = createPixPayload();
  const qr = await QRCode.toDataURL(payload, { width: 512, margin: 4, errorCorrectionLevel: "M" });
  return NextResponse.json({ key: PIX_KEY, receiver: "ANIT HEADSHOP", city: "SAO PAULO", payload, qr });
}
