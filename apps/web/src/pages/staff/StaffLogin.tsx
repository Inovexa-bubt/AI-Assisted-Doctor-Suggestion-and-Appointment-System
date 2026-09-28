import type { StaffRole } from '@inovexa/shared'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router'
import { api } from '../../api/endpoints.ts'
import { useStaffUser } from '../../api/session.ts'
import { useDemo } from '../../app/demo.tsx'
import { STAFF_HOME } from '../../app/guards.tsx'
import { DemoBanner, LanguageToggle } from '../../components/layout.tsx'
import {
  Alert,
  Button,
  Card,
  Field,
  Input,
  Spinner,
  useErrorMessage,
} from '../../components/ui.tsx'
import { useI18n } from '../../i18n/index.ts'

const DEMO_ACCOUNTS = [
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'frontdesk', password: 'frontdesk123', role: 'front_desk' },
  { username: 'dr.tanvir', password: 'doctor123', role: 'doctor' },
] as const

export default function StaffLogin() {
  const { t } = useI18n()
  const { isDemo } = useDemo()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const errorMessage = useErrorMessage()
  const { data: user, isPending } = useStaffUser()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const next = params.get('next')
  // Back to the staff page that asked for sign-in, or the role's home page.
  const target = (role: StaffRole) =>
    next && /^\/staff(\/|$)/.test(next) ? next : STAFF_HOME[role]

  const login = useMutation({
    mutationFn: () => api.staffLogin(username, password),
    onSuccess: (u) => {
      queryClient.setQueryData(['staff-me'], u)
      void navigate(target(u.role), { replace: true })
    },
  })

  if (isPending) return <Spinner />
  if (user) return <Navigate to={target(user.role)} replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    login.mutate()
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <div className="flex justify-end p-3">
        <LanguageToggle />
      </div>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center">
        <div className="w-full max-w-sm space-y-4">
          <Card className="p-6">
            <form onSubmit={submit} className="space-y-5">
              <div>
                <span className="mb-3 flex size-11 items-center justify-center rounded-xl bg-brand-600 text-white">
                  <KeyRound className="size-5" aria-hidden />
                </span>
                <h1 className="text-xl font-semibold text-slate-900">{t('staff.loginTitle')}</h1>
                <p className="text-sm text-slate-600">{t('common.appName')}</p>
              </div>
              <Field label={t('staff.username')}>
                {(id) => (
                  <Input
                    id={id}
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoFocus
                  />
                )}
              </Field>
              <Field label={t('staff.password')}>
                {(id) => (
                  <Input
                    id={id}
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                )}
              </Field>
              {login.error && <Alert tone="danger">{errorMessage(login.error)}</Alert>}
              <Button
                type="submit"
                size="lg"
                className="w-full"
                loading={login.isPending}
                disabled={!username || !password}
              >
                {t('common.signIn')}
              </Button>
            </form>
          </Card>
          {isDemo && (
            <Card className="p-4">
              <p className="mb-2 text-sm font-medium text-slate-900">{t('staff.demoAccounts')}</p>
              <ul className="space-y-1 text-sm">
                {DEMO_ACCOUNTS.map((a) => (
                  <li key={a.username}>
                    <button
                      type="button"
                      className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-slate-100"
                      onClick={() => {
                        setUsername(a.username)
                        setPassword(a.password)
                      }}
                    >
                      <span className="font-medium text-slate-900">
                        {t(`staff.role.${a.role}`)}
                      </span>{' '}
                      <span className="font-mono text-slate-600">
                        {a.username} / {a.password}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          <Link to="/" className="block text-center text-sm text-brand-700 hover:underline">
            {t('staff.patientSite')}
          </Link>
        </div>
      </main>
    </div>
  )
}
