import { isRouteErrorResponse, useRouteError } from 'react-router'
import { ButtonLink } from '../components/ui.tsx'
import { useI18n } from '../i18n/index.ts'
import NotFound from './NotFound.tsx'

export default function RouteError() {
  const error = useRouteError()
  const { t } = useI18n()
  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />
  console.error(error)
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">{t('common.errorGeneric')}</h1>
      <ButtonLink to="/" className="mt-6">
        {t('common.goHome')}
      </ButtonLink>
    </div>
  )
}
