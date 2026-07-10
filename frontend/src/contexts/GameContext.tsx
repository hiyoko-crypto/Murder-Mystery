import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import { resetSession } from '../api/session'
import { useLanguage } from './LanguageContext'
import { useCaseNotes } from './CaseNotesContext'
import type { Message } from '../types'

interface GameContextValue {
  unlockedLocations: string[]
  foundItems: string[]
  locationItemCatalog: Record<string, string[]>
  refetchState: () => Promise<void>
  resetGame: () => Promise<void>
  getConversation: (suspectId: string) => Message[]
  setConversation: (suspectId: string, msgs: Message[]) => void
}

const GameCtx = createContext<GameContextValue | null>(null)

export function GameProvider({ children }: { children: ReactNode }) {
  const { lang } = useLanguage()
  const { resetNotebook } = useCaseNotes()
  const [unlockedLocations, setUnlockedLocations] = useState<string[]>([])
  const [foundItems, setFoundItems] = useState<string[]>([])
  const [locationItemCatalog, setLocationItemCatalog] = useState<Record<string, string[]>>({})
  const [conversations, setConversations] = useState<Record<string, Message[]>>({})

  const refetchState = useCallback(async () => {
    try {
      const res = await fetch(`/state?lang=${lang}`)
      if (!res.ok) return
      const data = await res.json()
      const locations: { id: string; item_ids?: string[] }[] = data.available_locations ?? []
      setUnlockedLocations(locations.map((l) => l.id))
      setLocationItemCatalog(
        Object.fromEntries(locations.map((l) => [l.id, l.item_ids ?? []]))
      )
      setFoundItems(
        (data.found_items ?? []).map((i: { id: string }) => i.id)
      )
    } catch {
      // network error — keep existing state
    }
  }, [lang])

  useEffect(() => {
    refetchState()
  }, [refetchState])

  const resetGame = useCallback(async () => {
    try { await resetSession() } catch { /* continue anyway */ }
    setUnlockedLocations([])
    setFoundItems([])
    setLocationItemCatalog({})
    setConversations({})
    resetNotebook()
    await refetchState()
  }, [refetchState, resetNotebook])

  const getConversation = useCallback(
    (suspectId: string): Message[] => conversations[suspectId] ?? [],
    [conversations]
  )

  const setConversation = useCallback(
    (suspectId: string, msgs: Message[]) =>
      setConversations(prev => ({ ...prev, [suspectId]: msgs })),
    []
  )

  return (
    <GameCtx.Provider value={{
      unlockedLocations,
      foundItems,
      locationItemCatalog,
      refetchState,
      resetGame,
      getConversation,
      setConversation,
    }}>
      {children}
    </GameCtx.Provider>
  )
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameCtx)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}
