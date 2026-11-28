import { useEffect, useState } from 'react'
import './ThoughtBubble.css'

const CHAR_MS = 26

/** Poirot's inner voice, shown near the top of the scene in parentheses.
 *  Remount it with a new `key` for each thought; click to move on. */
export default function ThoughtBubble({ text, onTap }: { text: string; onTap: () => void }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
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
