import { useQuery } from '@tanstack/react-query'
import { Search, Stethoscope } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api/endpoints.ts'
import { ChamberTimes, DoctorHeader, SlotLabel } from '../components/doctor.tsx'
import {
  ButtonLink,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Select,
  Spinner,
} from '../components/ui.tsx'
import { useI18n } from '../i18n/index.ts'
import { formatNumber, pick } from '../lib/format.ts'

export default function Doctors() {
  const { t, lang } = useI18n()
  const [params, setParams] = useSearchParams()
  const specialtyId = params.get('specialty') ?? ''
  const q = params.get('q') ?? ''
  const [text, setText] = useState(q)

  // Update the URL (and the search) a moment after typing stops.
  useEffect(() => {
    const id = setTimeout(() => {
      if (text.trim() === q) return
      setParams(
        (p) => {
          if (text.trim()) p.set('q', text.trim())
          else p.delete('q')
          return p
        },
        { replace: true },
      )
    }, 300)
    return () => clearTimeout(id)
  }, [text, q, setParams])

  const specialties = useQuery({ queryKey: ['specialties'], queryFn: api.specialties })
  const doctors = useQuery({
    queryKey: ['doctors', { specialtyId, q }],
    queryFn: () => api.doctors({ specialtyId: specialtyId || undefined, q: q || undefined }),
  })
  const specialtyName = (id: string) => {
    const s = specialties.data?.find((x) => x.id === id)
    return s ? pick(s.name, lang) : undefined
  }

  return (
    <div>
      <PageHeader title={t('doctors.title')} />
      <div className="mb-6 grid gap-3 sm:grid-cols-[1fr_16rem]">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden
          />
          <Input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t('doctors.searchPlaceholder')}
            aria-label={t('doctors.searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <Select
          value={specialtyId}
          aria-label={t('admin.doctors.specialty')}
          onChange={(e) =>
            setParams((p) => {
              if (e.target.value) p.set('specialty', e.target.value)
              else p.delete('specialty')
              return p
            })
          }
        >
          <option value="">{t('doctors.allSpecialties')}</option>
          {specialties.data?.map((s) => (
            <option key={s.id} value={s.id}>
              {pick(s.name, lang)}
            </option>
          ))}
        </Select>
      </div>

      {doctors.isPending ? (
        <Spinner />
      ) : doctors.error ? (
        <ErrorState error={doctors.error} onRetry={() => void doctors.refetch()} />
      ) : doctors.data.length === 0 ? (
        <EmptyState icon={<Stethoscope className="size-8" />} title={t('doctors.noResults')} />
      ) : (
        <>
          <p className="mb-3 text-sm text-slate-600" aria-live="polite">
            {t('doctors.results', {
              count: doctors.data.length,
              n: formatNumber(doctors.data.length, lang),
            })}
          </p>
          <ul className="grid gap-4 md:grid-cols-2">
            {doctors.data.map((d) => (
              <li key={d.id}>
                <Card className="flex h-full flex-col gap-4 p-5">
                  <Link to={`/doctors/${d.id}`} className="rounded-lg hover:opacity-90">
                    <DoctorHeader doctor={d} specialtyName={specialtyName(d.specialtyId)} />
                  </Link>
                  <ChamberTimes doctor={d} />
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
                    <div className="text-sm">
                      <p className="text-slate-500">{t('doctors.nextSlot')}</p>
                      <p className="font-medium text-slate-900">
                        {d.nextSlot ? <SlotLabel slot={d.nextSlot} /> : t('doctors.noSlots')}
                      </p>
                    </div>
                    <ButtonLink
                      to={`/doctors/${d.id}`}
                      variant={d.nextSlot ? 'primary' : 'secondary'}
                    >
                      {t('doctors.viewSlots')}
                    </ButtonLink>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
