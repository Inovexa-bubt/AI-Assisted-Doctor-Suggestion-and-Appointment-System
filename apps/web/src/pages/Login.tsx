import { type Sex, formatPhone, normalizePhone } from '@inovexa/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Phone, ShieldCheck } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { api } from '../api/endpoints.ts'
import { usePatient } from '../api/session.ts'
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  Segmented,
  Spinner,
  useErrorMessage,
} from '../components/ui.tsx'
import { useI18n } from '../i18n/index.ts'

type Step = 'phone' | 'code' | 'profile'

/** Only same-site paths, so the sign-in page cannot be used to redirect elsewhere. */
const safeNext = (next: string | null) =>
  next && /^\/(?![/\\])/.test(next) ? next : '/appointments'

export default function Login() {
  const { t } = useI18n()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const errorMessage = useErrorMessage()
  const { data: patient, isPending } = usePatient()

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string>()
  const [code, setCode] = useState('')
  const [demoCode, setDemoCode] = useState<string>()
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [sex, setSex] = useState<Sex>('female')

  const sendCode = useMutation({
    mutationFn: (p: string) => api.requestOtp(p),
    onSuccess: (result) => {
      setDemoCode(result.demoCode)
      setCode('')
      setStep('code')
    },
  })
  const verify = useMutation({
    mutationFn: () => api.verifyOtp(normalizePhone(phone)!, code.trim()),
    onSuccess: (result) => {
      if (result.patient) {
        queryClient.setQueryData(['me'], result.patient)
        void navigate(next, { replace: true })
      } else {
        setStep('profile')
      }
    },
  })
  const register = useMutation({
    mutationFn: () => api.completeProfile({ name: name.trim(), age: Number(age), sex }),
    onSuccess: (created) => {
      queryClient.setQueryData(['me'], created)
      void navigate(next, { replace: true })
    },
  })

  if (isPending) return <Spinner />
  if (patient && step !== 'profile') return <Navigate to={next} replace />

  const submitPhone = (e: FormEvent) => {
    e.preventDefault()
    const normalized = normalizePhone(phone)
    if (!normalized) return setPhoneError(t('login.phoneHint'))
    setPhoneError(undefined)
    sendCode.mutate(normalized)
  }

  return (
    <div className="mx-auto max-w-md">
      <Card className="p-6">
        {step === 'phone' && (
          <form onSubmit={submitPhone} className="space-y-5" noValidate>
            <div>
              <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Phone className="size-5" aria-hidden />
              </span>
              <h1 className="text-xl font-semibold text-slate-900">{t('login.title')}</h1>
              <p className="mt-1 text-sm text-slate-600">{t('login.body')}</p>
            </div>
            <Field label={t('login.phone')} hint={t('login.phoneHint')} error={phoneError}>
              {(id) => (
                <Input
                  id={id}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  autoFocus
                />
              )}
            </Field>
            {sendCode.error && <Alert tone="danger">{errorMessage(sendCode.error)}</Alert>}
            <Button type="submit" size="lg" className="w-full" loading={sendCode.isPending}>
              {t('login.sendCode')}
            </Button>
          </form>
        )}

        {step === 'code' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              verify.mutate()
            }}
            className="space-y-5"
          >
            <div>
              <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <ShieldCheck className="size-5" aria-hidden />
              </span>
              <h1 className="text-xl font-semibold text-slate-900">{t('login.codeTitle')}</h1>
              <p className="mt-1 text-sm text-slate-600">
                {t('login.codeSent', { phone: formatPhone(normalizePhone(phone) ?? phone) })}
              </p>
            </div>
            {demoCode && <Alert tone="info">{t('login.demoCode', { code: demoCode })}</Alert>}
            <Field label={t('login.code')}>
              {(id) => (
                <Input
                  id={id}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-2xl tracking-[0.4em]"
                  autoFocus
                />
              )}
            </Field>
            {verify.error && <Alert tone="danger">{errorMessage(verify.error)}</Alert>}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={code.length !== 6}
              loading={verify.isPending}
            >
              {t('login.verify')}
            </Button>
            <div className="flex justify-between text-sm">
              <button
                type="button"
                className="text-slate-600 hover:underline"
                onClick={() => setStep('phone')}
              >
                {t('login.changeNumber')}
              </button>
              <button
                type="button"
                className="text-brand-700 hover:underline disabled:opacity-50"
                disabled={sendCode.isPending}
                onClick={() => sendCode.mutate(normalizePhone(phone)!)}
              >
                {t('login.resend')}
              </button>
            </div>
          </form>
        )}

        {step === 'profile' && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              register.mutate()
            }}
            className="space-y-5"
          >
            <div>
              <h1 className="text-xl font-semibold text-slate-900">{t('login.profileTitle')}</h1>
              <p className="mt-1 text-sm text-slate-600">{t('login.profileBody')}</p>
            </div>
            <Field label={t('login.name')}>
              {(id) => (
                <Input
                  id={id}
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              )}
            </Field>
            <div className="grid grid-cols-[6rem_1fr] items-end gap-4">
              <Field label={t('login.age')}>
                {(id) => (
                  <Input
                    id={id}
                    inputMode="numeric"
                    value={age}
                    onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    required
                  />
                )}
              </Field>
              <div className="space-y-1.5">
                <span className="block text-sm font-medium text-slate-800">{t('login.sex')}</span>
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
            <p className="text-xs text-slate-500">{t('login.privacy')}</p>
            {register.error && <Alert tone="danger">{errorMessage(register.error)}</Alert>}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={name.trim().length < 2 || !age}
              loading={register.isPending}
            >
              {t('login.finish')}
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
