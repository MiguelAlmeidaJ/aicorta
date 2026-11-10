export function normalizeBrazilianWhatsapp(input: string): string | null {
  if (!/^[+\d\s().-]+$/.test(input.trim())) return null;
  let digits = input.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) digits = digits.slice(2);
  return /^[1-9][0-9]9[0-9]{8}$/.test(digits) ? digits : null;
}
export function whatsappVariants(normalized: string): string[] {
  return [normalized, `+55${normalized}`, `55${normalized}`];
}
