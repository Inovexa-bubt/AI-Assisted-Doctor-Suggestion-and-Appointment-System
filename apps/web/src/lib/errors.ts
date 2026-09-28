import { ApiRequestError } from '../api/client.ts'
import { en } from '../i18n/en.ts'
import { useI18n } from '../i18n/index.ts'

type KnownCode = keyof typeof en.errors

const isKnown = (code: string): code is KnownCode => code in en.errors

/** Turns an error into a message in the current language. */
export function useErrorMessage() {
  const { t } = useI18n()
  return (error: unknown): string => {
    if (error instanceof ApiRequestError) {
      if (isKnown(error.code)) return t(`errors.${error.code}`)
      return error.message || t('common.errorGeneric')
    }
    return t('common.errorGeneric')
  }
}

export const errorCode = (error: unknown) =>
  error instanceof ApiRequestError ? error.code : undefined
