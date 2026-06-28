import { useState } from 'react'

// シンプルなグローバル状態（後でContextやZustandに移行可）
let globalEvidence: string[] = []
let globalFoundItems: string[] = []
const listeners: (() => void)[] = []

function notify() {
  listeners.forEach((fn) => fn())
}

export function useGameState() {
  const [, forceUpdate] = useState(0)

  const rerender = () => forceUpdate((n) => n + 1)
  if (!listeners.includes(rerender)) {
    listeners.push(rerender)
  }

  const addEvidence = (itemId: string) => {
    if (!globalEvidence.includes(itemId)) {
      globalEvidence = [...globalEvidence, itemId]
    }
    if (!globalFoundItems.includes(itemId)) {
      globalFoundItems = [...globalFoundItems, itemId]
    }
    notify()
  }

  const resetGame = () => {
    globalEvidence = []
    globalFoundItems = []
    notify()
  }

  return {
    evidence: globalEvidence,
    foundItems: globalFoundItems,
    addEvidence,
    resetGame,
  }
}
