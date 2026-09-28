import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { api } from '../../../api/endpoints.ts'
import { chamberLines } from '../../../components/doctor.tsx'
import { Table, Td, Th } from '../../../components/table.tsx'
import {
  Avatar,
  Badge,
  ButtonLink,
  ErrorState,
  PageHeader,
  Spinner,
} from '../../../components/ui.tsx'
import { useI18n } from '../../../i18n/index.ts'
import { formatMoney, pick } from '../../../lib/format.ts'

export default function AdminDoctors() {
  const { t, lang } = useI18n()
  const doctors = useQuery({ queryKey: ['admin-doctors'], queryFn: api.adminDoctors })
  const specialties = useQuery({ queryKey: ['admin-specialties'], queryFn: api.adminSpecialties })
  const specialtyName = (id: string) => {
    const s = specialties.data?.find((x) => x.id === id)
    return s ? pick(s.name, lang) : id
  }

  return (
    <div>
      <PageHeader
        title={t('admin.doctors.title')}
        actions={
          <ButtonLink to="/staff/admin/doctors/new">
            <Plus className="size-4" aria-hidden />
            {t('admin.doctors.add')}
          </ButtonLink>
        }
      />
      {doctors.isPending ? (
        <Spinner />
      ) : doctors.error ? (
        <ErrorState error={doctors.error} onRetry={() => void doctors.refetch()} />
      ) : (
        <Table>
          <thead className="bg-slate-50">
            <tr>
              <Th>{t('common.doctor')}</Th>
              <Th>{t('admin.doctors.specialty')}</Th>
              <Th>{t('doctors.chambers')}</Th>
              <Th>{t('common.fee')}</Th>
              <Th>{t('common.status')}</Th>
              <Th>
                <span className="sr-only">{t('common.edit')}</span>
              </Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {doctors.data.map((d) => (
              <tr key={d.id}>
                <Td>
                  <div className="flex items-center gap-3">
                    <Avatar name={d.name.en} size="sm" />
                    <div>
                      <p className="font-medium whitespace-nowrap text-slate-900">
                        {pick(d.name, lang)}
                      </p>
                      <p className="text-xs text-slate-500">{d.qualifications}</p>
                    </div>
                  </div>
                </Td>
                <Td className="whitespace-nowrap">{specialtyName(d.specialtyId)}</Td>
                <Td>
                  <ul className="space-y-0.5 text-xs whitespace-nowrap text-slate-600">
                    {chamberLines(d.schedule, lang).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </Td>
                <Td className="whitespace-nowrap">{formatMoney(d.fee, lang)}</Td>
                <Td>
                  <Badge tone={d.active ? 'green' : 'gray'}>
                    {d.active ? t('admin.doctors.active') : t('admin.doctors.hidden')}
                  </Badge>
                </Td>
                <Td className="text-right">
                  <Link
                    to={`/staff/admin/doctors/${d.id}`}
                    className="font-medium text-brand-700 hover:underline"
                  >
                    {t('common.edit')}
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  )
}
