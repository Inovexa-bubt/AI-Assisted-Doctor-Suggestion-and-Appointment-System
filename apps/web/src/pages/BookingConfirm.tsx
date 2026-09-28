import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Timer } from 'lucide-react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { api } from '../api/endpoints.ts'
import { usePatient } from '../api/session.ts'
import { AppointmentDetails } from '../components/appointment.tsx'
import { DoctorHeader } from '../components/doctor.tsx'
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  ErrorState,
  Spinner,
  useErrorMessage,
} from '../components/ui.tsx'
import { useI18n } from '../i18n/index.ts'
import { errorCode } from '../lib/errors.ts'
import { formatDate, formatNumber, formatTime } from '../lib/format.ts'
import { useNow } from '../lib/use-now.ts'

export default function BookingConfirm() {
  const { id = '' } = useParams()
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const errorMessage = useErrorMessage()
  const now = useNow()
  const { data: patient } = usePatient()
  const appointment = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => api.appointment(id),
    retry: false,
  })

  const confirm = useMutation({
    mutationFn: () => api.confirm(id),
    onSuccess: (booked) => {
      queryClient.setQueryData(['appointment', id], booked)
      void queryClient.invalidateQueries({ queryKey: ['appointments'] })
      void queryClient.invalidateQueries({ queryKey: ['availability', booked.doctorId] })
      void navigate(`/booking/${id}/done`, { replace: true })
    },
  })
  const release = useMutation({
    mutationFn: () => api.releaseHold(id),
    onSettled: () => {
      const a = appointment.data
      const back = new URLSearchParams()
      if (a?.rescheduledFromId) back.set('reschedule', a.rescheduledFromId)
      if (a?.triageId) back.set('triage', a.triageId)
      void queryClient.invalidateQueries({ queryKey: ['availability'] })
      void navigate(`/doctors/${a?.doctorId ?? ''}${back.size ? `?${back}` : ''}`, {
        replace: true,
      })
    },
  })

  if (appointment.isPending) return <Spinner />
  if (appointment.error) {
    const expired = errorCode(appointment.error) === 'HOLD_EXPIRED'
    return (
      <div className="mx-auto max-w-md">
        {expired ? (
          <Alert
            tone="warning"
            title={t('booking.expired')}
            action={<ButtonLink to="/doctors">{t('booking.chooseAnother')}</ButtonLink>}
          />
        ) : (
          <ErrorState error={appointment.error} onRetry={() => void appointment.refetch()} />
        )}
      </div>
    )
  }

  const a = appointment.data
  if (a.status !== 'held') return <Navigate to={`/booking/${id}/done`} replace />

  const msLeft = Math.max(0, Date.parse(a.holdExpiresAt ?? '') - now.getTime())
  const expired = msLeft === 0
  const clock = `${formatNumber(Math.floor(msLeft / 60000), lang)}:${formatNumber(Math.floor((msLeft % 60000) / 1000), lang, { minimumIntegerDigits: 2 })}`
  const confirmExpired = errorCode(confirm.error) === 'HOLD_EXPIRED'

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-2xl font-semibold text-slate-900">{t('booking.confirmTitle')}</h1>

      {expired || confirmExpired ? (
        <Alert
          tone="warning"
          title={t('booking.expired')}
          action={
            <Button
              variant="secondary"
              onClick={() => release.mutate()}
              loading={release.isPending}
            >
              {t('booking.chooseAnother')}
            </Button>
          }
        />
      ) : (
        <div
          className="flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-950 ring-1 ring-amber-200"
          role="timer"
          aria-live="off"
        >
          <Timer className="size-5 shrink-0" aria-hidden />
          <span>{t('booking.holdTimer', { time: clock })}</span>
        </div>
      )}

      {a.rescheduledFrom && (
        <Alert tone="info">
          {t('booking.moving', {
            date: formatDate(a.rescheduledFrom.date, lang, 'medium'),
            time: formatTime(a.rescheduledFrom.start, lang),
          })}
        </Alert>
      )}

      <Card className="space-y-4 p-5">
        <DoctorHeader doctor={a.doctor} />
        <AppointmentDetails
          appointment={a}
          extra={
            patient && (
              <div className="flex justify-between gap-4 py-2">
                <dt className="text-slate-500">{t('common.patient')}</dt>
                <dd className="text-right font-medium text-slate-900">{patient.name}</dd>
              </div>
            )
          }
        />
        {a.triageId && <p className="text-sm text-slate-500">{t('booking.previsit')}</p>}
      </Card>

      {confirm.error && !confirmExpired && (
        <Alert tone="danger">{errorMessage(confirm.error)}</Alert>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button
          variant="secondary"
          size="lg"
          onClick={() => release.mutate()}
          loading={release.isPending}
        >
          {t('booking.changeSlot')}
        </Button>
        <Button
          size="lg"
          onClick={() => confirm.mutate()}
          loading={confirm.isPending}
          disabled={expired}
        >
          {t('booking.confirm')}
        </Button>
      </div>
    </div>
  )
}
