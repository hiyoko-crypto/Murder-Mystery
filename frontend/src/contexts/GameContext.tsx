import { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { resetSession } from '../api/session'
import { useLanguage } from './LanguageContext'
import { useCaseNotes } from './CaseNotesContext'
import { isRevealed, markRevealed, resetProgress } from '../utils/gameProgress'
import type { Message } from '../types'

interface GameContextValue {
  unlockedLocations: string[]
  /** Clues the player has been shown (clues fetched ahead of time stay hidden until revealed). */
  foundItems: string[]
  holdItems: (ids: string[]) => void
  /** Marks a clue as shown; returns true if it was being held back. */
  releaseItem: (id: string) => boolean
  locationItemCatalog: Record<string, string[]>
  /** Descriptions of found clues in the current language (translated by the backend). */
  itemDescriptions: Record<string, string>
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
  const [itemDescriptions, setItemDescriptions] = useState<Record<string, string>>({})
  const [held, setHeld] = useState<string[]>([])
  const heldRef = useRef<string[]>([])
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
      setItemDescriptions(
        Object.fromEntries((data.found_items ?? []).map((i: { id: string; description?: string }) => [i.id, i.description ?? '']))
      )
    } catch {
      // network error — keep existing state
    }
  }, [lang])

  useEffect(() => {
    refetchState()
  }, [refetchState])

  const setHeldBoth = useCallback((next: string[]) => {
    heldRef.current = next
    setHeld(next)
  }, [])

  const holdItems = useCallback((ids: string[]) => {
    const current = heldRef.current
    const add = ids.filter(id => !isRevealed(id) && !current.includes(id))
    if (add.length > 0) setHeldBoth([...current, ...add])
  }, [setHeldBoth])

  const releaseItem = useCallback((id: string) => {
    const wasHeld = heldRef.current.includes(id)
    markRevealed(id)
    if (wasHeld) setHeldBoth(heldRef.current.filter(x => x !== id))
    return wasHeld
  }, [setHeldBoth])

  const visibleFound = useMemo(() => foundItems.filter(id => !held.includes(id)), [foundItems, held])

  const resetGame = useCallback(async () => {
    try { await resetSession() } catch { /* continue anyway */ }
    setUnlockedLocations([])
    setFoundItems([])
    setItemDescriptions({})
    resetProgress()
    setHeldBoth([])
    setLocationItemCatalog({})
    setConversations({})
    resetNotebook()
    await refetchState()
  }, [refetchState, resetNotebook, setHeldBoth])

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
      foundItems: visibleFound,
      holdItems,
      releaseItem,
      locationItemCatalog,
      itemDescriptions,
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
