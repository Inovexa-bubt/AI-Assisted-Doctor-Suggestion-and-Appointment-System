import {
  type DoctorSuggestion,
  type Lang,
  type Specialty,
  type TriageSession,
  EMERGENCY_NUMBER,
} from '@inovexa/shared'
import { useMutation } from '@tanstack/react-query'
import clsx from 'clsx'
import { LoaderCircle, Mic, Phone, Siren, Square } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api/endpoints.ts'
import { useI18n } from '../i18n/index.ts'
import { formatDay, formatNumber, formatTime, pick } from '../lib/format.ts'
import { SpecialtyIcon } from '../lib/specialty-icons.tsx'
import { DoctorHeader } from './doctor.tsx'
import { Alert, Badge, Button, ButtonLink, Card } from './ui.tsx'

export function EmergencyNotice({
  matches,
  onStartOver,
}: {
  matches: string[]
  onStartOver: () => void
}) {
  const { t } = useI18n()
  return (
    <div role="alert" className="rounded-2xl bg-red-600 p-6 text-white shadow-lg">
      <Siren className="size-10" aria-hidden />
      <h2 className="mt-3 text-2xl font-bold">{t('emergency.title')}</h2>
      <p className="mt-2 text-lg text-red-50">{t('emergency.body')}</p>
      <a
        href={`tel:${EMERGENCY_NUMBER}`}
        className="mt-5 inline-flex h-14 items-center gap-2 rounded-xl bg-white px-6 text-lg font-bold text-red-700 hover:bg-red-50"
      >
        <Phone className="size-6" aria-hidden />
        {t('emergency.call')}
      </a>
      {matches.length > 0 && (
        <p className="mt-5 text-sm text-red-100">
          {t('emergency.matched', { list: matches.join(', ') })}
        </p>
      )}
      <button
        type="button"
        onClick={onStartOver}
        className="mt-2 text-sm text-white underline underline-offset-2"
      >
        {t('emergency.notEmergency')}
      </button>
    </div>
  )
}

const URGENCY_TONE = { routine: 'green', within_48h: 'amber', emergency: 'red' } as const

