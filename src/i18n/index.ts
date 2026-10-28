import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import fr from './fr/common.json'
import en from './en/common.json'

export const LANGUAGES = ['fr', 'en'] as const
export type Language = (typeof LANGUAGES)[number]

const STORAGE_KEY = 'spectra-lang'

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'fr' || saved === 'en') return saved
  } catch {
    /* stockage indisponible */
  }
  // FR par défaut ; l'anglais se choisit dans le profil.
  return 'fr'
}

export function setLanguage(lang: Language): void {
  void i18n.changeLanguage(lang)
  document.documentElement.lang = lang
  try {
    localStorage.setItem(STORAGE_KEY, lang)
  } catch {
    /* stockage indisponible */
  }
}

void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: initialLanguage(),
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  returnNull: false,
})

export default i18n
