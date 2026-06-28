import { createContext, useContext, useState, type ReactNode } from 'react'
import { ui, type Lang } from '../i18n'

interface LanguageContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: string) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'ja',
  setLang: () => {},
  t: (k) => k,
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

  return (
    <LanguageContext.Provider value={{ lang, setLang: changeLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
