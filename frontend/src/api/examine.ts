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

export async function fetchBriefing(lang = 'ja'): Promise<BriefingResult> {
  // Generous timeout: right after switching scenarios the backend's Japanese
  // translation cache is cold, and every briefing field is its own LLM call
  // on a cache miss — that can comfortably exceed 15s.
  const res = await fetch(`${BASE}/briefing?lang=${lang}`, { signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`briefing ${res.status}`)
  return res.json()
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
