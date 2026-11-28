import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { SceneTransitionContext, type TransitionKind } from '../contexts/sceneTransitionContext'
import { footsteps } from '../utils/sfx'
import './SceneTransition.css'

type Phase = 'idle' | 'out' | 'hold' | 'in'

const FADE_MS = 350

/**
 * Wraps the app and provides `go()`: a black fade between two screens, with
 * footsteps while it is dark when the player is "walking" somewhere.
 */
export default function SceneTransition({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<Phase>('idle')
  const busy = useRef(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => () => timers.current.forEach(clearTimeout), [])

  const go = useCallback((to: string | number, kind: TransitionKind = 'walk') => {
    if (busy.current) return
    busy.current = true
    const later = (fn: () => void, ms: number) => timers.current.push(setTimeout(fn, ms))

    setPhase('out')
    const hold = kind === 'walk' ? footsteps(4, 0.28) : 150
    later(() => {
      setPhase('hold')
      if (typeof to === 'number') navigate(to)
      else navigate(to)
    }, FADE_MS)
    later(() => setPhase('in'), FADE_MS + hold)
    later(() => {
      setPhase('idle')
      busy.current = false
    }, FADE_MS * 2 + hold)
  }, [navigate])

  const value = useMemo(() => ({ go }), [go])

  return (
    <SceneTransitionContext.Provider value={value}>
      {children}
      <div className={`scene-fade is-${phase}`} aria-hidden="true" />
    </SceneTransitionContext.Provider>
  )
}
