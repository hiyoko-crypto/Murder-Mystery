/**
 * Unsplash download-tracking ping for the images picked from BG_LIBRARY
 * (utils/backgroundMatch.ts). No live search here on purpose — locations
 * that don't match anything in the library just get a neutral fallback
 * image instead of an API call. Fully opt-in: with no
 * VITE_UNSPLASH_ACCESS_KEY set, this is a no-op.
 */
import { loadJson, saveJson } from '../utils/storage'

const DOWNLOAD_PING_KEY = 'holmes_bg_download_pings'

/**
 * Unsplash's API guidelines require pinging a photo's download endpoint
 * once it's actually used (not just browsed) — this is that ping, fired
 * for every photo BG_LIBRARY selects for the current scenario. No-ops
 * without a key, and only ever fires once per photo (cached), so it stays
 * well inside free-tier rate limits.
 */
export async function triggerUnsplashDownload(unsplashId: string): Promise<void> {
  const key = (import.meta as any).env?.VITE_UNSPLASH_ACCESS_KEY
  if (!key) return

  const pinged = loadJson<Record<string, boolean>>(DOWNLOAD_PING_KEY, {})
  if (pinged[unsplashId]) return

  try {
    await fetch(`https://api.unsplash.com/photos/${unsplashId}/download`, {
      headers: { Authorization: `Client-ID ${key}` },
    })
    pinged[unsplashId] = true
    saveJson(DOWNLOAD_PING_KEY, pinged)
  } catch {
    // best-effort tracking ping — a failure here shouldn't affect the game
  }
}
