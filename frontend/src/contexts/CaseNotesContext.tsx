import { createContext, useContext, useState, useCallback, useEffect, useMemo, type Dispatch, type SetStateAction, type ReactNode } from 'react'
import { useLanguage } from './LanguageContext'
import { useScenario } from './ScenarioContext'
import { loadJson, saveJson } from '../utils/storage'

export type HistoryEventType = 'chat' | 'unlock_location' | 'examine_location' | 'indict'

export interface HistoryEntry {
  id: string
  type: HistoryEventType
  suspectId?: string
  locationId?: string
  itemIds?: string[]
  summary: string
}

export interface RelationshipNode {
  id: string
  label: string
  x: number
  y: number
}

export interface RelationshipEdge {
  id: string
  source: string
  target: string
  label: string
  color?: string
  bidirectional?: boolean
  /** Which of the node's 4 side handles this edge is anchored to — without
   * these, multiple edges on a node with several handles resolve to an
   * ambiguous/default handle, which can make an existing edge's rendered
   * path jump or vanish once another edge is added. */
  sourceHandle?: string
  targetHandle?: string
  /** User-dragged bow amount (perpendicular px from the straight chord),
   * overriding the automatic multi-edge fan-out offset once set. */
  manualOffset?: number
}

export interface TimelineEntry {
  id: string
  time: string
  suspectId?: string
  text: string
}

const STORAGE_KEYS = {
  history: 'holmes_notebook_history',
  nodes: 'holmes_notebook_rel_nodes',
  edges: 'holmes_notebook_rel_edges',
  timeline: 'holmes_notebook_timeline',
  memo: 'holmes_notebook_memo',
  seeded: 'holmes_notebook_seeded',
}

/** useState backed by localStorage. Persistence runs in an effect (not inside
 * the updater) so updaters stay pure, and debounceMs lets high-frequency
 * updates (e.g. every keystroke) collapse into one write after they settle. */
function usePersistedState<T>(key: string, initial: T, debounceMs = 0): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => loadJson(key, initial))

  useEffect(() => {
    if (debounceMs === 0) {
      saveJson(key, value)
      return
    }
    const timer = setTimeout(() => saveJson(key, value), debounceMs)
    return () => clearTimeout(timer)
  }, [key, value, debounceMs])

  return [value, setValue]
}

