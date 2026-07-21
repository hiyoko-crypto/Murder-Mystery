import { loadJson, saveJson } from '../utils/storage'
import bakedBriefings from '../data/briefingCache.json'

const BASE = (import.meta as any).env?.VITE_API_URL ?? ''

export interface ExaminedItem {
  id: string
  name: string
  description: string
}

export interface ExamineLocationResult {
  description: string
  newly_found: ExaminedItem[]
  already_found: ExaminedItem[]
  unlocked_location: string | null
}

export interface ExamineItemResult {
  name: string
  description: string
  significance: string
  unlocked_location: string | null
}

export interface BriefingResult {
  title: string
  setting: string
  victim: string
  time_of_murder: string
  time_discovered: string
  weapon: string
  scene: string
  suspects: { id: string; name: string }[]
}

export interface IndictResult {
  correct: boolean
  accused_name: string
  reason_accepted: boolean
  won: boolean
  message: string
}

export async function examineLocation(locationId: string, lang = 'ja'): Promise<ExamineLocationResult> {
  const res = await fetch(`${BASE}/examine/location/${locationId}?lang=${lang}`, { method: 'POST' })
  if (!res.ok) throw new Error(`examine location ${res.status}`)
  return res.json()
}

export async function examineItem(itemId: string, lang = 'ja'): Promise<ExamineItemResult> {
  const res = await fetch(`${BASE}/examine/item/${itemId}?lang=${lang}`)
  if (!res.ok) throw new Error(`examine item ${res.status}`)
  return res.json()
}

// The briefing is static per-scenario case info (no gameplay state attached),
// so it only ever needs to be translated once, period — not once per player.
// `data/briefingCache.json` is baked ahead of time (fetched once from a
// running backend and committed) for every shipped scenario, so players
// never pay the cold-cache LLM-translation wait at all. The localStorage
// cache below is just a dev-time fallback for a scenario that hasn't been
// baked into that file yet (e.g. one just added, before its entry is
// generated) — see README's scenario section for how to regenerate it.
function briefingCacheKey(scenarioId: string, lang: string): string {
  return `holmes_briefing_${scenarioId}_${lang}`
}

export async function fetchBriefing(scenarioId: string, lang = 'ja'): Promise<BriefingResult> {
  const baked = (bakedBriefings as Record<string, Record<string, BriefingResult>>)[scenarioId]?.[lang]
  if (baked) return baked

  const cached = scenarioId ? loadJson<BriefingResult | null>(briefingCacheKey(scenarioId, lang), null) : null
  if (cached) return cached

  // Generous timeout: right after switching scenarios the backend's Japanese
  // translation cache is cold, and every briefing field is its own LLM call
  // on a cache miss — that can comfortably exceed 15s.
  const res = await fetch(`${BASE}/briefing?lang=${lang}`, { signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`briefing ${res.status}`)
  const data: BriefingResult = await res.json()
  if (scenarioId) saveJson(briefingCacheKey(scenarioId, lang), data)
  return data
}

export async function callIndict(suspectId: string, reason: string, lang = 'ja'): Promise<IndictResult> {
  const res = await fetch(`${BASE}/indict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suspect_id: suspectId, reason, lang }),
  })
  if (!res.ok) throw new Error(`indict ${res.status}`)
  return res.json()
}
