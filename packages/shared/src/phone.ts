const BANGLA_DIGITS = '০১২৩৪৫৬৭৮৯'

/** Converts Bangla digits to ASCII, e.g. '০১৭' → '017'. */
export function toAsciiDigits(text: string): string {
  return text.replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)))
}

/**
 * Normalises a Bangladeshi mobile number to 11 digits ('01XXXXXXXXX').
 * Accepts Bangla digits, spaces, dashes and the +880 / 880 prefixes. Returns null if invalid.
 */
export function normalizePhone(input: string): string | null {
  let digits = toAsciiDigits(input).replace(/[\s\-().]/g, '')
  if (digits.startsWith('+880')) digits = '0' + digits.slice(4)
  else if (digits.startsWith('880')) digits = '0' + digits.slice(3)
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null
}

/** '01712345678' → '01712-345678' for display. */
export function formatPhone(phone: string): string {
  return phone.length === 11 ? `${phone.slice(0, 5)}-${phone.slice(5)}` : phone
}
