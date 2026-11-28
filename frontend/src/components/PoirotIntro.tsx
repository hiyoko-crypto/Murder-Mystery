import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { DetectiveMark, Panel } from './ui/Noir'
import { blip } from '../utils/sfx'
import './PoirotIntro.css'

const CHAR_MS = 38

/**
 * Poirot opens the case in his own words. Click to finish the current line,
 * click again for the next one; after the last line `onFinish` is called.
 */
export default function PoirotIntro({ lines, onFinish }: { lines: string[]; onFinish: () => void }) {
  const { tt } = useLanguage()
  const [pos, setPos] = useState({ idx: 0, count: 0 })
  const line = lines[pos.idx] ?? ''
  const done = pos.count >= line.length

  useEffect(() => {
    let ticks = 0
    const id = setInterval(() => {
      ticks++
      if (ticks <= line.length && ticks % 2 === 0) blip()
      setPos(p => ({ ...p, count: Math.min(p.count + 1, line.length) }))
    }, CHAR_MS)
    return () => clearInterval(id)
  }, [pos.idx, line.length])

  const advance = () => {
    if (!done) setPos({ idx: pos.idx, count: line.length })
    else if (pos.idx < lines.length - 1) setPos({ idx: pos.idx + 1, count: 0 })
    else onFinish()
  }

  return (
    <div className="poirot-intro" onClick={advance}>
      <Panel className="poirot-intro__box">
        <div className="poirot-intro__who">
          <DetectiveMark size={26} />
          <span>{tt('エルキュール・ポアロ', 'Hercule Poirot')}</span>
        </div>
        <p className="poirot-intro__text">
          {line.slice(0, pos.count)}
        </p>
        {done && <ChevronDown size={20} className="poirot-intro__next" />}
      </Panel>
    </div>
  )
}
