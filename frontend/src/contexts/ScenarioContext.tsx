import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { fetchScenario, type ApiScenario, type ExamineRules } from '../api/scenario'
import type { Suspect, Location, Item } from '../types'
import type { Lang } from '../i18n'

const BG_POOL = [
  'https://images.unsplash.com/photo-1723053140058-7aa2e74ac794?q=80&w=1470&auto=format&fit=crop',
  'https://images.unsplash.com/photo-1780383908348-66fe35ee95cf?w=1200&q=80',
  'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?q=80&w=928&auto=format&fit=crop',
]

const STATIC_BG: Record<string, string> = {
  garden:   BG_POOL[0],
  ballroom: BG_POOL[1],
  study:    BG_POOL[2],
}

interface ScenarioCtx {
  scenario: ApiScenario | null
  loading: boolean
  examineRules: ExamineRules | null
  locationBg: (locationId: string) => string
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

  const bgMap: Record<string, string> = scenario
    ? Object.fromEntries(scenario.locations.map((l, i) => [l.id, BG_POOL[i % BG_POOL.length]]))
    : STATIC_BG

  const locationBg = (id: string) => bgMap[id] ?? BG_POOL[0]

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