let idCounter = 0
function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}_${Date.now()}_${idCounter}`
}

function circlePositions(count: number, cx = 320, cy = 240, r = 200): { x: number; y: number }[] {
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  })
}

interface CaseNotesContextValue {
  history: HistoryEntry[]
  appendHistory: (entry: Omit<HistoryEntry, 'id'>) => void

  relationshipNodes: RelationshipNode[]
  relationshipEdges: RelationshipEdge[]
  moveRelationshipNode: (id: string, x: number, y: number) => void
  addRelationshipNode: (label: string, x: number, y: number) => void
  updateRelationshipNodeLabel: (id: string, label: string) => void
  removeRelationshipNode: (id: string) => void
  addRelationshipEdge: (source: string, target: string, label: string, color?: string, bidirectional?: boolean, sourceHandle?: string, targetHandle?: string) => void
  updateRelationshipEdge: (id: string, label: string, color?: string, bidirectional?: boolean) => void
  updateRelationshipEdgeOffset: (id: string, manualOffset: number) => void
  removeRelationshipEdge: (id: string) => void

  timeline: TimelineEntry[]
  addTimelineEntry: (suspectId?: string) => void
  updateTimelineEntry: (id: string, patch: Partial<Omit<TimelineEntry, 'id'>>) => void
  removeTimelineEntry: (id: string) => void
  reorderTimeline: (fromId: string, toId: string) => void

  memo: string
  setMemo: (text: string) => void

  resetNotebook: () => void

  isNotebookOpen: boolean
  openNotebook: () => void
  closeNotebook: () => void
}

const Ctx = createContext<CaseNotesContextValue | null>(null)

export function CaseNotesProvider({ children }: { children: ReactNode }) {
  const { lang } = useLanguage()
  const { scenario, suspects: getSuspects } = useScenario()

  const [history, setHistory] = usePersistedState<HistoryEntry[]>(STORAGE_KEYS.history, [])
  const [relationshipNodes, setRelationshipNodes] = usePersistedState<RelationshipNode[]>(STORAGE_KEYS.nodes, [])
  const [relationshipEdges, setRelationshipEdges] = usePersistedState<RelationshipEdge[]>(STORAGE_KEYS.edges, [])
  // debounced: these change on every keystroke, no need to write localStorage that often
  const [timeline, setTimeline] = usePersistedState<TimelineEntry[]>(STORAGE_KEYS.timeline, [], 400)
  const [memo, setMemo] = usePersistedState<string>(STORAGE_KEYS.memo, '', 400)

  const [hasSeeded, setHasSeeded] = usePersistedState<boolean>(STORAGE_KEYS.seeded, false)

  // Ephemeral UI state (not persisted) — one notebook, shared across every page.
  const [isNotebookOpen, setIsNotebookOpen] = useState(false)
  const openNotebook = useCallback(() => setIsNotebookOpen(true), [])
  const closeNotebook = useCallback(() => setIsNotebookOpen(false), [])

  // Seed default relationship-graph nodes (victim + suspects) and one blank
  // alibi card per suspect, the first time scenario data is available, and
  // again after resetNotebook() flips hasSeeded back to false (e.g. "Start"
  // on the title screen triggers a reset before scenario/lang have changed,
  // so hasSeeded must be a reactive dependency, not a ref, or this effect
  // would never re-fire).
  useEffect(() => {
    if (hasSeeded || !scenario) return
    const susp = getSuspects(lang)
    if (susp.length === 0) return
    setHasSeeded(true)

    // Suspects come back already translated from getSuspects(); the victim has to go
    // through the scenario's Japanese display-name table the same way.
    const victimName = scenario.victim
      ? (lang === 'ja' ? scenario.displayNamesJa?.[scenario.victim.name] : undefined) ?? scenario.victim.name
      : ''
    const victimNode: RelationshipNode[] = scenario.victim
      ? [{ id: scenario.victim.id, label: victimName, x: 320, y: 240 }]
      : []
    const suspectPositions = circlePositions(susp.length)
    setRelationshipNodes([
      ...victimNode,
      ...susp.map((s, i) => ({ id: s.id, label: s.name, ...suspectPositions[i] })),
    ])

    setTimeline(susp.map(s => ({
      id: nextId('tl'),
      time: '',
      suspectId: s.id,
      text: lang === 'ja' ? `${s.name} のアリバイ` : `${s.name}'s alibi`,
    })))
  }, [hasSeeded, scenario, lang, getSuspects, setHasSeeded, setRelationshipNodes, setTimeline])

  const appendHistory = useCallback((entry: Omit<HistoryEntry, 'id'>) => {
    setHistory(prev => [...prev, { ...entry, id: nextId('hist') }])
  }, [setHistory])

  const moveRelationshipNode = useCallback((id: string, x: number, y: number) => {
    setRelationshipNodes(prev => prev.map(n => (n.id === id ? { ...n, x, y } : n)))
  }, [setRelationshipNodes])

  const addRelationshipNode = useCallback((label: string, x: number, y: number) => {
    setRelationshipNodes(prev => [...prev, { id: nextId('node'), label, x, y }])
  }, [setRelationshipNodes])

  const updateRelationshipNodeLabel = useCallback((id: string, label: string) => {
    setRelationshipNodes(prev => prev.map(n => (n.id === id ? { ...n, label } : n)))
  }, [setRelationshipNodes])

  const removeRelationshipNode = useCallback((id: string) => {
    setRelationshipNodes(prev => prev.filter(n => n.id !== id))
    setRelationshipEdges(prev => prev.filter(e => e.source !== id && e.target !== id))
  }, [setRelationshipNodes, setRelationshipEdges])

  const addRelationshipEdge = useCallback((source: string, target: string, label: string, color?: string, bidirectional?: boolean, sourceHandle?: string, targetHandle?: string) => {
    setRelationshipEdges(prev => [...prev, { id: nextId('edge'), source, target, label, color, bidirectional, sourceHandle, targetHandle }])
  }, [setRelationshipEdges])

  const updateRelationshipEdge = useCallback((id: string, label: string, color?: string, bidirectional?: boolean) => {
    setRelationshipEdges(prev => prev.map(e => (e.id === id ? { ...e, label, color, bidirectional } : e)))
  }, [setRelationshipEdges])

  const updateRelationshipEdgeOffset = useCallback((id: string, manualOffset: number) => {
    setRelationshipEdges(prev => prev.map(e => (e.id === id ? { ...e, manualOffset } : e)))
  }, [setRelationshipEdges])

  const removeRelationshipEdge = useCallback((id: string) => {
    setRelationshipEdges(prev => prev.filter(e => e.id !== id))
  }, [setRelationshipEdges])

  const addTimelineEntry = useCallback((suspectId?: string) => {
    setTimeline(prev => [...prev, { id: nextId('tl'), time: '', suspectId, text: '' }])
  }, [setTimeline])

  const updateTimelineEntry = useCallback((id: string, patch: Partial<Omit<TimelineEntry, 'id'>>) => {
    setTimeline(prev => prev.map(e => (e.id === id ? { ...e, ...patch } : e)))
  }, [setTimeline])

  const removeTimelineEntry = useCallback((id: string) => {
    setTimeline(prev => prev.filter(e => e.id !== id))
  }, [setTimeline])

  const reorderTimeline = useCallback((fromId: string, toId: string) => {
    setTimeline(prev => {
      const fromIdx = prev.findIndex(e => e.id === fromId)
      const toIdx = prev.findIndex(e => e.id === toId)
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
  }, [setTimeline])

  const resetNotebook = useCallback(() => {
    setHasSeeded(false)
    setHistory([])
    setRelationshipNodes([])
    setRelationshipEdges([])
    setTimeline([])
    setMemo('')
  }, [setHasSeeded, setHistory, setRelationshipNodes, setRelationshipEdges, setTimeline, setMemo])

  // All the CRUD callbacks are useCallback-stable, so the only things that
  // actually vary here are the raw state slices — memoizing on just those
  // keeps this object's identity stable across renders that don't touch
  // CaseNotes state (e.g. a re-render triggered by a sibling context).
  const value = useMemo<CaseNotesContextValue>(() => ({
    history,
    appendHistory,
    relationshipNodes,
    relationshipEdges,
    moveRelationshipNode,
    addRelationshipNode,
    updateRelationshipNodeLabel,
    removeRelationshipNode,
    addRelationshipEdge,
    updateRelationshipEdge,
    updateRelationshipEdgeOffset,
    removeRelationshipEdge,
    timeline,
    addTimelineEntry,
    updateTimelineEntry,
    removeTimelineEntry,
    reorderTimeline,
    memo,
    setMemo,
    resetNotebook,
    isNotebookOpen,
    openNotebook,
    closeNotebook,
  }), [
    history, relationshipNodes, relationshipEdges, timeline, memo, isNotebookOpen,
    appendHistory, moveRelationshipNode, addRelationshipNode, updateRelationshipNodeLabel,
    removeRelationshipNode, addRelationshipEdge, updateRelationshipEdge, updateRelationshipEdgeOffset,
    removeRelationshipEdge, addTimelineEntry, updateTimelineEntry, removeTimelineEntry,
    reorderTimeline, setMemo, resetNotebook, openNotebook, closeNotebook,
  ])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCaseNotes(): CaseNotesContextValue {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCaseNotes must be used within CaseNotesProvider')
  return ctx
}
