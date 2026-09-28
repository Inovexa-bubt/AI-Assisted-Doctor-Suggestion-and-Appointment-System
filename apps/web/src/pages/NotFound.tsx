import { ButtonLink } from '../components/ui.tsx'
import { useI18n } from '../i18n/index.ts'

export default function NotFound() {
  const { t } = useI18n()
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-semibold text-slate-900">{t('common.notFoundTitle')}</h1>
      <p className="mt-2 text-slate-600">{t('common.notFoundBody')}</p>
      <ButtonLink to="/" className="mt-6">
        {t('common.goHome')}
      </ButtonLink>
    </div>
  )
}
