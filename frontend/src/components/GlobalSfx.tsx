import { useEffect } from 'react'
import { click } from '../utils/sfx'

/** Plays the press sound for every enabled button and card on every screen. */
export default function GlobalSfx() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null
      if (target?.closest('button:not(:disabled), .loc-card:not(:disabled)')) click()
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])
  return null
}
