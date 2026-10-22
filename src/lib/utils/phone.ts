export function normalizePhone(input: string): string | null {
  const compact = input.replace(/[\s()-]/g, "");
  const match = compact.match(/^(?:\+91|91|0)?([6-9]\d{9})$/);
  if (!match?.[1]) return null;
  return `+91${match[1]}`;
}

export function maskPhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "Hidden";
  return `${digits.slice(0, 2)}•••••${digits.slice(-2)}`;
}
