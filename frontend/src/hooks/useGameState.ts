import { useState } from 'react'

let globalEvidence: string[] = []
let globalFoundItems: string[] = []
let globalUnlockedLocations: string[] = []
let globalSpokenTo: string[] = []  // suspect IDs the player has talked to
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

  const unlockLocation = (locId: string) => {
    if (locId && !globalUnlockedLocations.includes(locId)) {
      globalUnlockedLocations = [...globalUnlockedLocations, locId]
      notify()
    }
  }

  const markSpokenTo = (suspectId: string) => {
    if (!globalSpokenTo.includes(suspectId)) {
      globalSpokenTo = [...globalSpokenTo, suspectId]
      notify()
    }
  }

  const resetGame = () => {
    globalEvidence = []
    globalFoundItems = []
    globalUnlockedLocations = []
    globalSpokenTo = []
    notify()
  }

  return {
    evidence: globalEvidence,
    foundItems: globalFoundItems,
    unlockedLocations: globalUnlockedLocations,
    spokenTo: globalSpokenTo,
    addEvidence,
    unlockLocation,
    markSpokenTo,
    resetGame,
  }
}
