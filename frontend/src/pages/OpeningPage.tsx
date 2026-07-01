import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getOpeningText } from '../data/mockData'
import { useLanguage } from '../contexts/LanguageContext'
import { useScenario } from '../contexts/ScenarioContext'
import { fetchBriefing } from '../api/examine'
import './OpeningPage.css'

export default function OpeningPage() {
  const navigate = useNavigate()
  const { lang, t } = useLanguage()
  const { locations: getLocations } = useScenario()

  const [briefingText, setBriefingText] = useState<string | null>(null)

  useEffect(() => {
    fetchBriefing(lang)
      .then(b => {
        const text = lang === 'ja'
          ? `${b.victim}\n\n${b.scene}`
          : `${b.victim}\n\nScene: ${b.scene}`
        setBriefingText(text)
      })
      .catch(() => setBriefingText(null))
  }, [lang])

  const firstLocationId = getLocations(lang)[0]?.id ?? 'garden'
  const openingText = briefingText ?? getOpeningText(lang)

  return (
    <div className="opening-page">
      <div className="opening-content">
        <pre className="opening-text">{openingText.trim()}</pre>
        <button className="opening-btn" onClick={() => navigate(`/location/${firstLocationId}`)}>
          {t('opening.next')}
        </button>
      </div>
    </div>
  )
}
