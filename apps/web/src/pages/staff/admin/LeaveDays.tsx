import { dhakaDate } from '@inovexa/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { api } from '../../../api/endpoints.ts'
import { Table, Td, Th } from '../../../components/table.tsx'
import {
  Alert,
  Button,
  Card,
  EmptyState,
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

export default function AdminLeaveDays() {
  const { t, lang } = useI18n()
  const queryClient = useQueryClient()
  const errorMessage = useErrorMessage()
  const today = dhakaDate()
  const [doctorId, setDoctorId] = useState('')
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [done, setDone] = useState<string>()

  const doctors = useQuery({ queryKey: ['admin-doctors'], queryFn: api.adminDoctors })
  const leaveDays = useQuery({ queryKey: ['leave-days'], queryFn: () => api.leaveDays() })
  const impact = useQuery({
    queryKey: ['leave-impact', doctorId, date],
    queryFn: () => api.leaveImpact(doctorId, date),
    enabled: !!doctorId && !!date,
  })

  const add = useMutation({
    mutationFn: () => api.addLeaveDay({ doctorId, date, reason }),
    onSuccess: (r) => {
      setDone(t('admin.leave.added', { count: r.cancelled, n: formatNumber(r.cancelled, lang) }))
      setDate('')
      setReason('')
      void queryClient.invalidateQueries()
    },
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.removeLeaveDay(id),
    onSuccess: () => void queryClient.invalidateQueries(),
  })

  const doctorName = (id: string) => {
    const d = doctors.data?.find((x) => x.id === id)
    return d ? pick(d.name, lang) : id
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setDone(undefined)
    add.mutate()
  }
  const count = impact.data?.appointments ?? 0

  return (
    <div className="max-w-4xl">
      <PageHeader title={t('admin.leave.title')} />

      <Card className="mb-6 p-5">
        <h2 className="mb-4 font-semibold text-slate-900">{t('admin.leave.add')}</h2>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_11rem_1fr]">
            <Field label={t('common.doctor')}>
              {(id) => (
                <Select
                  id={id}
                  value={doctorId}
                  onChange={(e) => setDoctorId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    {t('admin.leave.chooseDoctor')}
                  </option>
                  {doctors.data?.map((d) => (
                    <option key={d.id} value={d.id}>
                      {pick(d.name, lang)}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t('common.date')}>
              {(id) => (
                <Input
                  id={id}
                  type="date"
                  min={today}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              )}
            </Field>
            <Field label={`${t('admin.leave.reason')} (${t('common.optional')})`}>
              {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}
            </Field>
          </div>
          {doctorId && date && impact.data && (
            <Alert tone={count ? 'warning' : 'info'}>
              {count
                ? t('admin.leave.impact', { count, n: formatNumber(count, lang) })
                : t('admin.leave.impactNone')}
            </Alert>
          )}
          {add.error && <Alert tone="danger">{errorMessage(add.error)}</Alert>}
          {done && <Alert tone="success">{done}</Alert>}
          <Button
            type="submit"
            variant={count ? 'danger' : 'primary'}
            disabled={!doctorId || !date || impact.isPending}
            loading={add.isPending}
          >
            {t('admin.leave.confirm')}
          </Button>
        </form>
      </Card>

      {leaveDays.isPending ? (
        <Spinner />
      ) : leaveDays.error ? (
        <ErrorState error={leaveDays.error} onRetry={() => void leaveDays.refetch()} />
      ) : leaveDays.data.length === 0 ? (
        <EmptyState title={t('admin.leave.none')} />
      ) : (
        <>
          <Table>
            <thead className="bg-slate-50">
              <tr>
                <Th>{t('common.date')}</Th>
                <Th>{t('common.doctor')}</Th>
                <Th>{t('admin.leave.reason')}</Th>
                <Th>
                  <span className="sr-only">{t('common.remove')}</span>
                </Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaveDays.data.map((l) => (
                <tr key={l.id} className={l.date < today ? 'text-slate-500' : ''}>
                  <Td className="whitespace-nowrap">
                    {formatDate(l.date, lang, 'medium')}
                    {l.date < today && (
                      <span className="ml-2 text-xs">({t('admin.leave.past')})</span>
                    )}
                  </Td>
                  <Td className="whitespace-nowrap">{doctorName(l.doctorId)}</Td>
                  <Td>{l.reason}</Td>
                  <Td className="text-right">
                    {l.date >= today && (
                      <button
                        type="button"
                        onClick={() => remove.mutate(l.id)}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-700"
                        aria-label={t('common.remove')}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <p className="mt-2 text-sm text-slate-500">{t('admin.leave.removeNote')}</p>
        </>
      )}
    </div>
  )
}
