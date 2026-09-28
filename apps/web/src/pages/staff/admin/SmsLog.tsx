import { type SmsKind, formatPhone } from '@inovexa/shared'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/endpoints.ts'
import { Table, Td, Th } from '../../../components/table.tsx'
import { Badge, EmptyState, ErrorState, PageHeader, Spinner } from '../../../components/ui.tsx'
import { useI18n } from '../../../i18n/index.ts'
import { formatDateTime } from '../../../lib/format.ts'

const KIND_TONE: Record<SmsKind, Parameters<typeof Badge>[0]['tone']> = {
  otp: 'gray',
  confirmation: 'green',
  reschedule: 'blue',
  cancellation: 'red',
  reminder: 'amber',
}

export default function AdminSmsLog() {
  const { t, lang } = useI18n()
  const sms = useQuery({ queryKey: ['sms'], queryFn: () => api.sms(200), refetchInterval: 15_000 })

  return (
    <div>
      <PageHeader title={t('admin.sms.title')} subtitle={t('admin.sms.note')} />
      {sms.isPending ? (
        <Spinner />
      ) : sms.error ? (
        <ErrorState error={sms.error} onRetry={() => void sms.refetch()} />
      ) : sms.data.length === 0 ? (
        <EmptyState title={t('admin.sms.none')} />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>{t('common.time')}</Th>
              <Th>{t('admin.sms.to')}</Th>
              <Th>{t('admin.sms.type')}</Th>
              <Th>{t('admin.sms.message')}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sms.data.map((m) => (
              <tr key={m.id}>
                <Td className="whitespace-nowrap text-slate-600">
                  {formatDateTime(m.createdAt, lang)}
                </Td>
                <Td className="font-mono whitespace-nowrap">{formatPhone(m.phone)}</Td>
                <Td>
                  <Badge tone={KIND_TONE[m.kind]}>{t(`admin.sms.kind.${m.kind}`)}</Badge>
                </Td>
                <Td className="min-w-80 text-slate-700">{m.body}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
