export function normalizeWhatsapp(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
}

export function whatsappInternational(value: string) {
  return `55${normalizeWhatsapp(value)}`;
}

export function formatWhatsapp(value: string) {
  const digits = normalizeWhatsapp(value).slice(0, 11);
  if (digits.length <= 2) return digits ? `(${digits}` : "";
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

export function isValidWhatsapp(value: string) {
  const digits = normalizeWhatsapp(value);
  return digits.length === 10 || digits.length === 11;
}
