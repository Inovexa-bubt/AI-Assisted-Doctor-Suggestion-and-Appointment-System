import { type AppointmentView, dhakaDate } from '@inovexa/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays, Radio } from 'lucide-react'
import { useState } from 'react'
import { api } from '../api/endpoints.ts'
import { StatusBadge } from '../components/appointment.tsx'
import {
  Alert,
  Avatar,
  Button,
  ButtonLink,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  PageHeader,
  Segmented,
  Spinner,
  useErrorMessage,
} from '../components/ui.tsx'
import { useI18n } from '../i18n/index.ts'
import { formatDate, formatNumber, formatTime, pick } from '../lib/format.ts'

type Scope = 'upcoming' | 'past'

export default function MyAppointments() {
  const { t, lang } = useI18n()
  const [scope, setScope] = useState<Scope>('upcoming')
  const [cancelling, setCancelling] = useState<AppointmentView | null>(null)
  const queryClient = useQueryClient()
  const errorMessage = useErrorMessage()
  const list = useQuery({
    queryKey: ['appointments', scope],
    queryFn: () => api.myAppointments(scope),
  })
  const today = dhakaDate()

  const cancel = useMutation({
    mutationFn: (id: string) => api.cancel(id),
    onSuccess: (a) => {
      setCancelling(null)
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      void queryClient.invalidateQueries({ queryKey: ['availability', a.doctorId] })
    },
  })

  return (
    <div>
      <PageHeader
        title={t('appointments.title')}
        actions={
          <ButtonLink to="/doctors" variant="secondary">
            {t('appointments.book')}
          </ButtonLink>
        }
      />
      <div className="mb-5">
        <Segmented
          label={t('appointments.title')}
          value={scope}
          onChange={setScope}
          options={[
            { value: 'upcoming', label: t('appointments.upcoming') },
            { value: 'past', label: t('appointments.past') },
          ]}
        />
      </div>

      {list.isPending ? (
        <Spinner />
      ) : list.error ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : list.data.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="size-8" />}
          title={scope === 'upcoming' ? t('appointments.noneUpcoming') : t('appointments.nonePast')}
          action={
            scope === 'upcoming' && <ButtonLink to="/assistant">{t('home.heroCta')}</ButtonLink>
          }
        />
      ) : (
        <ul className="space-y-3">
          {list.data.map((a) => (
            <li key={a.id}>
              <Card className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="flex min-w-0 flex-1 gap-3">
                  <Avatar name={a.doctor.name.en} />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{pick(a.doctor.name, lang)}</p>
                    <p className="text-sm text-slate-600">
                      {formatDate(a.date, lang, 'medium')} · {formatTime(a.start, lang)} ·{' '}
                      {t('common.serialN', { n: formatNumber(a.serial, lang) })}
                      {a.room && ` · ${a.room}`}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <StatusBadge status={a.status} />
                      {a.cancelReason && (
                        <span className="text-xs text-slate-500">
                          {t(`cancelReason.${a.cancelReason}`)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  {scope === 'upcoming' ? (
                    <>
                      {a.date === today && (
                        <ButtonLink to={`/appointments/${a.id}/queue`} size="sm">
                          <Radio className="size-4" aria-hidden />
                          {t('appointments.liveQueue')}
                        </ButtonLink>
                      )}
                      {a.status === 'booked' && (
                        <>
                          <ButtonLink
                            to={`/doctors/${a.doctorId}?reschedule=${a.id}`}
                            size="sm"
                            variant="secondary"
                          >
                            {t('appointments.reschedule')}
                          </ButtonLink>
                          <Button size="sm" variant="ghost" onClick={() => setCancelling(a)}>
                            {t('appointments.cancel')}
                          </Button>
                        </>
                      )}
                    </>
                  ) : (
                    <ButtonLink to={`/doctors/${a.doctorId}`} size="sm" variant="subtle">
                      {t('appointments.bookAgain')}
                    </ButtonLink>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog
        open={cancelling !== null}
        onClose={() => {
          setCancelling(null)
          cancel.reset()
        }}
        title={t('appointments.cancelTitle')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancelling(null)}>
              {t('appointments.keep')}
            </Button>
            <Button
              variant="danger"
              loading={cancel.isPending}
              onClick={() => cancelling && cancel.mutate(cancelling.id)}
            >
              {t('appointments.confirmCancel')}
            </Button>
          </>
        }
      >
        {cancelling && (
          <div className="space-y-3">
            <p className="text-slate-700">
              {t('appointments.cancelBody', {
                doctor: pick(cancelling.doctor.name, lang),
                date: formatDate(cancelling.date, lang, 'medium'),
                time: formatTime(cancelling.start, lang),
              })}
            </p>
            {cancel.error && <Alert tone="danger">{errorMessage(cancel.error)}</Alert>}
          </div>
        )}
      </Dialog>
    </div>
  )
}
