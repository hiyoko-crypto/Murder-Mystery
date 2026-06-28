import { useNavigate } from 'react-router-dom'
import { getOpeningText } from '../data/mockData'
import { useLanguage } from '../contexts/LanguageContext'
import './OpeningPage.css'

export default function OpeningPage() {
  const navigate = useNavigate()
  const { lang, t } = useLanguage()

  return (
    <div className="opening-page">
      <div className="opening-content">
        <pre className="opening-text">{getOpeningText(lang).trim()}</pre>
        <button className="opening-btn" onClick={() => navigate('/location/garden')}>
          {t('opening.next')}
        </button>
      </div>
    </div>
  )
}
