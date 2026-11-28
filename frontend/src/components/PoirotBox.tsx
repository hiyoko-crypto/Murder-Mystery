import { useEffect, useState } from 'react'
import { Panel } from './ui/Noir'
import './PoirotBox.css'

const CHAR_MS = 32

/**
 * Poirot (the player) thinking out loud. Remount it with a new `key` for each
 * line; click to show the whole line at once.
 */
export default function PoirotBox({ text }: { text: string }) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setCount(c => Math.min(c + 1, text.length))
    }, CHAR_MS)
    return () => clearInterval(id)
  }, [text])

  return (
    <Panel className="poirot-box">
      <p className="poirot-box__text" onClick={() => setCount(text.length)}>
        {text.slice(0, count)}
      </p>
    </Panel>
  )
}
