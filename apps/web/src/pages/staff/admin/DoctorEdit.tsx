import {
  type Doctor,
  type DoctorInput,
  type Specialty,
  type Weekday,
  addDays,
  sessionSlots,
} from '@inovexa/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../../../api/endpoints.ts'
import {
  Alert,
  Button,
  Card,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Select,
  Spinner,
  useErrorMessage,
} from '../../../components/ui.tsx'
import { useI18n } from '../../../i18n/index.ts'
import { formatDate, formatNumber, pick } from '../../../lib/format.ts'

type Rule = DoctorInput['schedule'][number]

const EMPTY: DoctorInput = {
  name: { en: '', bn: '' },
  specialtyId: '',
  designation: { en: '', bn: '' },
  qualifications: '',
  experienceYears: 0,
  fee: 1000,
  gender: 'female',
  active: true,
  schedule: [],
}

const toInput = ({ id: _id, ...doctor }: Doctor): DoctorInput => doctor

// Saturday first, the Bangladeshi work week.
const WEEK: Weekday[] = [6, 0, 1, 2, 3, 4, 5]

export default function AdminDoctorEdit() {
  const { id } = useParams()
  const doctor = useQuery({
    queryKey: ['admin-doctors'],
    queryFn: api.adminDoctors,
    select: (list) => list.find((d) => d.id === id),
  })
  // The form needs the specialty list too: until it loads, the required specialty field has no
  // matching option and the browser would silently refuse to submit.
  const specialties = useQuery({ queryKey: ['admin-specialties'], queryFn: api.adminSpecialties })
  if ((id && doctor.isPending) || specialties.isPending) return <Spinner />
  if (id && doctor.error)
    return <ErrorState error={doctor.error} onRetry={() => void doctor.refetch()} />
  if (specialties.error)
    return <ErrorState error={specialties.error} onRetry={() => void specialties.refetch()} />
  return (
    <DoctorForm
      key={id ?? 'new'}
      id={id}
      initial={id && doctor.data ? toInput(doctor.data) : EMPTY}
      specialties={specialties.data}
    />
  )
}

