import { useMutation } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { api } from '../api/endpoints.ts'
import { Alert, ButtonLink, Spinner, useErrorMessage } from '../components/ui.tsx'
import { useI18n } from '../i18n/index.ts'

/** Holds the chosen slot for 5 minutes, then moves on to the confirm screen. */
export default function Book() {
  const { t } = useI18n()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const errorMessage = useErrorMessage()
  const doctorId = params.get('doctor') ?? ''
  const date = params.get('date') ?? ''
  const start = params.get('start') ?? ''
  const rescheduleOf = params.get('reschedule') ?? undefined
  const triageId = params.get('triage') ?? undefined

  const hold = useMutation({
    mutationFn: () => api.hold({ doctorId, date, start, rescheduleOf, triageId }),
    onSuccess: (appointment) => void navigate(`/booking/${appointment.id}`, { replace: true }),
  })
  // Ask once, even when React runs effects twice in development.
  const asked = useRef(false)
  useEffect(() => {
    if (asked.current) return
    asked.current = true
    hold.mutate()
  }, [hold])

  if (hold.error) {
    const back = new URLSearchParams()
    if (rescheduleOf) back.set('reschedule', rescheduleOf)
    if (triageId) back.set('triage', triageId)
    return (
      <div className="mx-auto max-w-md">
        <Alert
          tone="warning"
          title={errorMessage(hold.error)}
          action={
            <ButtonLink to={`/doctors/${doctorId}${back.size ? `?${back}` : ''}`} replace>
              {t('booking.chooseAnother')}
            </ButtonLink>
          }
        />
      </div>
    )
  }
  return <Spinner label={t('booking.holding')} />
}
