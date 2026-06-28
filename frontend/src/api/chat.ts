import type { Message, Emotion } from '../types'

const API_BASE = 'http://localhost:8000'

export interface ChatResponse {
  text: string
  emotion: Emotion
}

export async function sendChat(
  suspectName: string,
  messages: Message[],
  lang: 'ja' | 'en' = 'ja',
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      suspect_name: suspectName,
      lang,
      messages: messages.map((m) => ({
        role: m.role,
        text: m.text,
        presentedItemId: m.presentedItemId ?? null,
      })),
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail ?? `HTTP ${res.status}`)
  }

  return res.json()
}