function DoctorForm({
  id,
  initial,
  specialties,
}: {
  id?: string
  initial: DoctorInput
  specialties: Specialty[]
}) {
  const { t, lang } = useI18n()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const errorMessage = useErrorMessage()
  const [form, setForm] = useState<DoctorInput>(initial)

  const save = useMutation({
    mutationFn: () => (id ? api.updateDoctor(id, form) : api.createDoctor(form)),
    onSuccess: () => {
      void queryClient.invalidateQueries()
      void navigate('/staff/admin/doctors')
    },
  })

  const set = <K extends keyof DoctorInput>(key: K, value: DoctorInput[K]) =>
    setForm((f) => ({ ...f, [key]: value }))
  const setRule = (i: number, changes: Partial<Rule>) =>
    set(
      'schedule',
      form.schedule.map((r, j) => (j === i ? { ...r, ...changes } : r)),
    )
  const addRule = () =>
    set('schedule', [
      ...form.schedule,
      {
        weekday: 0,
        start: '17:00',
        end: '20:00',
        slotMinutes: 15,
        maxPatients: 12,
        room: form.schedule[0]?.room ?? '',
      },
    ])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  return (
    <form onSubmit={submit} className="max-w-4xl space-y-5">
      <Link
        to="/staff/admin/doctors"
        className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="size-4" aria-hidden />
        {t('admin.doctors.title')}
      </Link>
      <PageHeader title={id ? t('admin.doctors.edit') : t('admin.doctors.add')} />

      <Card className="grid gap-4 p-5 sm:grid-cols-2">
        <Field label={t('admin.doctors.nameEn')}>
          {(fid) => (
            <Input
              id={fid}
              value={form.name.en}
              onChange={(e) => set('name', { ...form.name, en: e.target.value })}
              required
            />
          )}
        </Field>
        <Field label={t('admin.doctors.nameBn')}>
          {(fid) => (
            <Input
              id={fid}
              lang="bn"
              value={form.name.bn}
              onChange={(e) => set('name', { ...form.name, bn: e.target.value })}
              required
            />
          )}
        </Field>
        <Field label={t('admin.doctors.specialty')}>
          {(fid) => (
            <Select
              id={fid}
              value={form.specialtyId}
              onChange={(e) => set('specialtyId', e.target.value)}
              required
            >
              <option value="" disabled>
                —
              </option>
              {specialties.map((s) => (
                <option key={s.id} value={s.id}>
                  {pick(s.name, lang)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label={t('admin.doctors.qualifications')}>
          {(fid) => (
            <Input
              id={fid}
              value={form.qualifications}
              onChange={(e) => set('qualifications', e.target.value)}
            />
          )}
        </Field>
        <Field label={t('admin.doctors.designationEn')}>
          {(fid) => (
            <Input
              id={fid}
              value={form.designation.en}
              onChange={(e) => set('designation', { ...form.designation, en: e.target.value })}
            />
          )}
        </Field>
        <Field label={t('admin.doctors.designationBn')}>
          {(fid) => (
            <Input
              id={fid}
              lang="bn"
              value={form.designation.bn}
              onChange={(e) => set('designation', { ...form.designation, bn: e.target.value })}
            />
          )}
        </Field>
        <div className="grid grid-cols-3 gap-4 sm:col-span-2">
          <Field label={t('admin.doctors.experience')}>
            {(fid) => (
              <Input
                id={fid}
                type="number"
                min={0}
                value={form.experienceYears}
                onChange={(e) => set('experienceYears', Number(e.target.value))}
              />
            )}
          </Field>
          <Field label={t('admin.doctors.fee')}>
            {(fid) => (
              <Input
                id={fid}
                type="number"
                min={0}
                step={50}
                value={form.fee}
                onChange={(e) => set('fee', Number(e.target.value))}
              />
            )}
          </Field>
          <Field label={t('admin.doctors.gender')}>
            {(fid) => (
              <Select
                id={fid}
                value={form.gender}
                onChange={(e) => set('gender', e.target.value as Doctor['gender'])}
              >
                <option value="female">{t('login.female')}</option>
                <option value="male">{t('login.male')}</option>
              </Select>
            )}
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-800 sm:col-span-2">
          <input
            type="checkbox"
            className="size-4 accent-brand-600"
            checked={form.active}
            onChange={(e) => set('active', e.target.checked)}
          />
          {t('admin.doctors.showToPatients')}
        </label>
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{t('admin.doctors.chambers')}</h2>
            <p className="text-sm text-slate-500">{t('admin.doctors.scheduleNote')}</p>
          </div>
          <Button variant="secondary" onClick={addRule}>
            <Plus className="size-4" aria-hidden />
            {t('admin.doctors.addChamber')}
          </Button>
        </div>
        {form.schedule.length === 0 ? (
          <p className="text-sm text-slate-500">{t('admin.doctors.noChambers')}</p>
        ) : (
          <ul className="space-y-3">
            {form.schedule.map((r, i) => {
              const slots = sessionSlots(r).length
              return (
                <li
                  key={r.id ?? i}
                  className="grid grid-cols-2 items-end gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-3 lg:grid-cols-[7rem_9rem_9rem_5.5rem_6rem_minmax(6rem,1fr)_auto]"
                >
                  <Field label={t('admin.doctors.day')}>
                    {(fid) => (
                      <Select
                        id={fid}
                        value={r.weekday}
                        onChange={(e) => setRule(i, { weekday: Number(e.target.value) as Weekday })}
                      >
                        {WEEK.map((d) => (
                          <option key={d} value={d}>
                            {formatDate(addDays('2026-10-04', d), lang, 'weekday')}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label={t('admin.doctors.start')}>
                    {(fid) => (
                      <Input
                        id={fid}
                        type="time"
                        value={r.start}
                        onChange={(e) => setRule(i, { start: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label={t('admin.doctors.end')}>
                    {(fid) => (
                      <Input
                        id={fid}
                        type="time"
                        value={r.end}
                        onChange={(e) => setRule(i, { end: e.target.value })}
                      />
                    )}
                  </Field>
                  <Field label={t('admin.doctors.slotLength')}>
                    {(fid) => (
                      <Input
                        id={fid}
                        type="number"
                        min={5}
                        max={120}
                        value={r.slotMinutes}
                        onChange={(e) => setRule(i, { slotMinutes: Number(e.target.value) })}
                      />
                    )}
                  </Field>
                  <Field label={t('admin.doctors.limit')}>
                    {(fid) => (
                      <Input
                        id={fid}
                        type="number"
                        min={1}
                        max={100}
                        value={r.maxPatients}
                        onChange={(e) => setRule(i, { maxPatients: Number(e.target.value) })}
                      />
                    )}
                  </Field>
                  <Field label={t('common.room')}>
                    {(fid) => (
                      <Input
                        id={fid}
                        value={r.room}
                        onChange={(e) => setRule(i, { room: e.target.value })}
                      />
                    )}
                  </Field>
                  <div className="flex items-center justify-between gap-2 pb-2 sm:justify-end">
                    <span className="text-sm whitespace-nowrap text-slate-600">
                      {t('admin.doctors.slotsPerSession', {
                        count: slots,
                        n: formatNumber(slots, lang),
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        set(
                          'schedule',
                          form.schedule.filter((_, j) => j !== i),
                        )
                      }
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                      aria-label={t('common.remove')}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {save.error && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={() => void navigate('/staff/admin/doctors')}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" loading={save.isPending}>
          {t('common.save')}
        </Button>
      </div>
    </form>
  )
}
