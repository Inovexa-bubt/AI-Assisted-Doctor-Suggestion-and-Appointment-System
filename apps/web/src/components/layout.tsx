import { useMutation, useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import {
  CalendarDays,
  ChartColumn,
  ClipboardList,
  House,
  Languages,
  LogOut,
  MessageSquare,
  Plus,
  RotateCcw,
  Settings,
  Siren,
  Sparkles,
  Stethoscope,
  UserRound,
  Users,
  CalendarOff,
  ListOrdered,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router'
import { useDemo } from '../app/demo.tsx'
import { api } from '../api/endpoints.ts'
import { usePatient, useStaffUser } from '../api/session.ts'
import { setLanguage, useI18n } from '../i18n/index.ts'
import { Badge } from './ui.tsx'

export function LanguageToggle({ className }: { className?: string }) {
  const { t, lang } = useI18n()
  return (
    <button
      type="button"
      onClick={() => setLanguage(lang === 'bn' ? 'en' : 'bn')}
      className={clsx(
        'inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-slate-700 hover:bg-slate-100',
        className,
      )}
      aria-label={t('common.languageLabel')}
      lang={lang === 'bn' ? 'en' : 'bn'}
    >
      <Languages className="size-4" aria-hidden />
      {t('common.language')}
    </button>
  )
}

function Logo({ to = '/', subtitle }: { to?: string; subtitle?: ReactNode }) {
  const { t } = useI18n()
  return (
    <Link to={to} className="flex min-w-0 items-center gap-2.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
        <Plus className="size-6" strokeWidth={3} aria-hidden />
      </span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-semibold text-slate-900">{t('common.appName')}</span>
        {subtitle && <span className="block truncate text-xs text-slate-500">{subtitle}</span>}
      </span>
    </Link>
  )
}

export function DemoBanner() {
  const { t } = useI18n()
  const { isDemo, reset } = useDemo()
  const navigate = useNavigate()
  if (!isDemo) return null
  return (
    <div className="bg-slate-900 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-1.5 text-xs">
        <span>{t('demo.banner')}</span>
        <span className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
            onClick={() => {
              if (window.confirm(t('demo.resetConfirm'))) {
                reset()
                void navigate('/')
              }
            }}
          >
            <RotateCcw className="size-3.5" aria-hidden />
            {t('demo.reset')}
          </button>
        </span>
      </div>
    </div>
  )
}

export function EmergencyStrip() {
  const { t } = useI18n()
  return (
    <div className="bg-red-50 text-red-900 ring-1 ring-red-200">
      <a
        href="tel:999"
        className="mx-auto flex max-w-6xl items-center gap-2 px-4 py-2 text-sm font-medium hover:underline"
      >
        <Siren className="size-4 shrink-0" aria-hidden />
        <span>{t('emergency.strip')}</span>
      </a>
    </div>
  )
}

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  clsx(
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-slate-100',
  )

function PatientAccount() {
  const { t } = useI18n()
  const { data: patient } = usePatient()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const logout = useMutation({
    mutationFn: api.logout,
    onSuccess: () => {
      queryClient.setQueryData(['me'], null)
      queryClient.removeQueries({ queryKey: ['appointments'] })
      void navigate('/')
    },
  })
  if (!patient) {
    return (
      <Link
        to="/login"
        className="rounded-lg px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
      >
        {t('common.signIn')}
      </Link>
    )
  }
  return (
    <div className="flex items-center gap-1">
      <span className="hidden max-w-40 items-center gap-1.5 truncate text-sm text-slate-700 lg:flex">
        <UserRound className="size-4 shrink-0" aria-hidden />
        {patient.name}
      </span>
      <button
        type="button"
        onClick={() => logout.mutate()}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-slate-600 hover:bg-slate-100"
        title={t('common.signOut')}
      >
        <LogOut className="size-4" aria-hidden />
        <span className="sr-only sm:not-sr-only">{t('common.signOut')}</span>
      </button>
    </div>
  )
}

export function PublicLayout() {
  const { t } = useI18n()
  const tabs = [
    { to: '/', label: t('nav.home'), icon: House, end: true },
    { to: '/assistant', label: t('nav.assistantShort'), icon: Sparkles },
    { to: '/doctors', label: t('nav.doctorsShort'), icon: Stethoscope },
    { to: '/appointments', label: t('nav.appointmentsShort'), icon: CalendarDays },
  ]
  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Logo />
          <nav className="hidden items-center gap-1 md:flex" aria-label={t('nav.menu')}>
            <NavLink to="/assistant" className={navLinkClass}>
              {t('nav.assistant')}
            </NavLink>
            <NavLink to="/doctors" className={navLinkClass}>
              {t('nav.doctors')}
            </NavLink>
            <NavLink to="/appointments" className={navLinkClass}>
              {t('nav.appointments')}
            </NavLink>
          </nav>
          <div className="flex shrink-0 items-center gap-1">
            <LanguageToggle />
            <PatientAccount />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 md:pb-12">
        <Outlet />
      </main>
      <footer className="hidden border-t border-slate-200 bg-white md:block">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-slate-600">
          <div>
            <p className="font-medium text-slate-800">{t('common.appName')}</p>
            <p>{t('footer.address')}</p>
          </div>
          <p className="max-w-md">{t('footer.disclaimer')}</p>
          <Link to="/staff" className="text-brand-700 hover:underline">
            {t('nav.staffPortal')}
          </Link>
        </div>
      </footer>
      <nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label={t('nav.menu')}
      >
        <ul className="grid grid-cols-4">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  clsx(
                    'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium',
                    isActive ? 'text-brand-700' : 'text-slate-500',
                  )
                }
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}

export function StaffLayout() {
  const { t } = useI18n()
  const { data: user } = useStaffUser()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const logout = useMutation({
    mutationFn: api.staffLogout,
    onSuccess: () => {
      queryClient.setQueryData(['staff-me'], null)
      void navigate('/staff/login')
    },
  })
  if (!user) return null
  const items = [
    {
      to: '/staff/front-desk',
      label: t('staff.nav.frontDesk'),
      icon: ListOrdered,
      roles: ['front_desk', 'admin'],
    },
    {
      to: '/staff/doctor',
      label: t('staff.nav.doctorView'),
      icon: ClipboardList,
      roles: ['doctor'],
    },
    {
      to: '/staff/analytics',
      label: t('staff.nav.analytics'),
      icon: ChartColumn,
      roles: ['admin'],
    },
    {
      to: '/staff/admin/doctors',
      label: t('staff.nav.doctors'),
      icon: Stethoscope,
      roles: ['admin'],
    },
    { to: '/staff/admin/leave', label: t('staff.nav.leave'), icon: CalendarOff, roles: ['admin'] },
    {
      to: '/staff/admin/specialties',
      label: t('staff.nav.specialties'),
      icon: ClipboardList,
      roles: ['admin'],
    },
    {
      to: '/staff/admin/settings',
      label: t('staff.nav.settings'),
      icon: Settings,
      roles: ['admin'],
    },
    { to: '/staff/admin/sms', label: t('staff.nav.sms'), icon: MessageSquare, roles: ['admin'] },
    { to: '/staff/admin/accounts', label: t('staff.nav.accounts'), icon: Users, roles: ['admin'] },
  ].filter((i) => i.roles.includes(user.role))

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors',
      isActive ? 'bg-brand-50 text-brand-800' : 'text-slate-700 hover:bg-slate-100',
    )

  return (
    <div className="flex min-h-dvh flex-col">
      <DemoBanner />
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="flex h-16 items-center justify-between gap-3 px-4">
          <Logo to="/staff" subtitle={t('staff.portal')} />
          <div className="flex shrink-0 items-center gap-1">
            <span className="hidden items-center gap-2 text-sm text-slate-700 sm:flex">
              {user.name}
              <Badge tone="brand">{t(`staff.role.${user.role}`)}</Badge>
            </span>
            <LanguageToggle />
            <button
              type="button"
              onClick={() => logout.mutate()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">{t('common.signOut')}</span>
            </button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-100 px-2 py-2 lg:hidden">
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} className={itemClass}>
              <Icon className="size-4" aria-hidden />
              {label}
            </NavLink>
          ))}
        </nav>
      </header>
      <div className="flex flex-1">
        <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
          <nav className="sticky top-16 flex flex-col gap-1 p-3">
            {items.map(({ to, label, icon: Icon }) => (
              <NavLink key={to} to={to} className={itemClass}>
                <Icon className="size-4" aria-hidden />
                {label}
              </NavLink>
            ))}
            <Link to="/" className="mt-4 px-3 py-2 text-sm text-brand-700 hover:underline">
              {t('staff.patientSite')}
            </Link>
          </nav>
        </aside>
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
