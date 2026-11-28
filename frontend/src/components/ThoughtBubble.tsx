import { useEffect, useState } from 'react'
import { blip } from '../utils/sfx'
import './ThoughtBubble.css'

const CHAR_MS = 26

/** Poirot's inner voice, shown near the top of the scene in parentheses.
 *  Remount it with a new `key` for each thought; click to move on. */
export default function ThoughtBubble({ text, onTap }: { text: string; onTap: () => void }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let ticks = 0
    const id = setInterval(() => {
      ticks++
      if (ticks <= text.length && ticks % 3 === 0) blip()
      setCount(c => Math.min(c + 1, text.length))
    }, CHAR_MS)
    return () => clearInterval(id)
  }, [text])

  return (
    <div className="thought" onClick={onTap}>
      <p className="thought__text">（{text.slice(0, count)}{count >= text.length ? '）' : ''}</p>
    </div>
  )
}
