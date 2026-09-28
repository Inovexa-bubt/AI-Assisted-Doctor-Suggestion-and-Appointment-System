import type { Settings } from '@inovexa/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
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

export default function AdminSettings() {
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings })
  if (settings.isPending) return <Spinner />
  if (settings.error)
    return <ErrorState error={settings.error} onRetry={() => void settings.refetch()} />
  return <SettingsForm initial={settings.data} />
}

function SettingsForm({ initial }: { initial: Settings }) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const errorMessage = useErrorMessage()
  const [form, setForm] = useState(initial)
  const save = useMutation({
    mutationFn: () => api.saveSettings(form),
    onSuccess: (saved) => {
      queryClient.setQueryData(['settings'], saved)
      void queryClient.invalidateQueries({ queryKey: ['availability'] })
      void queryClient.invalidateQueries({ queryKey: ['doctors'] })
    },
  })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    save.mutate()
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-5">
      <PageHeader title={t('admin.settings.title')} />
      <Card className="space-y-4 p-5">
        <div>
          <h2 className="font-semibold text-slate-900">{t('admin.settings.reminderTitle')}</h2>
          <p className="text-sm text-slate-500">{t('admin.settings.reminderBody')}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('admin.settings.when')}>
            {(id) => (
              <Select
                id={id}
                value={form.reminder.daysBefore}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    reminder: { ...f.reminder, daysBefore: Number(e.target.value) as 0 | 1 },
                  }))
                }
              >
                <option value={1}>{t('admin.settings.dayBefore')}</option>
                <option value={0}>{t('admin.settings.sameDay')}</option>
              </Select>
            )}
          </Field>
          <Field label={t('admin.settings.time')}>
            {(id) => (
              <Input
                id={id}
                type="time"
                value={form.reminder.time}
                onChange={(e) =>
                  setForm((f) => ({ ...f, reminder: { ...f.reminder, time: e.target.value } }))
                }
              />
            )}
          </Field>
        </div>
      </Card>
      <Card className="space-y-4 p-5">
        <h2 className="font-semibold text-slate-900">{t('admin.settings.bookingTitle')}</h2>
        <Field label={t('admin.settings.openDays')} className="max-w-xs">
          {(id) => (
            <Input
              id={id}
              type="number"
              min={1}
              max={60}
              value={form.booking.openDays}
              onChange={(e) =>
                setForm((f) => ({ ...f, booking: { openDays: Number(e.target.value) } }))
              }
            />
          )}
        </Field>
      </Card>
      {save.error && <Alert tone="danger">{errorMessage(save.error)}</Alert>}
      {save.isSuccess && <Alert tone="success">{t('common.saved')}</Alert>}
      <Button type="submit" loading={save.isPending}>
        {t('common.save')}
      </Button>
    </form>
  )
}