export function TriageResultCard({
  session,
  specialty,
  suggestions,
}: {
  session: TriageSession
  specialty?: Specialty
  suggestions: DoctorSuggestion[]
}) {
  const { t, lang } = useI18n()
  const urgency = session.urgency ?? 'routine'
  const specialtyName = specialty ? pick(specialty.name, lang) : ''
  const bookLink = (doctorId: string, date: string, start: string) =>
    `/book?${new URLSearchParams({ doctor: doctorId, date, start, triage: session.id })}`

  return (
    <div className="space-y-4">
      <Card className="p-5 sm:p-6">
        <p className="text-sm font-medium text-slate-500">{t('assistant.resultTitle')}</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <SpecialtyIcon id={session.specialtyId ?? ''} className="size-6" />
          </span>
          <p className="text-2xl font-semibold text-slate-900">{specialtyName}</p>
        </div>
        <p className="mt-4 text-slate-700" lang={session.lang}>
          {session.explanation}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">{t('assistant.urgencyLabel')}:</span>
          <Badge tone={URGENCY_TONE[urgency]}>{t(`assistant.urgency.${urgency}`)}</Badge>
          <span className="text-slate-600">{t(`assistant.urgencyHint.${urgency}`)}</span>
        </div>
      </Card>

      <Alert tone="warning">{t('assistant.disclaimer')}</Alert>

      <section aria-labelledby="suggested-title" className="space-y-3">
        <h2 id="suggested-title" className="text-lg font-semibold text-slate-900">
          {t('assistant.suggestedDoctors')}
        </h2>
        {suggestions.length === 0 ? (
          <p className="text-slate-600">{t('assistant.noDoctors')}</p>
        ) : (
          <ul className="space-y-3">
            {suggestions.map(({ doctor, slots }) => (
              <li key={doctor.id}>
                <Card className="space-y-4 p-5">
                  <Link
                    to={`/doctors/${doctor.id}?triage=${session.id}`}
                    className="block hover:opacity-90"
                  >
                    <DoctorHeader doctor={doctor} />
                  </Link>
                  <div className="flex flex-wrap gap-2">
                    {slots.map((slot) => (
                      <ButtonLink
                        key={`${slot.date} ${slot.start}`}
                        to={bookLink(doctor.id, slot.date, slot.start)}
                        variant="subtle"
                        size="sm"
                      >
                        {formatDay(slot.date, lang, {
                          today: t('common.today'),
                          tomorrow: t('common.tomorrow'),
                        })}
                        , {formatTime(slot.start, lang)} ·{' '}
                        {t('common.serialN', { n: formatNumber(slot.serial, lang) })}
                      </ButtonLink>
                    ))}
                    <ButtonLink
                      to={`/doctors/${doctor.id}?triage=${session.id}`}
                      variant="ghost"
                      size="sm"
                    >
                      {t('doctors.viewSlots')}
                    </ButtonLink>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 pt-2">
          {specialty && (
            <ButtonLink to={`/doctors?specialty=${specialty.id}`} variant="secondary">
              {t('assistant.seeAll', { specialty: specialtyName })}
            </ButtonLink>
          )}
          <ButtonLink to="/doctors" variant="ghost">
            {t('assistant.browseAll')}
          </ButtonLink>
        </div>
      </section>
    </div>
  )
}

type VoiceState = 'idle' | 'recording' | 'transcribing'

/**
 * Records speech and turns it into text through the speech-to-text endpoint. The recording is
 * sent once and not kept.
 */
export function VoiceButton({
  lang,
  onText,
  onError,
}: {
  lang: Lang
  onText: (text: string) => void
  onError: (message: string) => void
}) {
  const { t } = useI18n()
  const [state, setState] = useState<VoiceState>('idle')
  const recorder = useRef<MediaRecorder | null>(null)
  const timeout = useRef<ReturnType<typeof setTimeout>>(undefined)
  const transcribe = useMutation({
    mutationFn: (audio: Blob) => api.transcribe(audio, lang),
    onSuccess: ({ text }) => onText(text),
    onError: () => onError(t('common.errorGeneric')),
    onSettled: () => setState('idle'),
  })

  useEffect(
    () => () => {
      clearTimeout(timeout.current)
      recorder.current?.stream.getTracks().forEach((track) => track.stop())
    },
    [],
  )

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      onError(t('assistant.micUnavailable'))
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const chunks: Blob[] = []
      const rec = new MediaRecorder(stream)
      rec.ondataavailable = (e) => chunks.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        setState('transcribing')
        transcribe.mutate(new Blob(chunks, { type: rec.mimeType }))
      }
      recorder.current = rec
      rec.start()
      setState('recording')
      timeout.current = setTimeout(() => rec.state === 'recording' && rec.stop(), 60_000)
    } catch (e) {
      onError(
        e instanceof DOMException && e.name === 'NotAllowedError'
          ? t('assistant.micDenied')
          : t('assistant.micUnavailable'),
      )
    }
  }
  const stop = () => {
    clearTimeout(timeout.current)
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant={state === 'recording' ? 'danger' : 'secondary'}
        onClick={state === 'recording' ? stop : () => void start()}
        disabled={state === 'transcribing'}
        aria-label={state === 'recording' ? t('assistant.stop') : t('assistant.speak')}
        className={clsx(state === 'recording' && 'animate-pulse')}
      >
        {state === 'transcribing' ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : state === 'recording' ? (
          <Square className="size-4" aria-hidden />
        ) : (
          <Mic className="size-4" aria-hidden />
        )}
        <span className="hidden sm:inline">
          {state === 'recording' ? t('assistant.stop') : t('assistant.speak')}
        </span>
      </Button>
      {state !== 'idle' && (
        <span className="text-sm text-slate-600" role="status">
          {state === 'recording' ? t('assistant.listening') : t('assistant.transcribing')}
        </span>
      )}
    </div>
  )
}
