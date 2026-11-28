import { useState } from 'react'
import { Volume2, VolumeX } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { click, isMuted, setMuted } from '../utils/sfx'

/** Speaker button that mutes / unmutes all sound effects (remembered between visits). */
export default function SoundToggle({ className = '' }: { className?: string }) {
  const { tt } = useLanguage()
  const [muted, setMutedState] = useState(isMuted)

  const toggle = () => {
    const next = !muted
    setMuted(next)
    setMutedState(next)
    if (!next) click()
  }

  const label = muted ? tt('効果音をオンにする', 'Turn sound on') : tt('効果音をオフにする', 'Turn sound off')
  return (
    <button className={`nr-close ${className}`} onClick={toggle} aria-label={label} title={label}>
      {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
    </button>
  )
}
