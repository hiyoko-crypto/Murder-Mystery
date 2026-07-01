import type { Emotion } from '../types'

const BASE = (import.meta as any).env?.VITE_API_URL ?? ''

export interface ChatResponse {
  text: string
  emotion: Emotion
  unlocked_location: string | null
}

export async function sendChat(
  suspectId: string,
  message: string,
  lang: 'ja' | 'en' = 'ja',
): Promise<ChatResponse> {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ suspect_id: suspectId, message, lang }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }

  return res.json()
}
