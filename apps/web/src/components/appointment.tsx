import type { AppointmentStatus, AppointmentView, PreVisitSummary } from '@inovexa/shared'
import type { ReactNode } from 'react'
import { useI18n } from '../i18n/index.ts'
import { formatDate, formatMoney, formatNumber, formatTime, pick } from '../lib/format.ts'
import { Badge } from './ui.tsx'

const STATUS_TONE: Record<AppointmentStatus, Parameters<typeof Badge>[0]['tone']> = {
  held: 'amber',
  booked: 'blue',
  arrived: 'purple',
  in_consultation: 'brand',
  seen: 'green',
  no_show: 'red',
  cancelled: 'gray',
}

export function StatusBadge({ status }: { status: AppointmentStatus }) {
  const { t } = useI18n()
  return <Badge tone={STATUS_TONE[status]}>{t(`status.${status}`)}</Badge>
}

function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{children}</dd>
    </div>
  )
}

/** Doctor, date, time, serial, room and fee of an appointment. */
export function AppointmentDetails({
  appointment,
  extra,
}: {
  appointment: AppointmentView
  extra?: ReactNode
}) {
  const { t, lang } = useI18n()
  const a = appointment
  return (
    <dl className="divide-y divide-slate-100 text-sm">
      <Row label={t('common.doctor')}>{pick(a.doctor.name, lang)}</Row>
      <Row label={t('common.date')}>{formatDate(a.date, lang, 'long')}</Row>
      <Row label={t('common.time')}>{formatTime(a.start, lang)}</Row>
      <Row label={t('common.serial')}>{formatNumber(a.serial, lang)}</Row>
      {a.room && <Row label={t('common.room')}>{a.room}</Row>}
      <Row label={t('booking.feeAtCounter')}>{formatMoney(a.doctor.fee, lang)}</Row>
      {extra}
    </dl>
  )
}

/** The pre-visit summary the AI wrote, as the doctor and front desk see it. */
export function SummaryView({ summary }: { summary?: PreVisitSummary }) {
  const { t } = useI18n()
  if (!summary) return <p className="text-sm text-slate-500">{t('summary.none')}</p>
  return (
    <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
      <dt className="text-slate-500">{t('summary.symptoms')}</dt>
      <dd className="font-medium text-slate-900">{summary.symptoms}</dd>
      <dt className="text-slate-500">{t('summary.duration')}</dt>
      <dd className="text-slate-900">{summary.duration}</dd>
      <dt className="text-slate-500">{t('summary.severity')}</dt>
      <dd>
        <Badge
          tone={
            summary.severity === 'severe'
              ? 'red'
              : summary.severity === 'moderate'
                ? 'amber'
                : 'gray'
          }
        >
          {t(`summary.level.${summary.severity}`)}
        </Badge>
      </dd>
      <dt className="text-slate-500">{t('summary.note')}</dt>
      <dd className="text-slate-700 italic">“{summary.note}”</dd>
    </dl>
  )
}
