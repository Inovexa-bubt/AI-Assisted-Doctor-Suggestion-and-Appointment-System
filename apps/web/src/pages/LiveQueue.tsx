import { useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { api } from '../api/endpoints.ts'
import { DoctorHeader } from '../components/doctor.tsx'
import { Alert, Card, ErrorState, Spinner } from '../components/ui.tsx'
import { useI18n } from '../i18n/index.ts'
import { formatDate, formatNumber, formatTime } from '../lib/format.ts'
import { subscribeQueue } from '../realtime/queue.ts'
import { dhakaDate } from '@inovexa/shared'

export default function LiveQueue() {
  const { id = '' } = useParams()
  const { t, lang } = useI18n()
  const appointment = useQuery({
    queryKey: ['appointment', id],
    queryFn: () => api.appointment(id),
  })
  // Poll as a fallback; live events below make updates immediate.
  const queue = useQuery({
    queryKey: ['queue', id],
    queryFn: () => api.queue(id),
    refetchInterval: 30_000,
  })

  const doctorId = queue.data?.doctorId
  const date = queue.data?.date
  const { refetch } = queue
  useEffect(() => {
    if (!doctorId || !date) return
    return subscribeQueue(doctorId, date, () => void refetch())
  }, [doctorId, date, refetch])

  if (queue.isPending || appointment.isPending) return <Spinner />
  if (queue.error) return <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />
  if (appointment.error)
    return <ErrorState error={appointment.error} onRetry={() => void appointment.refetch()} />

  const q = queue.data
  const isToday = q.date === dhakaDate()
  const n = (x: number) => formatNumber(x, lang)

  const message =
    q.status === 'in_consultation'
      ? { tone: 'success' as const, text: t('queue.yourTurn') }
      : q.status === 'seen'
        ? { tone: 'success' as const, text: t('queue.done') }
        : q.status === 'no_show'
          ? { tone: 'warning' as const, text: t('queue.missed') }
          : q.status === 'cancelled'
            ? { tone: 'warning' as const, text: t('queue.cancelled') }
            : !isToday
              ? {
                  tone: 'info' as const,
                  text: t('queue.future', { time: formatTime(q.sessionStart, lang) }),
                }
              : null
  const waiting = isToday && (q.status === 'booked' || q.status === 'arrived')

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Link
        to="/appointments"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t('nav.appointments')}
      </Link>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-900">{t('queue.title')}</h1>
        {isToday && (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-700">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
            </span>
            {t('queue.live')}
          </span>
        )}
      </div>

      <Card className="p-5">
        <DoctorHeader doctor={appointment.data.doctor} />
        <p className="mt-3 text-sm text-slate-600">
          {formatDate(q.date, lang, 'long')} · {appointment.data.room}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3" aria-live="polite">
        <Card className="p-5 text-center">
          <p className="text-sm text-slate-500">{t('queue.yourSerial')}</p>
          <p className="mt-1 text-5xl font-bold text-brand-700 tabular-nums">{n(q.serial)}</p>
        </Card>
        <Card className="p-5 text-center">
          <p className="text-sm text-slate-500">{t('queue.nowServing')}</p>
          <p
            className={clsx(
              'mt-1 font-bold tabular-nums',
              q.nowServing === null ? 'pt-3 text-lg text-slate-400' : 'text-5xl text-slate-900',
            )}
          >
            {q.nowServing === null ? t('queue.notStarted') : n(q.nowServing)}
          </p>
        </Card>
      </div>

      {waiting && (
        <Card className="space-y-1 p-5 text-center">
          <p className="text-lg font-semibold text-slate-900">
            {q.ahead === 0 ? t('queue.next') : t('queue.ahead', { count: q.ahead, n: n(q.ahead) })}
          </p>
          {q.estimatedTime && (
            <p className="text-slate-600">
              {t('queue.estimated')}:{' '}
              <span className="font-semibold text-slate-900">
                {formatTime(q.estimatedTime, lang)}
              </span>
            </p>
          )}
        </Card>
      )}

      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <p className="text-center text-sm text-slate-500">{t('queue.note')}</p>
    </div>
  )
}
