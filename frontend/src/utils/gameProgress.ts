/**
 * Client-side progress that the backend doesn't track:
 *  - examine results fetched ahead of time (the first Japanese examine of a
 *    location can take ~20 s because the backend translates every clue with
 *    the local LLM, so it is started when the player arrives and revealed later)
 *  - which clues the player has actually been shown
 *  - which locations they have walked into
 * All of it resets with a new game.
 */
import { examineLocation, type ExamineLocationResult } from '../api/examine'

const examineCache = new Map<string, Promise<ExamineLocationResult | null>>()
const revealed = new Set<string>()
const seenOnMap = new Set<string>()
const VISITED_KEY = 'poirot_visited_locations'

/** One examine request per (language, location); later callers share it. */
export function getExamine(locationId: string, lang: string): Promise<ExamineLocationResult | null> {
  const key = `${lang}:${locationId}`
  let promise = examineCache.get(key)
  if (!promise) {
    promise = examineLocation(locationId, lang).catch(() => {
      examineCache.delete(key) // let a later press retry
      return null
    })
    examineCache.set(key, promise)
  }
  return promise
}

export function isRevealed(itemId: string): boolean {
  return revealed.has(itemId)
}

export function markRevealed(itemId: string): void {
  revealed.add(itemId)
}

function readVisited(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(VISITED_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

export function hasVisited(locationId: string): boolean {
  return readVisited().includes(locationId)
}

export function hasVisitedAny(): boolean {
  return readVisited().length > 0
}

export function markVisited(locationId: string): void {
  const list = readVisited()
  if (list.includes(locationId)) return
  try {
    sessionStorage.setItem(VISITED_KEY, JSON.stringify([...list, locationId]))
  } catch {
    // storage unavailable: first-visit lines may repeat
  }
}

/** Places the player has already seen listed on the map (so "NEW" shows only once). */
export function hasSeenOnMap(locationId: string): boolean {
  return seenOnMap.has(locationId)
}

export function markSeenOnMap(ids: string[]): void {
  ids.forEach(id => seenOnMap.add(id))
}

export function resetProgress(): void {
  examineCache.clear()
  revealed.clear()
  seenOnMap.clear()
  try {
    sessionStorage.removeItem(VISITED_KEY)
  } catch {
    // ignore
  }
}
