import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { fetchScenario, type ApiScenario, type ExamineRules } from '../api/scenario'
import { matchBackground, BG_LIBRARY, type BgCredit } from '../utils/backgroundMatch'
import { triggerUnsplashDownload } from '../api/unsplashFallback'
import type { Suspect, Location, Item } from '../types'
import type { Lang } from '../i18n'

const STATIC_BG: Record<string, string> = {
  garden:   BG_LIBRARY[0].url,
  ballroom: BG_LIBRARY[1].url,
  study:    BG_LIBRARY[2].url,
}

interface ScenarioCtx {
  scenario: ApiScenario | null
  loading: boolean
  examineRules: ExamineRules | null
  locationBg: (locationId: string) => string
  locationBgCredit: (locationId: string) => BgCredit | null
  suspects: (lang: Lang) => Suspect[]
  locations: (lang: Lang) => Location[]
  items: (lang: Lang) => Item[]
}

const Ctx = createContext<ScenarioCtx | null>(null)

export function ScenarioProvider({ children }: { children: ReactNode }) {
  const [scenario, setScenario] = useState<ApiScenario | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchScenario()
      .then(data => setScenario(data))
      .catch(err => console.error('[ScenarioContext] fetch failed:', err))
      .finally(() => setLoading(false))
  }, [])

  // Keyword-matching every location against BG_LIBRARY only depends on the
  // scenario itself (not lang), so memoizing avoids redoing the scan on
  // every render — e.g. a language toggle in a parent provider.
  const bgMatches = useMemo(
    () => (scenario ? scenario.locations.map((l) => [l.id, matchBackground(l.name, l.description)] as const) : []),
    [scenario],
  )
  const bgMap: Record<string, string> = useMemo(
    () => (scenario ? Object.fromEntries(bgMatches.map(([id, m]) => [id, m.url])) : STATIC_BG),
    [scenario, bgMatches],
  )
  const bgCreditMap: Record<string, BgCredit> = useMemo(
    () => Object.fromEntries(bgMatches.map(([id, m]) => [id, m.credit])),
    [bgMatches],
  )

  useEffect(() => {
    if (!scenario) return
    // Unsplash's guidelines want a download ping for every photo actually
    // used, not just browsed — each of these is the one we've committed to
    // showing for that location, so it's a real "use," not casual browsing.
    for (const [, match] of bgMatches) {
      triggerUnsplashDownload(match.credit.unsplashId)
    }
  }, [scenario, bgMatches])

  const locationBg = (id: string) => bgMap[id] ?? BG_LIBRARY[0].url
  const locationBgCredit = (id: string): BgCredit | null => bgCreditMap[id] ?? null

  const ja = (enName: string, lang: Lang): string => {
    if (lang !== 'ja' || !scenario?.displayNamesJa) return enName
    return scenario.displayNamesJa[enName] ?? enName
  }

  const suspects = (lang: Lang): Suspect[] => {
    if (!scenario) return []
    return scenario.suspects.map(s => ({
      id: s.id,
      name: ja(s.name, lang),
      emotion: 'neutral' as const,
      bio: s.description,
      guilty: s.guilty,
    }))
  }

  const locations = (lang: Lang): Location[] => {
    if (!scenario) return []
    return scenario.locations.map(l => ({
      id: l.id,
      name: ja(l.name, lang),
      description: l.description,
      items: l.items,
      suspects: l.suspects,
    }))
  }

  const items = (lang: Lang): Item[] => {
    if (!scenario) return []
    return scenario.items.map(item => ({
      id: item.id,
      name: ja(item.name, lang),
      emoji: item.emoji,
      discoveryText: item.description,
      detail: item.description,
      locationId: item.locationId,
    }))
  }

  return (
    <Ctx.Provider value={{
      scenario,
      loading,
      examineRules: scenario?.examineRules ?? null,
      locationBg,
      locationBgCredit,
      suspects,
      locations,
      items,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export function useScenario(): ScenarioCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useScenario must be inside ScenarioProvider')
  return ctx
}
