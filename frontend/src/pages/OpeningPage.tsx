import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { useScenario } from '../contexts/ScenarioContext'
import { fetchBriefing } from '../api/examine'
import './OpeningPage.css'

export default function OpeningPage() {
  const navigate = useNavigate()
  const { lang, t } = useLanguage()
  const { locations: getLocations } = useScenario()

  const [briefingText, setBriefingText] = useState<string | null>(null)
  const [briefingError, setBriefingError] = useState<string | null>(null)

  useEffect(() => {
    setBriefingText(null)
    setBriefingError(null)
    fetchBriefing(lang)
      .then(b => {
        const text = lang === 'ja'
          ? `${b.title}\n\n${b.setting}\n\n${b.victim}\n\n現場: ${b.scene}\n凶器: ${b.weapon}`
          : `${b.title}\n\n${b.setting}\n\n${b.victim}\n\nScene: ${b.scene}\nWeapon: ${b.weapon}`
        setBriefingText(text)
      })
      .catch((err) => {
        console.error('[OpeningPage] briefing fetch failed:', err)
        setBriefingError(
          lang === 'ja'
            ? '事件概要を取得できませんでした。バックエンドの /briefing を確認してください。'
            : 'Failed to load the case briefing. Check the backend /briefing endpoint.',
        )
      })
  }, [lang])

  const firstLocationId = getLocations(lang)[0]?.id ?? 'garden'
  const openingText = briefingText ?? briefingError ?? (lang === 'ja' ? '事件概要を読み込み中...' : 'Loading case briefing...')

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
