import {
  type AvailabilityDay,
  type Doctor,
  type ScheduleRule,
  type Slot,
  addDays,
} from '@inovexa/shared'
import clsx from 'clsx'
import { CalendarClock, Clock } from 'lucide-react'
import { useState } from 'react'
import { useI18n } from '../i18n/index.ts'
import {
  formatDate,
  formatDay,
  formatMoney,
  formatNumber,
  formatTime,
  pick,
} from '../lib/format.ts'
import { Avatar, Badge } from './ui.tsx'

// 4 October 2026 is a Sunday; adding the weekday gives a date with that weekday.
const weekdayName = (weekday: number, lang: 'en' | 'bn') =>
  formatDate(addDays('2026-10-04', weekday), lang, 'weekday')

/** Groups chamber sessions with the same times: "Sun, Tue, Thu · 5:00 PM – 9:00 PM". */
export function chamberLines(schedule: ScheduleRule[], lang: 'en' | 'bn'): string[] {
  const groups = new Map<string, number[]>()
  for (const rule of [...schedule].sort((a, b) => a.weekday - b.weekday)) {
    const key = `${rule.start}-${rule.end}`
    groups.set(key, [...(groups.get(key) ?? []), rule.weekday])
  }
  // Saturday first: the Bangladeshi work week starts on Saturday.
  const order = (d: number) => (d + 1) % 7
  return [...groups].map(([key, days]) => {
    const [start, end] = key.split('-') as [string, string]
    const names = days.sort((a, b) => order(a) - order(b)).map((d) => weekdayName(d, lang))
    return `${names.join(', ')} · ${formatTime(start, lang)} – ${formatTime(end, lang)}`
  })
}

export function DoctorHeader({
  doctor,
  specialtyName,
  size = 'md',
}: {
  doctor: Doctor
  specialtyName?: string
  size?: 'md' | 'lg'
}) {
  const { t, lang } = useI18n()
  return (
    <div className="flex gap-4">
      <Avatar name={doctor.name.en} size={size === 'lg' ? 'lg' : 'md'} />
      <div className="min-w-0">
        <p
          className={clsx(
            'font-semibold text-slate-900',
            size === 'lg' ? 'text-xl sm:text-2xl' : 'text-lg',
          )}
        >
          {pick(doctor.name, lang)}
        </p>
        <p className="text-sm text-slate-600">{pick(doctor.designation, lang)}</p>
        <p className="text-sm text-slate-500">{doctor.qualifications}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {specialtyName && <Badge tone="brand">{specialtyName}</Badge>}
          <Badge>
            {t('common.yearsExperience', { n: formatNumber(doctor.experienceYears, lang) })}
          </Badge>
          <Badge tone="amber">
            {t('common.fee')} {formatMoney(doctor.fee, lang)}
          </Badge>
        </div>
      </div>
    </div>
  )
}

export function ChamberTimes({ doctor }: { doctor: Doctor }) {
  const { lang } = useI18n()
  return (
    <ul className="space-y-1 text-sm text-slate-700">
      {chamberLines(doctor.schedule, lang).map((line) => (
        <li key={line} className="flex items-start gap-2">
          <Clock className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden />
          {line}
        </li>
      ))}
    </ul>
  )
}

export function SlotLabel({ slot }: { slot: Pick<Slot, 'date' | 'start'> }) {
  const { t, lang } = useI18n()
  return (
    <span className="inline-flex items-center gap-1.5">
      <CalendarClock className="size-4 shrink-0" aria-hidden />
      {formatDay(slot.date, lang, {
        today: t('common.today'),
        tomorrow: t('common.tomorrow'),
      })}
      , {formatTime(slot.start, lang)}
    </span>
  )
}

/** A strip of days and the slots of the chosen day. */
export function SlotPicker({
  days,
  selected,
  onSelect,
}: {
  days: AvailabilityDay[]
  selected: Slot | null
  onSelect: (slot: Slot) => void
}) {
  const { t, lang } = useI18n()
  const firstOpen = days.find((d) => d.sessions.some((s) => s.slots.some((slot) => slot.available)))
  const [date, setDate] = useState(selected?.date ?? firstOpen?.date ?? days[0]?.date)
  const day = days.find((d) => d.date === date)

  return (
    <div className="space-y-4">
      <div
        className="flex snap-x gap-2 overflow-x-auto p-0.5 pb-2"
        role="tablist"
        aria-label={t('doctor.chooseSlot')}
      >
        {days.map((d) => {
          const free = d.sessions.reduce(
            (n, s) => n + s.slots.filter((slot) => slot.available).length,
            0,
          )
          const hasChamber = d.sessions.length > 0
          const active = d.date === date
          return (
            <button
              key={d.date}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setDate(d.date)}
              className={clsx(
                'flex w-20 shrink-0 snap-start flex-col items-center rounded-xl px-2 py-2 text-center ring-1 transition',
                active
                  ? 'bg-brand-600 text-white ring-brand-600'
                  : 'bg-white ring-slate-200 hover:ring-brand-300',
                !hasChamber && !active && 'opacity-60',
              )}
            >
              <span className={clsx('text-xs', active ? 'text-brand-50' : 'text-slate-500')}>
                {formatDate(d.date, lang, 'weekday')}
              </span>
              <span className="text-lg font-semibold">{formatDate(d.date, lang, 'day')}</span>
              <span
                className={clsx(
                  'text-[11px] leading-tight',
                  active ? 'text-brand-50' : free ? 'text-emerald-700' : 'text-slate-400',
                )}
              >
                {d.onLeave
                  ? t('doctor.onLeave')
                  : !hasChamber
                    ? t('doctor.noChamber')
                    : free
                      ? t('doctor.free', { count: free, n: formatNumber(free, lang) })
                      : t('doctor.full')}
              </span>
            </button>
          )
        })}
      </div>

      {day && (
        <div className="space-y-4" role="tabpanel">
          <p className="font-medium text-slate-900">{formatDate(day.date, lang, 'long')}</p>
          {day.onLeave ? (
            <p className="text-slate-600">{t('doctor.onLeave')}</p>
          ) : day.sessions.length === 0 ? (
            <p className="text-slate-600">{t('doctor.noChamber')}</p>
          ) : (
            day.sessions.map((session) => (
              <div key={session.ruleId}>
                <p className="mb-2 text-sm text-slate-500">
                  {formatTime(session.start, lang)} – {formatTime(session.end, lang)} ·{' '}
                  {session.room}
                </p>
                {session.slots.some((s) => s.available) ? (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
                    {session.slots.map((slot) => {
                      const isSelected =
                        selected?.date === slot.date && selected.start === slot.start
                      return (
                        <button
                          key={slot.start}
                          type="button"
                          disabled={!slot.available}
                          onClick={() => onSelect(slot)}
                          aria-pressed={isSelected}
                          className={clsx(
                            'rounded-lg px-2 py-2 text-sm font-medium ring-1 transition',
                            isSelected
                              ? 'bg-brand-600 text-white ring-brand-600'
                              : slot.available
                                ? 'bg-white text-slate-800 ring-slate-300 hover:ring-brand-500'
                                : 'bg-slate-100 text-slate-400 line-through ring-slate-200',
                          )}
                        >
                          {formatTime(slot.start, lang)}
                        </button>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">{t('doctor.noSlotsDay')}</p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
