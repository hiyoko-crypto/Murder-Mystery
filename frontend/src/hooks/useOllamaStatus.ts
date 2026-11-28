import { useEffect, useState } from 'react'

const POLL_MS = 8000
const TIMEOUT_MS = 3000

/**
 * Whether the local Ollama server is reachable. Polls through the dev proxy
 * (`/ollama` -> localhost:11434). Returns null until the first check finishes,
 * so the UI doesn't flash a warning on load.
 */
export function useOllamaStatus(): boolean | null {
  const [up, setUp] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
      try {
        const res = await fetch('/ollama/api/tags', { signal: ctrl.signal })
        if (!cancelled) setUp(res.ok)
      } catch {
        if (!cancelled) setUp(false)
      } finally {
        clearTimeout(timer)
      }
    }

    check()
    const id = setInterval(check, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [])

  return up
}
