import { formatPhone } from '@inovexa/shared'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck } from 'lucide-react'
import { useParams } from 'react-router'
import { api } from '../api/endpoints.ts'
import { usePatient } from '../api/session.ts'
import { AppointmentDetails } from '../components/appointment.tsx'
import { ButtonLink, Card, ErrorState, Spinner } from '../components/ui.tsx'
import { useI18n } from '../i18n/index.ts'

export default function BookingDone() {
  const { id = '' } = useParams()
  const { t } = useI18n()
  const { data: patient } = usePatient()
  const appointment = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => api.appointment(id),
  })

  if (appointment.isPending) return <Spinner />
  if (appointment.error)
    return <ErrorState error={appointment.error} onRetry={() => void appointment.refetch()} />
  const a = appointment.data

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="text-center">
        <CircleCheck className="mx-auto size-14 text-emerald-600" aria-hidden />
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">
          {a.rescheduledFromId ? t('booking.doneRescheduled') : t('booking.doneTitle')}
        </h1>
        {patient && (
          <p className="mt-1 text-slate-600">
            {t('booking.doneBody', { phone: formatPhone(patient.phone) })}
          </p>
        )}
      </div>
      <Card className="p-5">
        <AppointmentDetails appointment={a} />
      </Card>
      <p className="text-center text-sm text-slate-600">{t('booking.queueHint')}</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
        <ButtonLink to={`/appointments/${id}/queue`} size="lg">
          {t('booking.viewQueue')}
        </ButtonLink>
        <ButtonLink to="/appointments" size="lg" variant="secondary">
          {t('booking.myAppointments')}
        </ButtonLink>
      </div>
    </div>
  )
}
