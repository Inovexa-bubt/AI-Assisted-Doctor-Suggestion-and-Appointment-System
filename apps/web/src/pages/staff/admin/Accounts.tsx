import type { StaffRole } from '@inovexa/shared'
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
  Select,
  Spinner,
  useErrorMessage,
} from '../../../components/ui.tsx'
import { useI18n } from '../../../i18n/index.ts'
import { pick } from '../../../lib/format.ts'

export default function AdminAccounts() {
  const { t, lang } = useI18n()
  const accounts = useQuery({ queryKey: ['staff-accounts'], queryFn: api.staffAccounts })
  const doctors = useQuery({ queryKey: ['admin-doctors'], queryFn: api.adminDoctors })
  const [adding, setAdding] = useState(false)
  const [created, setCreated] = useState(false)
  const doctorName = (id?: string) => {
    const d = doctors.data?.find((x) => x.id === id)
    return d ? pick(d.name, lang) : ''
  }

  return (
    <div className="max-w-4xl">
      <PageHeader
        title={t('admin.accounts.title')}
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" aria-hidden />
            {t('admin.accounts.add')}
          </Button>
        }
      />
      {created && (
        <Alert tone="success" className="mb-4">
          {t('admin.accounts.created')}
        </Alert>
      )}
      {accounts.isPending ? (
        <Spinner />
      ) : accounts.error ? (
        <ErrorState error={accounts.error} onRetry={() => void accounts.refetch()} />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>{t('admin.accounts.name')}</Th>
              <Th>{t('staff.username')}</Th>
              <Th>{t('admin.accounts.role')}</Th>
              <Th>{t('admin.accounts.linkedDoctor')}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {accounts.data.map((a) => (
              <tr key={a.id}>
                <Td className="font-medium whitespace-nowrap">{a.name}</Td>
                <Td className="font-mono">{a.username}</Td>
                <Td>
                  <Badge
                    tone={
                      a.role === 'admin' ? 'purple' : a.role === 'front_desk' ? 'blue' : 'brand'
                    }
                  >
                    {t(`staff.role.${a.role}`)}
                  </Badge>
                </Td>
                <Td className="whitespace-nowrap text-slate-600">{doctorName(a.doctorId)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {adding && (
        <AccountDialog
          onClose={() => setAdding(false)}
          onCreated={() => {
            setAdding(false)
            setCreated(true)
          }}
        />
      )}
    </div>
  )
}

function AccountDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t, lang } = useI18n()
  const queryClient = useQueryClient()
  const errorMessage = useErrorMessage()
  const doctors = useQuery({ queryKey: ['admin-doctors'], queryFn: api.adminDoctors })
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<StaffRole>('front_desk')
  const [doctorId, setDoctorId] = useState('')
  const create = useMutation({
    mutationFn: () =>
      api.createStaffAccount({
        name,
        username,
        password,
        role,
        doctorId: role === 'doctor' ? doctorId : undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff-accounts'] })
      onCreated()
    },
  })

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('admin.accounts.add')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={() => create.mutate()} loading={create.isPending}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label={t('admin.accounts.name')}>
          {(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label={t('staff.username')}>
          {(id) => (
            <Input
              id={id}
              autoComplete="off"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('staff.password')}>
          {(id) => (
            <Input
              id={id}
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
        </Field>
        <Field label={t('admin.accounts.role')}>
          {(id) => (
            <Select id={id} value={role} onChange={(e) => setRole(e.target.value as StaffRole)}>
              <option value="front_desk">{t('staff.role.front_desk')}</option>
              <option value="doctor">{t('staff.role.doctor')}</option>
              <option value="admin">{t('staff.role.admin')}</option>
            </Select>
          )}
        </Field>
        {role === 'doctor' && (
          <Field label={t('admin.accounts.linkedDoctor')}>
            {(id) => (
              <Select id={id} value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
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
        )}
        {create.error && <Alert tone="danger">{errorMessage(create.error)}</Alert>}
      </div>
    </Dialog>
  )
}
