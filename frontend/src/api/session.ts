const BASE = (import.meta as any).env?.VITE_API_URL ?? ''

export async function resetSession(): Promise<void> {
  await fetch(`${BASE}/reset`, { method: 'POST' })
}
