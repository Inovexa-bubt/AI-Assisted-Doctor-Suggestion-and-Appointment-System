import { dhakaDate } from '@inovexa/shared'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { api } from '../../api/endpoints.ts'
import { useStaffUser } from '../../api/session.ts'
import { PatientRow } from '../../components/staff.tsx'
import {
  Alert,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Spinner,
} from '../../components/ui.tsx'
import { useI18n } from '../../i18n/index.ts'
import { formatNumber } from '../../lib/format.ts'
import { subscribeQueue } from '../../realtime/queue.ts'

/** A doctor's own list for the day, with each patient's pre-visit summary open. */
export default function DoctorView() {
  const { t, lang } = useI18n()
  const { data: user } = useStaffUser()
  const [date, setDate] = useState(dhakaDate())
  const sheet = useQuery({
    queryKey: ['doctor-day', date],
    queryFn: () => api.doctorDay(date),
    refetchInterval: 20_000,
    enabled: !!user?.doctorId,
  })
  const { refetch } = sheet
  useEffect(() => {
    if (!user?.doctorId) return
    return subscribeQueue(user.doctorId, date, () => void refetch())
  }, [user?.doctorId, date, refetch])

  if (!user?.doctorId) return <Alert tone="warning">{t('doctorView.notLinked')}</Alert>

  const active = sheet.data?.appointments.filter((a) => a.status !== 'cancelled') ?? []

  return (
    <div className="max-w-4xl">
      <PageHeader title={t('doctorView.title')} subtitle={t('doctorView.subtitle')} />
      <div className="mb-5 flex flex-wrap items-end gap-4">
        <Field label={t('common.date')} className="w-48">
          {(id) => (
            <Input
              id={id}
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
            />
          )}
        </Field>
        {sheet.data && (
          <Card className="px-4 py-2">
            <span className="text-sm text-slate-500">{t('frontDesk.nowServing')}: </span>
            <span className="text-lg font-bold text-brand-700">
              {sheet.data.nowServing === null ? '—' : formatNumber(sheet.data.nowServing, lang)}
            </span>
          </Card>
        )}
      </div>
      {sheet.isPending ? (
        <Spinner />
      ) : sheet.error ? (
        <ErrorState error={sheet.error} onRetry={() => void sheet.refetch()} />
      ) : sheet.data.onLeave ? (
        <Alert tone="info">{t('frontDesk.onLeave')}</Alert>
      ) : active.length === 0 ? (
        <EmptyState
          title={
            sheet.data.sessions.length ? t('frontDesk.noAppointments') : t('frontDesk.noSession')
          }
        />
      ) : (
        <ul className="space-y-2">
          {active.map((a) => (
            <PatientRow
              key={a.id}
              appointment={a}
              summaryOpen={a.status !== 'seen' && a.status !== 'no_show'}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
