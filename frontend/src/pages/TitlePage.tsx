import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { useGame } from '../contexts/GameContext'
import { BG_LIBRARY } from '../utils/backgroundMatch'
import { DetectiveMark, GoldButton, OrnamentDivider } from '../components/ui/Noir'
import type { Lang } from '../i18n'
import './TitlePage.css'

// A study / library photo until a dedicated title illustration exists.
const titleBg = BG_LIBRARY.find(b => b.keywords.includes('study'))?.url ?? BG_LIBRARY[0].url

const LANGS: { value: Lang; label: string }[] = [
  { value: 'ja', label: '日本語' },
  { value: 'en', label: 'English' },
]

export default function TitlePage() {
  const navigate = useNavigate()
  const { lang, setLang } = useLanguage()
  const { resetGame } = useGame()

  const handleStart = async () => {
    await resetGame()
    navigate('/scenario-select')
  }

  return (
    <div className="noir">
      <div className="nr-scene title" style={{ backgroundImage: `url(${titleBg})` }}>
        <div className="title__content">
          <div className="title__mark">
            <DetectiveMark size={64} />
          </div>
          <h1 className="title__logo nr-gold-text">POIROT</h1>
          <p className="title__subtitle">A Mystery Investigation</p>
          <OrnamentDivider style={{ width: 300 }} />

          <div className="title__langs" role="radiogroup" aria-label="Language">
            {LANGS.map(l => (
              <button
                key={l.value}
                role="radio"
                aria-checked={lang === l.value}
                className={`title__lang${lang === l.value ? ' is-active' : ''}`}
                onClick={() => setLang(l.value)}
              >
                {l.label}
              </button>
            ))}
          </div>

          <GoldButton
            size="lg"
            variant="primary"
            label={lang === 'ja' ? 'ゲーム開始' : 'Start Game'}
            sub={lang === 'ja' ? 'Start Game' : undefined}
            chevron
            onClick={handleStart}
          />
        </div>
      </div>
    </div>
  )
}
