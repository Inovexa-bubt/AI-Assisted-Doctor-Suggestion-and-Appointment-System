import { type Lang, type Localized, addDays, dhakaDate, toMinutes } from '@inovexa/shared'

const locale = (lang: Lang) => (lang === 'bn' ? 'bn-BD' : 'en-GB')

export const pick = (text: Localized, lang: Lang) => text[lang] || text.en

export function formatNumber(n: number, lang: Lang, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale(lang), options).format(n)
}

export function formatMoney(taka: number, lang: Lang): string {
  return `৳${formatNumber(taka, lang)}`
}

export function formatPercent(ratio: number, lang: Lang): string {
  return formatNumber(ratio, lang, { style: 'percent', maximumFractionDigits: 1 })
}

type DateStyle = 'short' | 'medium' | 'long' | 'weekday' | 'day'

const DATE_OPTIONS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  short: { day: 'numeric', month: 'short' },
  medium: { weekday: 'short', day: 'numeric', month: 'short' },
  long: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
  weekday: { weekday: 'short' },
  day: { day: 'numeric' },
}

/** Formats a 'YYYY-MM-DD' date. The date has no time zone, so it is formatted as UTC. */
export function formatDate(date: string, lang: Lang, style: DateStyle = 'medium'): string {
  return new Intl.DateTimeFormat(locale(lang), { timeZone: 'UTC', ...DATE_OPTIONS[style] }).format(
    new Date(`${date}T00:00:00Z`),
  )
}

function banglaPeriod(hour: number): string {
  if (hour >= 4 && hour < 6) return 'ভোর'
  if (hour < 12 && hour >= 6) return 'সকাল'
  if (hour < 15 && hour >= 12) return 'দুপুর'
  if (hour < 18 && hour >= 15) return 'বিকাল'
  if (hour < 20 && hour >= 18) return 'সন্ধ্যা'
  return 'রাত'
}

/** 'HH:mm' → '5:30 PM' or 'বিকাল ৫:৩০'. */
export function formatTime(time: string, lang: Lang): string {
  const minutes = toMinutes(time)
  const hour = Math.floor(minutes / 60)
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  const mm = String(minutes % 60).padStart(2, '0')
  if (lang === 'bn') {
    return `${banglaPeriod(hour)} ${formatNumber(h12, lang)}:${formatNumber(Number(mm[0]), lang)}${formatNumber(Number(mm[1]), lang)}`
  }
  return `${h12}:${mm} ${hour < 12 ? 'AM' : 'PM'}`
}

/** 'Today', 'Tomorrow' or a short date. */
export function formatDay(
  date: string,
  lang: Lang,
  labels: { today: string; tomorrow: string },
): string {
  const today = dhakaDate()
  if (date === today) return labels.today
  if (date === addDays(today, 1)) return labels.tomorrow
  return formatDate(date, lang, 'medium')
}

export function initials(name: string): string {
  const words = name
    .replace(/^(Dr\.|ডা\.)\s*/, '')
    .split(/\s+/)
    .filter(Boolean)
  return words
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
}
