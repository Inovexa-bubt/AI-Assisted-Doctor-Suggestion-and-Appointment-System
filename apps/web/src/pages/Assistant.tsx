import { type Lang, type TriageResult, checkEmergency } from '@inovexa/shared'
import { useMutation, useQuery } from '@tanstack/react-query'
import clsx from 'clsx'
import { RotateCcw, SendHorizontal, Sparkles } from 'lucide-react'
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router'
import { api } from '../api/endpoints.ts'
import { EmergencyNotice, TriageResultCard, VoiceButton } from '../components/assistant.tsx'
import { EmergencyStrip } from '../components/layout.tsx'
import { Alert, Button, Textarea, useErrorMessage } from '../components/ui.tsx'
import { useI18n } from '../i18n/index.ts'

interface Message {
  from: 'user' | 'assistant'
  text: string
}

/** The patient's language, from the script they typed in. */
const detectLang = (text: string, fallback: Lang): Lang =>
  /[ঀ-৿]/.test(text) ? 'bn' : /[a-z]/i.test(text) ? 'en' : fallback

export default function Assistant() {
  const { t, lang } = useI18n()
  const [params, setParams] = useSearchParams()
  const errorMessage = useErrorMessage()
  const [messages, setMessages] = useState<Message[]>([])
  const [result, setResult] = useState<TriageResult | null>(null)
  const [localEmergency, setLocalEmergency] = useState<string[] | null>(null)
  const [input, setInput] = useState('')
  const [voiceError, setVoiceError] = useState<string>()
  const logEnd = useRef<HTMLDivElement>(null)
  const specialties = useQuery({ queryKey: ['specialties'], queryFn: api.specialties })

  const ask = useMutation({
    mutationFn: ({ text, sessionId }: { text: string; sessionId?: string }) =>
      sessionId ? api.answerTriage(sessionId, text) : api.startTriage(text, detectLang(text, lang)),
    onSuccess: (r) => {
      setResult(r)
      if (r.session.status === 'needs_answer' && r.session.question) {
        setMessages((m) => [...m, { from: 'assistant', text: r.session.question! }])
      }
    },
  })

  const send = (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || ask.isPending) return
    setMessages((m) => [...m, { from: 'user', text: trimmed }])
    setInput('')
    // The fixed keyword check runs first, in the browser, so the notice shows at once.
    const matches = checkEmergency(trimmed)
    if (matches.length) setLocalEmergency(matches)
    const sessionId = result?.session.status === 'needs_answer' ? result.session.id : undefined
    ask.mutate({ text: trimmed, sessionId })
  }

  const startOver = () => {
    setMessages([])
    setResult(null)
    setLocalEmergency(null)
    setInput('')
    ask.reset()
  }

  // A problem typed on the home page arrives as ?q= and is sent straight away.
  const started = useRef(false)
  useEffect(() => {
    const q = params.get('q')
    if (started.current || !q) return
    started.current = true
    setParams({}, { replace: true })
    send(q)
  }, [])

  useEffect(() => {
    logEnd.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages.length, ask.isPending, result])

  const session = result?.session
  const emergency =
    localEmergency ?? (session?.status === 'emergency' ? (session.emergencyMatches ?? []) : null)
  const finished = emergency !== null || session?.status === 'complete'
  const quickReplies =
    !finished && session?.status === 'needs_answer' ? (session.quickReplies ?? []) : []
  const submit = (e: FormEvent) => {
    e.preventDefault()
    send(input)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send(input)
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="-mx-4 -mt-6 sm:mx-0 sm:mt-0 sm:overflow-hidden sm:rounded-xl">
        <EmergencyStrip />
      </div>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          {t('assistant.title')}
        </h1>
        <p className="mt-1 text-slate-600">{t('assistant.intro')}</p>
      </div>

      {messages.length > 0 && (
        <div role="log" aria-live="polite" className="space-y-3">
          {messages.map((m, i) => (
            <div
              key={i}
              className={clsx('flex gap-2', m.from === 'user' ? 'justify-end' : 'justify-start')}
            >
              {m.from === 'assistant' && (
                <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
                  <Sparkles className="size-4" aria-hidden />
                  <span className="sr-only">{t('assistant.assistantName')}</span>
                </span>
              )}
              <p
                className={clsx(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 whitespace-pre-wrap',
                  m.from === 'user'
                    ? 'rounded-br-md bg-brand-600 text-white'
                    : 'rounded-bl-md bg-white text-slate-900 ring-1 ring-slate-200',
                )}
              >
                <span className="sr-only">
                  {m.from === 'user' ? t('assistant.you') : t('assistant.assistantName')}:{' '}
                </span>
                {m.text}
              </p>
            </div>
          ))}
          {ask.isPending && !emergency && (
            <p className="flex items-center gap-2 pl-10 text-sm text-slate-500" role="status">
              <span className="flex gap-1" aria-hidden>
                <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                <span className="size-1.5 animate-bounce rounded-full bg-slate-400" />
              </span>
              {t('assistant.thinking')}
            </p>
          )}
        </div>
      )}

      {emergency && <EmergencyNotice matches={emergency} onStartOver={startOver} />}

      {!emergency && session?.status === 'complete' && (
        <TriageResultCard
          session={session}
          specialty={specialties.data?.find((s) => s.id === session.specialtyId)}
          suggestions={result?.suggestions ?? []}
        />
      )}

      {ask.error && <Alert tone="danger">{errorMessage(ask.error)}</Alert>}

      {!finished ? (
        <form
          onSubmit={submit}
          className="space-y-3 rounded-2xl bg-white p-4 ring-1 ring-slate-200"
        >
          {quickReplies.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {quickReplies.map((reply) => (
                <Button
                  key={reply}
                  variant="subtle"
                  size="sm"
                  onClick={() => send(reply)}
                  disabled={ask.isPending}
                >
                  {reply}
                </Button>
              ))}
            </div>
          )}
          <label htmlFor="assistant-input" className="sr-only">
            {messages.length ? t('assistant.answerPlaceholder') : t('assistant.title')}
          </label>
          <Textarea
            id="assistant-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={
              messages.length ? t('assistant.answerPlaceholder') : t('assistant.placeholder')
            }
            rows={messages.length ? 2 : 3}
            maxLength={1000}
            autoFocus
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <VoiceButton
              lang={lang}
              onText={(text) => {
                setVoiceError(undefined)
                setInput((current) => (current ? `${current} ${text}` : text))
              }}
              onError={setVoiceError}
            />
            <Button type="submit" disabled={!input.trim()} loading={ask.isPending}>
              {t('assistant.send')}
              <SendHorizontal className="size-4" aria-hidden />
            </Button>
          </div>
          {voiceError ? (
            <p className="text-sm text-amber-800">{voiceError}</p>
          ) : (
            <p className="text-xs text-slate-500">{t('assistant.voiceNote')}</p>
          )}
        </form>
      ) : (
        <Button variant="secondary" onClick={startOver}>
          <RotateCcw className="size-4" aria-hidden />
          {t('assistant.startOver')}
        </Button>
      )}
      <div ref={logEnd} />
    </div>
  )
}
