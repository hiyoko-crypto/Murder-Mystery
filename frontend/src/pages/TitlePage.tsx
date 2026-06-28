import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { useGameState } from '../hooks/useGameState'
import './TitlePage.css'

export default function TitlePage() {
  const navigate = useNavigate()
  const { lang, setLang, t } = useLanguage()
  const { resetGame } = useGameState()

  const handleStart = () => {
    resetGame()
    navigate('/opening')
  }

  return (
    <div className="title-page">
      <div className="title-lang-toggle">
        <button
          className={`lang-btn${lang === 'ja' ? ' active' : ''}`}
          onClick={() => setLang('ja')}
        >JA</button>
        <button
          className={`lang-btn${lang === 'en' ? ' active' : ''}`}
          onClick={() => setLang('en')}
        >EN</button>
      </div>
      <div className="title-content">
        <h1 className="title-logo">HOLMES</h1>
        <p className="title-subtitle">{t('title.subtitle')}</p>
        <button className="title-btn" onClick={handleStart}>
          {t('title.start')}
        </button>
      </div>
    </div>
  )
}
