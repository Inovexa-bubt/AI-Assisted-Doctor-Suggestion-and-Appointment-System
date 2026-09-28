import type { Specialty, SpecialtyInput } from '@inovexa/shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { api } from '../../../api/endpoints.ts'
import { Table, Td, Th } from '../../../components/table.tsx'
import {
  Alert,
  Badge,
  Button,
  Dialog,
  ErrorState,
  Field,
  Input,
  PageHeader,
  Spinner,
  Textarea,
  useErrorMessage,
} from '../../../components/ui.tsx'
import { useI18n } from '../../../i18n/index.ts'
import { formatNumber, pick } from '../../../lib/format.ts'
import { SpecialtyIcon } from '../../../lib/specialty-icons.tsx'

export default function AdminSpecialties() {
  const { t, lang } = useI18n()
  const specialties = useQuery({ queryKey: ['admin-specialties'], queryFn: api.adminSpecialties })
  const [editing, setEditing] = useState<Specialty | 'new' | null>(null)

  return (
    <div className="max-w-5xl">
      <PageHeader
        title={t('admin.specialties.title')}
        actions={
          <Button onClick={() => setEditing('new')}>
            <Plus className="size-4" aria-hidden />
            {t('admin.specialties.add')}
          </Button>
        }
      />
      {specialties.isPending ? (
        <Spinner />
      ) : specialties.error ? (
        <ErrorState error={specialties.error} onRetry={() => void specialties.refetch()} />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>{t('admin.specialties.order')}</Th>
              <Th>{t('admin.doctors.specialty')}</Th>
              <Th>{t('admin.specialties.descriptionEn')}</Th>
              <Th>{t('common.status')}</Th>
              <Th>
                <span className="sr-only">{t('common.edit')}</span>
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {specialties.data.map((s) => (
              <tr key={s.id}>
                <Td className="text-slate-500">{formatNumber(s.sortOrder, lang)}</Td>
                <Td>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <SpecialtyIcon id={s.id} className="size-4 text-brand-700" />
                    <span className="font-medium">{s.name.en}</span>
                    <span className="text-slate-500" lang="bn">
                      {s.name.bn}
                    </span>
                  </div>
                </Td>
                <Td className="min-w-64 text-slate-600">{pick(s.description, lang)}</Td>
                <Td>
                  <Badge tone={s.active ? 'green' : 'gray'}>
                    {s.active ? t('admin.doctors.active') : t('admin.doctors.hidden')}
                  </Badge>
                </Td>
                <Td className="text-right">
                  <button
                    type="button"
                    onClick={() => setEditing(s)}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {t('common.edit')}
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {editing && (
        <SpecialtyDialog
          specialty={editing === 'new' ? null : editing}
          nextOrder={(specialties.data?.length ?? 0) + 1}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  )
}

function SpecialtyDialog({
  specialty,
  nextOrder,
  onClose,
}: {
  specialty: Specialty | null
  nextOrder: number
  onClose: () => void
}) {
  const { t } = useI18n()
  const queryClient = useQueryClient()
  const errorMessage = useErrorMessage()
  const [form, setForm] = useState<SpecialtyInput>(
    specialty ?? {
      name: { en: '', bn: '' },
      description: { en: '', bn: '' },
      sortOrder: nextOrder,
      active: true,
    },
  )
  const save = useMutation({
    mutationFn: () =>
      specialty ? api.updateSpecialty(specialty.id, form) : api.createSpecialty(form),
    onSuccess: () => {
      void queryClient.invalidateQueries()
      onClose()
    },
  })
  const setText = (key: 'name' | 'description', lang: 'en' | 'bn', value: string) =>
    setForm((f) => ({ ...f, [key]: { ...f[key], [lang]: value } }))

  return (
    <Dialog
      open
      onClose={onClose}
      size="lg"
      title={specialty ? pick(specialty.name, 'en') : t('admin.specialties.add')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t('admin.specialties.nameEn')}>
          {(id) => (
            <Input
              id={id}
              value={form.name.en}
              onChange={(e) => setText('name', 'en', e.target.value)}
            />
          )}
        </Field>
        <Field label={t('admin.specialties.nameBn')}>
          {(id) => (
            <Input
              id={id}
              lang="bn"
              value={form.name.bn}
              onChange={(e) => setText('name', 'bn', e.target.value)}
            />
          )}
        </Field>
        <Field label={t('admin.specialties.descriptionEn')}>
          {(id) => (
            <Textarea
              id={id}
              rows={3}
              value={form.description.en}
              onChange={(e) => setText('description', 'en', e.target.value)}
            />
          )}
        </Field>
        <Field label={t('admin.specialties.descriptionBn')}>
          {(id) => (
            <Textarea
              id={id}
              lang="bn"
              rows={3}
              value={form.description.bn}
              onChange={(e) => setText('description', 'bn', e.target.value)}
            />
          )}
        </Field>
        <Field label={t('admin.specialties.order')}>
          {(id) => (
            <Input
              id={id}
              type="number"
              min={1}
              value={form.sortOrder}
              onChange={(e) => setForm((f) => ({ ...f, sortOrder: Number(e.target.value) }))}
            />
          )}
        </Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium text-slate-800">
          <input
            type="checkbox"
            className="size-4 accent-brand-600"
            checked={form.active}
            onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
          />
          {t('admin.specialties.active')}
        </label>
      </div>
      {save.error && (
        <Alert tone="danger" className="mt-4">
          {errorMessage(save.error)}
        </Alert>
      )}
    </Dialog>
  )
}
