import { useEffect, useState } from 'react'
import { useLanguage } from '../contexts/LanguageContext'
import { blip } from '../utils/sfx'
import { DetectiveMark, Panel } from './ui/Noir'
import './PoirotBox.css'

const CHAR_MS = 32

/**
 * Poirot (the player) thinking out loud. Remount it with a new `key` for each
 * line; click to show the whole line at once.
 */
export default function PoirotBox({ text }: { text: string }) {
  const { tt } = useLanguage()
  const [count, setCount] = useState(0)

  useEffect(() => {
    let ticks = 0
    const id = setInterval(() => {
      ticks++
      if (ticks <= text.length && ticks % 2 === 0) blip()
      setCount(c => Math.min(c + 1, text.length))
    }, CHAR_MS)
    return () => clearInterval(id)
  }, [text])

  return (
    <Panel className="poirot-box">
      <div className="poirot-box__who">
        <DetectiveMark size={22} />
        <span>{tt('ポワロ', 'Poirot')}</span>
      </div>
      <p className="poirot-box__text" onClick={() => setCount(text.length)}>
        {text.slice(0, count)}
      </p>
    </Panel>
  )
}
