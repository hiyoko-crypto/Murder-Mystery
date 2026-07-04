import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { useScenario } from '../contexts/ScenarioContext'
import { fetchBriefing } from '../api/examine'
import './OpeningPage.css'

export default function OpeningPage() {
  const navigate = useNavigate()
  const { lang, t } = useLanguage()
  const { examineRules } = useScenario()

  const [briefingText, setBriefingText] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchBriefing(lang)
      .then(b => {
        const text = lang === 'ja'
          ? `${b.victim}\n\n${b.scene}`
          : `${b.victim}\n\nScene: ${b.scene}`
        setBriefingText(text)
      })
      .catch(() => setBriefingText(null))
      .finally(() => setLoading(false))
  }, [lang])

  const firstLocationId = examineRules?.initialLocations[0] ?? ''

  const fallbackText = lang === 'ja'
    ? '事件の詳細を読み込めませんでした。\nバックエンドが起動しているか確認してください。'
    : 'Could not load case details.\nPlease make sure the backend is running.'

  return (
    <div className="opening-page">
      <div className="opening-content">
        {loading ? (
          <p className="opening-text" style={{ opacity: 0.5 }}>
            {lang === 'ja' ? '読み込み中...' : 'Loading...'}
          </p>
        ) : (
          <pre className="opening-text">{(briefingText ?? fallbackText).trim()}</pre>
        )}
        <button
          className="opening-btn"
          onClick={() => navigate(`/location/${firstLocationId}`)}
          disabled={loading || !firstLocationId}
        >
          {t('opening.next')}
        </button>
      </div>
    </div>
  )
}
