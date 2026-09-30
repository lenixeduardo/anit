export const PIX_KEY = "66062904000150";
export function crc16(value: string): string {
  let crc = 0xffff;
  for (const byte of new TextEncoder().encode(value)) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) crc = ((crc << 1) ^ ((crc & 0x8000) ? 0x1021 : 0)) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}
function field(id: string, value: string): string {
  const length = new TextEncoder().encode(value).length;
  if (length > 99) throw new Error("Campo Pix muito longo");
  return id + String(length).padStart(2, "0") + value;
}
export function createPixPayload(cents?: number, txid = "***"): string {
  if (cents !== undefined && (!Number.isSafeInteger(cents) || cents <= 0 || cents > 999999999)) throw new Error("Valor Pix inválido");
  if (txid !== "***" && !/^[a-zA-Z0-9]{1,25}$/.test(txid)) throw new Error("Identificador Pix inválido");
  const payload = field("00", "01") + field("26", field("00", "br.gov.bcb.pix") + field("01", PIX_KEY))
    + field("52", "0000") + field("53", "986") + (cents === undefined ? "" : field("54", (cents / 100).toFixed(2)))
    + field("58", "BR") + field("59", "ANIT HEADSHOP") + field("60", "SAO PAULO")
    + field("62", field("05", txid)) + "6304";
  return payload + crc16(payload);
}
