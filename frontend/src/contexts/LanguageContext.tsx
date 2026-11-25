import { createContext, useContext, useState, type ReactNode } from 'react'
import { ui, type Lang } from '../i18n'

interface LanguageContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  /** Look up a key in the shared `ui` table. */
  t: (key: string) => string
  /** Pick between an inline Japanese / English pair. */
  tt: (ja: string, en: string) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'ja',
  setLang: () => {},
  t: (k) => k,
  tt: (ja) => ja,
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    return (localStorage.getItem('lang') as Lang) ?? 'ja'
  })

  const changeLang = (l: Lang) => {
    localStorage.setItem('lang', l)
    setLang(l)
  }

  const t = (key: string): string => ui[key]?.[lang] ?? key
  const tt = (ja: string, en: string): string => (lang === 'ja' ? ja : en)

  return (
    <LanguageContext.Provider value={{ lang, setLang: changeLang, t, tt }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
