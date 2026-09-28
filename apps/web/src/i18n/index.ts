import type { Lang } from '@inovexa/shared'
import i18n from 'i18next'
import { initReactI18next, useTranslation } from 'react-i18next'
import { bn } from './bn.ts'
import { en } from './en.ts'

const STORAGE_KEY = 'lumina:lang'

function initialLanguage(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'bn' || saved === 'en') return saved
  } catch {
    // Storage blocked: fall back to the browser language.
  }
  return navigator.language?.toLowerCase().startsWith('bn') ? 'bn' : 'en'
}

void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, bn: { translation: bn } },
  lng: initialLanguage(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
})

document.documentElement.lang = i18n.language

export function setLanguage(lang: Lang) {
  void i18n.changeLanguage(lang)
  document.documentElement.lang = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    // ignore
  }
}

/** The translation function plus the current language as a `Lang`. */
export function useI18n() {
  const { t, i18n: instance } = useTranslation()
  const lang: Lang = instance.language === 'bn' ? 'bn' : 'en'
  return { t, lang }
}

export default i18n
