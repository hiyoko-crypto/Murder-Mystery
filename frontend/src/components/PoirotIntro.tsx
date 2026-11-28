import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Panel } from './ui/Noir'
import './PoirotIntro.css'

const CHAR_MS = 38

/**
 * Poirot opens the case in his own words. Click to finish the current line,
 * click again for the next one; after the last line `onFinish` is called.
 */
export default function PoirotIntro({ lines, onFinish }: { lines: string[]; onFinish: () => void }) {
  const [pos, setPos] = useState({ idx: 0, count: 0 })
  const line = lines[pos.idx] ?? ''
  const done = pos.count >= line.length

  useEffect(() => {
    const id = setInterval(() => {
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
        <p className="poirot-intro__text">
          {line.slice(0, pos.count)}
        </p>
        {done && <ChevronDown size={20} className="poirot-intro__next" />}
      </Panel>
    </div>
  )
}
