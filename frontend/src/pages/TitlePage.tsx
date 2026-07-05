import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { useGame } from '../contexts/GameContext'
import './TitlePage.css'

export default function TitlePage() {
  const navigate = useNavigate()
  const { t } = useLanguage()
  const { resetGame } = useGame()

  const handleStart = async () => {
    await resetGame()
    navigate('/language')
  }

  return (
    <div className="title-page">
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
