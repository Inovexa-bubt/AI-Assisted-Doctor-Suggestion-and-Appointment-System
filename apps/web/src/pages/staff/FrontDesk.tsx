import { type AppointmentView, dhakaDate, nextToCall, rulesOn } from '@inovexa/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Megaphone, UserPlus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { api } from '../../api/endpoints.ts'
import { NewBookingDialog, PatientRow } from '../../components/staff.tsx'
import {
  Alert,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  useErrorMessage,
} from '../../components/ui.tsx'
import { useI18n } from '../../i18n/index.ts'
import { formatNumber, pick } from '../../lib/format.ts'
import { subscribeQueue } from '../../realtime/queue.ts'

export default function FrontDesk() {
  const { t, lang } = useI18n()
  const [params, setParams] = useSearchParams()
  const queryClient = useQueryClient()
  const errorMessage = useErrorMessage()
  const date = params.get('date') ?? dhakaDate()
  const [booking, setBooking] = useState(false)
  const [toast, setToast] = useState<string>()

  const doctors = useQuery({ queryKey: ['doctors', {}], queryFn: () => api.doctors() })
  // Doctors with a chamber on the chosen day first.
  const sortedDoctors = [...(doctors.data ?? [])].sort(
    (a, b) => Number(rulesOn(b, date).length > 0) - Number(rulesOn(a, date).length > 0),
  )
  const doctorId = params.get('doctor') ?? sortedDoctors[0]?.id ?? ''
  const doctor = doctors.data?.find((d) => d.id === doctorId)

  const sheetKey = ['day-sheet', doctorId, date]
  const sheet = useQuery({
    queryKey: sheetKey,
    queryFn: () => api.daySheet(doctorId, date),
    enabled: !!doctorId,
    refetchInterval: 20_000,
  })
  const { refetch } = sheet
  useEffect(() => {
    if (!doctorId) return
    return subscribeQueue(doctorId, date, () => void refetch())
  }, [doctorId, date, refetch])

  const setStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'arrived' | 'seen' | 'no_show' }) =>
      api.setStatus(id, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: sheetKey }),
  })
  const callNext = useMutation({
    mutationFn: () => api.callNext(doctorId, date),
    onSuccess: (next) => queryClient.setQueryData(sheetKey, next),
  })

  const update = (key: 'doctor' | 'date', value: string) =>
    setParams((p) => {
      p.set(key, value)
      if (key === 'doctor' && !p.get('date')) p.set('date', date)
      return p
    })

  const list = sheet.data?.appointments ?? []
  const current = list.find((a) => a.status === 'in_consultation')
  const upNext = nextToCall(list)
  const count = (...statuses: AppointmentView['status'][]) =>
    list.filter((a) => statuses.includes(a.status)).length
  const n = (x: number) => formatNumber(x, lang)

  const actionsFor = (a: AppointmentView) => {
    const busy = setStatus.isPending && setStatus.variables?.id === a.id
    const mark = (
      status: 'arrived' | 'seen' | 'no_show',
      label: string,
      variant: 'primary' | 'secondary' | 'ghost',
    ) => (
      <Button
        size="sm"
        variant={variant}
        disabled={busy}
        onClick={() => setStatus.mutate({ id: a.id, status })}
      >
        {label}
      </Button>
    )
    if (a.status === 'booked')
      return (
        <>
          {mark('arrived', t('frontDesk.arrived'), 'primary')}
          {mark('no_show', t('frontDesk.noShow'), 'ghost')}
        </>
      )
    if (a.status === 'arrived')
      return (
        <>
          {mark('seen', t('frontDesk.seen'), 'secondary')}
          {mark('no_show', t('frontDesk.noShow'), 'ghost')}
        </>
      )
    if (a.status === 'in_consultation') return mark('seen', t('frontDesk.seen'), 'secondary')
    return null
  }

  return (
    <div>
      <PageHeader
        title={t('frontDesk.title')}
        actions={
          doctor && (
            <Button onClick={() => setBooking(true)} disabled={!sheet.data || sheet.data.onLeave}>
              <UserPlus className="size-4" aria-hidden />
              {t('frontDesk.newBooking')}
            </Button>
          )
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_12rem]">
        <Field label={t('common.doctor')}>
          {(id) => (
            <Select id={id} value={doctorId} onChange={(e) => update('doctor', e.target.value)}>
              {sortedDoctors.map((d) => (
                <option key={d.id} value={d.id}>
                  {pick(d.name, lang)}
                  {rulesOn(d, date).length === 0 ? ` (${t('doctor.noChamber')})` : ''}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('common.date')}>
          {(id) => (
            <Input
              id={id}
              type="date"
              value={date}
              onChange={(e) => e.target.value && update('date', e.target.value)}
            />
          )}
        </Field>
      </div>

      {toast && (
        <Alert tone="success" className="mb-4">
          {toast}
        </Alert>
      )}

      {!doctorId || sheet.isPending ? (
        <Spinner />
      ) : sheet.error ? (
        <ErrorState error={sheet.error} onRetry={() => void sheet.refetch()} />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[20rem_1fr]">
          <Card className="p-5 xl:sticky xl:top-24">
            <p className="text-sm font-medium text-slate-500">{t('frontDesk.nowServing')}</p>
            <p className="mt-1 text-6xl font-bold text-brand-700 tabular-nums">
              {current ? n(current.serial) : '—'}
            </p>
            <p className="mt-1 min-h-6 font-medium text-slate-900">
              {current?.patient?.name ?? t('frontDesk.nobody')}
            </p>
            <Button
              size="lg"
              className="mt-4 w-full"
              onClick={() => callNext.mutate()}
              loading={callNext.isPending}
              disabled={!upNext && !current}
            >
              <Megaphone className="size-5" aria-hidden />
              {t('frontDesk.callNext')}
            </Button>
            <p className="mt-2 text-sm text-slate-600">
              {upNext ? t('frontDesk.nextUp', { n: n(upNext.serial) }) : t('frontDesk.noneArrived')}
            </p>
            {callNext.error && (
              <Alert tone="danger" className="mt-3">
                {errorMessage(callNext.error)}
              </Alert>
            )}
            <p className="mt-4 border-t border-slate-100 pt-3 text-sm text-slate-600">
              {t('frontDesk.counts', {
                booked: n(count('booked')),
                arrived: n(count('arrived')),
                seen: n(count('seen')),
              })}
            </p>
          </Card>

          <div className="space-y-3">
            {sheet.data.onLeave && <Alert tone="warning">{t('frontDesk.onLeave')}</Alert>}
            {!sheet.data.onLeave && sheet.data.sessions.length === 0 && (
              <Alert tone="info">{t('frontDesk.noSession')}</Alert>
            )}
            {setStatus.error && <Alert tone="danger">{errorMessage(setStatus.error)}</Alert>}
            {list.length === 0 ? (
              !sheet.data.onLeave &&
              sheet.data.sessions.length > 0 && <EmptyState title={t('frontDesk.noAppointments')} />
            ) : (
              <ul className="space-y-2">
                {list.map((a) => (
                  <PatientRow key={a.id} appointment={a} actions={actionsFor(a)} />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {booking && doctor && sheet.data && (
        <NewBookingDialog
          open
          onClose={() => setBooking(false)}
          doctor={doctor}
          date={date}
          sessions={sheet.data.sessions}
          onBooked={(a) => {
            setBooking(false)
            setToast(t('frontDesk.bookedToast', { n: n(a.serial), name: a.patient?.name ?? '' }))
            void queryClient.invalidateQueries({ queryKey: sheetKey })
          }}
        />
      )}
    </div>
  )
}
