import { useQuery } from '@tanstack/react-query'
import { ArrowRight, CalendarCheck, MessageCircle, Search, Stethoscope } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../api/endpoints.ts'
import { EmergencyStrip } from '../components/layout.tsx'
import { Button, ButtonLink, Card, Input, Textarea } from '../components/ui.tsx'
import { useI18n } from '../i18n/index.ts'
import { pick } from '../lib/format.ts'
import { SpecialtyIcon } from '../lib/specialty-icons.tsx'

export default function Home() {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const [problem, setProblem] = useState('')
  const [query, setQuery] = useState('')
  const specialties = useQuery({ queryKey: ['specialties'], queryFn: api.specialties })

  const ask = (e: FormEvent) => {
    e.preventDefault()
    void navigate(
      problem.trim() ? `/assistant?q=${encodeURIComponent(problem.trim())}` : '/assistant',
    )
  }
  const search = (e: FormEvent) => {
    e.preventDefault()
    void navigate(query.trim() ? `/doctors?q=${encodeURIComponent(query.trim())}` : '/doctors')
  }

  const steps = [
    { icon: MessageCircle, title: t('home.step1Title'), body: t('home.step1Body') },
    { icon: Stethoscope, title: t('home.step2Title'), body: t('home.step2Body') },
    { icon: CalendarCheck, title: t('home.step3Title'), body: t('home.step3Body') },
  ]

  return (
    <div className="space-y-12">
      <div className="-mx-4 -mt-6 sm:mx-0 sm:mt-0 sm:overflow-hidden sm:rounded-xl">
        <EmergencyStrip />
      </div>

      <section className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {t('home.heroTitle')}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-slate-600">{t('home.heroBody')}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink to="/assistant" size="lg">
              {t('home.heroCta')}
              <ArrowRight className="size-5" aria-hidden />
            </ButtonLink>
            <ButtonLink to="/doctors" size="lg" variant="secondary">
              {t('home.heroSecondary')}
            </ButtonLink>
          </div>
        </div>
        <Card className="p-5 sm:p-6">
          <form onSubmit={ask} className="space-y-3">
            <label htmlFor="home-problem" className="block font-medium text-slate-900">
              {t('assistant.title')}
            </label>
            <Textarea
              id="home-problem"
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
              placeholder={t('assistant.placeholder')}
              rows={3}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">{t('assistant.disclaimer')}</p>
              <Button type="submit">{t('assistant.send')}</Button>
            </div>
          </form>
        </Card>
      </section>

      <form onSubmit={search} role="search" className="flex gap-2">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('home.searchPlaceholder')}
            aria-label={t('home.searchPlaceholder')}
            className="h-12 pl-9"
          />
        </div>
        <Button type="submit" size="lg" variant="secondary">
          {t('common.search')}
        </Button>
      </form>

      <section aria-labelledby="specialties-title">
        <h2 id="specialties-title" className="mb-4 text-xl font-semibold text-slate-900">
          {t('home.specialtiesTitle')}
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {(specialties.data ?? []).map((s) => (
            <li key={s.id}>
              <Link
                to={`/doctors?specialty=${s.id}`}
                className="flex h-full flex-col gap-2 rounded-xl bg-white p-3 ring-1 ring-slate-200 transition hover:ring-brand-300 hover:shadow-sm sm:flex-row sm:gap-3 sm:p-4"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                  <SpecialtyIcon id={s.id} className="size-5" />
                </span>
                <span className="min-w-0">
                  {/* Long names ("Gastroenterology") must not push the page wider than a phone. */}
                  <span className="block font-medium text-slate-900 hyphens-auto wrap-break-word">
                    {pick(s.name, lang)}
                  </span>
                  <span className="mt-0.5 line-clamp-2 hidden text-sm text-slate-500 sm:block">
                    {pick(s.description, lang)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="how-title">
        <h2 id="how-title" className="mb-4 text-xl font-semibold text-slate-900">
          {t('home.howTitle')}
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, body }, i) => (
            <li key={title} className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                  {i + 1}
                </span>
                <Icon className="size-5 text-brand-700" aria-hidden />
              </div>
              <p className="mt-3 font-medium text-slate-900">{title}</p>
              <p className="mt-1 text-sm text-slate-600">{body}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  )
}
