import type { Slot } from '@inovexa/shared'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { api } from '../api/endpoints.ts'
import { usePatient } from '../api/session.ts'
import { ChamberTimes, DoctorHeader, SlotPicker } from '../components/doctor.tsx'
import { Alert, Button, Card, ErrorState, Spinner } from '../components/ui.tsx'
import { useI18n } from '../i18n/index.ts'
import { formatDate, formatNumber, formatTime, pick } from '../lib/format.ts'

export default function DoctorProfile() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const rescheduleOf = params.get('reschedule') ?? undefined
  const triageId = params.get('triage') ?? undefined
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const [selected, setSelected] = useState<Slot | null>(null)

  const doctor = useQuery({ queryKey: ['doctor', id], queryFn: () => api.doctor(id) })
  const specialties = useQuery({ queryKey: ['specialties'], queryFn: api.specialties })
  const availability = useQuery({
    queryKey: ['availability', id],
    queryFn: () => api.availability(id),
  })
  const { data: patient } = usePatient()
  const original = useQuery({
    queryKey: ['appointment', rescheduleOf],
    queryFn: () => api.appointment(rescheduleOf!),
    enabled: !!rescheduleOf && !!patient,
  })

  if (doctor.isPending) return <Spinner />
  if (doctor.error) return <ErrorState error={doctor.error} onRetry={() => void doctor.refetch()} />

  const specialty = specialties.data?.find((s) => s.id === doctor.data.specialtyId)

  const book = () => {
    if (!selected) return
    const next = new URLSearchParams({ doctor: id, date: selected.date, start: selected.start })
    if (rescheduleOf) next.set('reschedule', rescheduleOf)
    if (triageId) next.set('triage', triageId)
    void navigate(`/book?${next}`)
  }

  return (
    <div className="space-y-6 pb-20">
      <Link
        to="/doctors"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t('nav.doctors')}
      </Link>

      {original.data && (
        <Alert tone="info">
          {t('doctor.rescheduling', {
            date: formatDate(original.data.date, lang, 'medium'),
            time: formatTime(original.data.start, lang),
          })}
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <Card className="p-5 sm:p-6">
          <DoctorHeader
            doctor={doctor.data}
            specialtyName={specialty && pick(specialty.name, lang)}
            size="lg"
          />
        </Card>
        <Card className="p-5">
          <p className="mb-2 font-medium text-slate-900">{t('doctor.chamberTimes')}</p>
          <ChamberTimes doctor={doctor.data} />
        </Card>
      </div>

      <Card className="p-5 sm:p-6">
        <h2 className="mb-1 text-lg font-semibold text-slate-900">{t('doctor.chooseSlot')}</h2>
        <p className="mb-4 text-sm text-slate-500">{t('doctor.slotsHint')}</p>
        {availability.isPending ? (
          <Spinner />
        ) : availability.error ? (
          <ErrorState error={availability.error} onRetry={() => void availability.refetch()} />
        ) : (
          <SlotPicker days={availability.data} selected={selected} onSelect={setSelected} />
        )}
      </Card>

      {selected && (
        <div className="fixed inset-x-0 bottom-16 z-20 border-t border-slate-200 bg-white/95 backdrop-blur md:bottom-0">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm text-slate-700">
              {t('doctor.selected', {
                date: formatDate(selected.date, lang, 'medium'),
                time: formatTime(selected.start, lang),
                serial: formatNumber(selected.serial, lang),
              })}
            </p>
            <Button onClick={book} size="lg">
              {t('doctor.book')}
              <ArrowRight className="size-5" aria-hidden />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
