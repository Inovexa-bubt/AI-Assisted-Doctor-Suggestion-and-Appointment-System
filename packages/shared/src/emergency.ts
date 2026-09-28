import { findKeywords } from './text-match.ts'

/**
 * The fixed emergency keyword list. It runs before the AI on every message, in the browser for an
 * instant notice and again on the server. Negations ("no chest pain") still match on purpose:
 * showing the notice when it was not needed is safer than missing an emergency.
 *
 * Draft list: to be reviewed with the client's doctors.
 */
export const EMERGENCY_PHRASES: readonly string[] = [
  // English
  'chest pain',
  'pain in my chest',
  'pain in the chest',
  'heart attack',
  "can't breathe",
  'cant breathe',
  'cannot breathe',
  'can not breathe',
  'unable to breathe',
  'difficulty breathing',
  'difficulty in breathing',
  'breathing difficulty',
  'trouble breathing',
  'short of breath',
  'shortness of breath',
  'heavy bleeding',
  'bleeding heavily',
  'severe bleeding',
  'bleeding a lot',
  'vomiting blood',
  'coughing blood',
  'coughing up blood',
  'unconscious',
  'fainted',
  'passed out',
  'not responding',
  'seizure',
  'convulsion',
  'stroke',
  'face drooping',
  'slurred speech',
  'paralysed',
  'paralyzed',
  'paralysis',
  'suicide',
  'kill myself',
  'poisoning',
  'swallowed poison',
  'overdose',
  'severe burn',
  'snake bite',
  'snakebite',
  // Bangla
  'বুকে ব্যথা',
  'বুক ব্যথা',
  'বুকের ব্যথা',
  'বুকে চাপ',
  'হার্ট অ্যাটাক',
  'হার্ট এটাক',
  'শ্বাস নিতে কষ্ট',
  'শ্বাস নিতে পারছি না',
  'শ্বাস নিতে পারছে না',
  'শ্বাসকষ্ট',
  'শ্বাস কষ্ট',
  'দম বন্ধ',
  'প্রচুর রক্তপাত',
  'অনেক রক্ত',
  'রক্ত বমি',
  'রক্তক্ষরণ',
  'কাশির সাথে রক্ত',
  'অজ্ঞান',
  'জ্ঞান হারিয়ে',
  'খিঁচুনি',
  'স্ট্রোক',
  'প্যারালাইসিস',
  'মুখ বেঁকে',
  'আত্মহত্যা',
  'বিষ খেয়ে',
  'বিষ খেয়েছে',
  'সাপে কামড়',
  'পুড়ে গেছে',
  // Romanised Bangla
  'buke betha',
  'buke batha',
  'buk betha',
  'shash kosto',
  'shashkosto',
  'sash kosto',
  'onek rokto',
  'ogyan',
]

const ENTRIES = EMERGENCY_PHRASES.map((keyword) => ({ keyword, value: keyword }))

/** Emergency phrases found in the text; empty when none. */
export function checkEmergency(text: string): string[] {
  return [...new Set(findKeywords(text, ENTRIES).map((m) => m.value))]
}
