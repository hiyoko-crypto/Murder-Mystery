import { createContext, useContext } from 'react'

export type TransitionKind = 'walk' | 'fade'

export interface SceneTransitionValue {
  /** Fade to black (with footsteps for 'walk'), navigate, then fade back in. */
  go: (to: string | number, kind?: TransitionKind) => void
}

export const SceneTransitionContext = createContext<SceneTransitionValue>({
  go: () => {},
})

export function useSceneTransition(): SceneTransitionValue {
  return useContext(SceneTransitionContext)
}
