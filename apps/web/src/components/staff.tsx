import {
  type AppointmentView,
  type AvailabilitySession,
  type Doctor,
  type Patient,
  type Sex,
  dhakaDate,
  formatPhone,
  normalizePhone,
} from '@inovexa/shared'
import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { ChevronDown, Phone } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { api } from '../api/endpoints.ts'
import { useI18n } from '../i18n/index.ts'
import { errorCode } from '../lib/errors.ts'
import { formatDate, formatNumber, formatTime, pick } from '../lib/format.ts'
import { StatusBadge, SummaryView } from './appointment.tsx'
import {
  Alert,
  Badge,
  Button,
  Dialog,
  Field,
  Input,
  Segmented,
  Select,
  useErrorMessage,
} from './ui.tsx'

/** One patient in a day list: serial, time, patient, badges, actions and the pre-visit summary. */
export function PatientRow({
  appointment: a,
  actions,
  summaryOpen = false,
}: {
  appointment: AppointmentView
  actions?: ReactNode
  summaryOpen?: boolean
}) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState(summaryOpen)
  const p = a.patient
  const sexLabel = p ? t(`login.${p.sex}`) : ''
  return (
    <li
      className={clsx(
        'rounded-xl bg-white ring-1',
        a.status === 'in_consultation' ? 'ring-2 ring-brand-500' : 'ring-slate-200',
        (a.status === 'seen' || a.status === 'cancelled' || a.status === 'no_show') && 'opacity-70',
      )}
    >
      <div className="flex flex-wrap items-start gap-3 p-3 sm:p-4">
        <span
          className={clsx(
            'flex size-11 shrink-0 items-center justify-center rounded-full text-lg font-bold tabular-nums',
            a.status === 'in_consultation'
              ? 'bg-brand-600 text-white'
              : 'bg-slate-100 text-slate-800',
          )}
          aria-label={t('common.serialN', { n: formatNumber(a.serial, lang) })}
        >
          {formatNumber(a.serial, lang)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">
            {p?.name ?? '—'}{' '}
            <span className="font-normal text-slate-500">
              · {formatTime(a.start, lang)}
              {p &&
                ` · ${t('frontDesk.ageSex', { age: formatNumber(p.age, lang), sex: sexLabel })}`}
            </span>
          </p>
          {p && (
            <a
              href={`tel:${p.phone}`}
              className="inline-flex items-center gap-1 text-sm text-slate-600 hover:underline"
            >
              <Phone className="size-3.5" aria-hidden />
              {formatPhone(p.phone)}
            </a>
          )}
          {a.previousVisits && (
            <p className="text-sm text-slate-500">
              {a.previousVisits.count === 0
                ? t('frontDesk.firstVisit')
                : t('frontDesk.previousVisits', {
                    count: a.previousVisits.count,
                    n: formatNumber(a.previousVisits.count, lang),
                    date: a.previousVisits.last
                      ? formatDate(a.previousVisits.last, lang, 'short')
                      : '',
                  })}
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <StatusBadge status={a.status} />
            <Badge>{t(`source.${a.source}`)}</Badge>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="inline-flex items-center gap-0.5 text-xs font-medium text-brand-700 hover:underline"
            >
              {t('frontDesk.showSummary')}
              <ChevronDown
                className={clsx('size-3.5 transition', open && 'rotate-180')}
                aria-hidden
              />
            </button>
          </div>
        </div>
        {actions && (
          <div className="flex w-full flex-wrap gap-2 pl-14 sm:w-auto sm:pl-0">{actions}</div>
        )}
      </div>
      {open && (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-slate-500 uppercase">
            {t('summary.title')}
          </p>
          <SummaryView summary={a.summary} />
        </div>
      )}
    </li>
  )
}

/** Front desk: find or register a patient by phone and book them into a free slot. */
export function NewBookingDialog({
  open,
  onClose,
  doctor,
  date,
  sessions,
  onBooked,
}: {
  open: boolean
  onClose: () => void
  doctor: Doctor
  date: string
  sessions: AvailabilitySession[]
  onBooked: (appointment: AppointmentView) => void
}) {
  const { t, lang } = useI18n()
  const errorMessage = useErrorMessage()
  const [phone, setPhone] = useState('')
  const [patient, setPatient] = useState<Patient | 'new' | null>(null)
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<Sex>('female')
  const [source, setSource] = useState<'phone' | 'walk_in'>(
    date === dhakaDate() ? 'walk_in' : 'phone',
  )
  const freeSlots = sessions.flatMap((s) => s.slots.filter((slot) => slot.available))
  const [start, setStart] = useState(freeSlots[0]?.start ?? '')

  const find = useMutation({
    mutationFn: () => api.findPatient(phone),
    onSuccess: (p) => setPatient(p),
    onError: (e) => errorCode(e) === 'NOT_FOUND' && setPatient('new'),
  })
  const book = useMutation({
    mutationFn: async () => {
      const who =
        patient === 'new'
          ? await api.createPatient({ name: name.trim(), age: Number(age), sex, phone })
          : patient!
      return api.bookForPatient({ patientId: who.id, doctorId: doctor.id, date, start, source })
    },
    onSuccess: (a) => {
      onBooked(a)
      reset()
    },
  })

  const reset = () => {
    setPhone('')
    setPatient(null)
    setName('')
    setAge('')
    find.reset()
    book.reset()
  }
  const close = () => {
    reset()
    onClose()
  }
  const phoneValid = normalizePhone(phone) !== null
  const canBook =
    patient !== null && !!start && (patient !== 'new' || (name.trim().length >= 2 && age !== ''))

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t('frontDesk.bookTitle')}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => book.mutate()} disabled={!canBook} loading={book.isPending}>
            {t('frontDesk.book')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-slate-600">
          {pick(doctor.name, lang)} · {formatDate(date, lang, 'medium')}
        </p>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (phoneValid) find.mutate()
          }}
        >
          <Field label={t('frontDesk.phoneLabel')} className="flex-1">
            {(id) => (
              <Input
                id={id}
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value)
                  setPatient(null)
                }}
                placeholder="01XXXXXXXXX"
                autoFocus
              />
            )}
          </Field>
          <Button type="submit" variant="secondary" disabled={!phoneValid} loading={find.isPending}>
            {t('frontDesk.find')}
          </Button>
        </form>

        {patient && patient !== 'new' && (
          <Alert tone="success" title={t('frontDesk.found')}>
            {patient.name} ·{' '}
            {t('frontDesk.ageSex', {
              age: formatNumber(patient.age, lang),
              sex: t(`login.${patient.sex}`),
            })}
          </Alert>
        )}
        {patient === 'new' && (
          <div className="space-y-3 rounded-xl bg-slate-50 p-3">
            <p className="text-sm text-slate-700">{t('frontDesk.notFound')}</p>
            <Field label={t('login.name')}>
              {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <div className="grid grid-cols-[6rem_1fr] items-end gap-3">
              <Field label={t('login.age')}>
                {(id) => (
                  <Input
                    id={id}
                    inputMode="numeric"
                    value={age}
                    onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  />
                )}
              </Field>
              <Segmented
                label={t('login.sex')}
                value={sex}
                onChange={setSex}
                options={[
                  { value: 'female', label: t('login.female') },
                  { value: 'male', label: t('login.male') },
                  { value: 'other', label: t('login.other') },
                ]}
              />
            </div>
          </div>
        )}
        {find.error && errorCode(find.error) !== 'NOT_FOUND' && (
          <Alert tone="danger">{errorMessage(find.error)}</Alert>
        )}

        {patient && (
          <>
            <div className="space-y-1.5">
              <span className="block text-sm font-medium text-slate-800">
                {t('frontDesk.howBooked')}
              </span>
              <Segmented
                label={t('frontDesk.howBooked')}
                value={source}
                onChange={setSource}
                options={[
                  { value: 'phone', label: t('frontDesk.byPhone') },
                  { value: 'walk_in', label: t('frontDesk.walkIn') },
                ]}
              />
            </div>
            {freeSlots.length === 0 ? (
              <Alert tone="warning">{t('frontDesk.noFreeSlots')}</Alert>
            ) : (
              <Field label={t('frontDesk.slot')}>
                {(id) => (
                  <Select id={id} value={start} onChange={(e) => setStart(e.target.value)}>
                    {freeSlots.map((s) => (
                      <option key={s.start} value={s.start}>
                        {formatTime(s.start, lang)} ·{' '}
                        {t('common.serialN', { n: formatNumber(s.serial, lang) })}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
          </>
        )}
        {book.error && <Alert tone="danger">{errorMessage(book.error)}</Alert>}
      </div>
    </Dialog>
  )
}
