import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { useScenario } from '../contexts/ScenarioContext'
import { fetchBriefing, type BriefingResult } from '../api/examine'
import './OpeningPage.css'

export default function OpeningPage() {
  const navigate = useNavigate()
  const { lang, t } = useLanguage()
  const { examineRules } = useScenario()

  const [briefing, setBriefing] = useState<BriefingResult | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchBriefing(lang)
      .then(b => setBriefing(b))
      .catch(() => setBriefing(null))
      .finally(() => setLoading(false))
  }, [lang])

  const firstLocationId = examineRules?.initialLocations[0] ?? ''

  const ja = lang === 'ja'

  return (
    <div className="opening-page">
      <div className="opening-content">
        {loading ? (
          <p className="opening-text" style={{ opacity: 0.5 }}>
            {ja ? '読み込み中...' : 'Loading...'}
          </p>
        ) : briefing ? (
          <div className="briefing-card">
            <p className="briefing-eyebrow">{ja ? '事件報告書' : 'CASE FILE'}</p>
            <h2 className="briefing-title">{briefing.title}</h2>
            <div className="briefing-divider" />

            <p className="briefing-setting">{briefing.setting}</p>

            <div className="briefing-victim-block">
              <span className="briefing-victim-label">{ja ? '被害者' : 'VICTIM'}</span>
              <p className="briefing-victim-text">{briefing.victim}</p>
            </div>

            <div className="briefing-facts">
              <div className="briefing-fact">
                <span className="briefing-fact-icon">⏰</span>
                <span className="briefing-fact-label">{ja ? '死亡推定' : 'Time of Death'}</span>
                <span className="briefing-fact-value">{briefing.time_of_murder}</span>
              </div>
              <div className="briefing-fact">
                <span className="briefing-fact-icon">🔍</span>
                <span className="briefing-fact-label">{ja ? '発見時刻' : 'Discovered'}</span>
                <span className="briefing-fact-value">{briefing.time_discovered}</span>
              </div>
              <div className="briefing-fact">
                <span className="briefing-fact-icon">🗡️</span>
                <span className="briefing-fact-label">{ja ? '凶器' : 'Weapon'}</span>
                <span className="briefing-fact-value">{briefing.weapon}</span>
              </div>
            </div>

            <p className="briefing-scene">📍 {briefing.scene}</p>
          </div>
        ) : (
          <p className="opening-text">
            {ja
              ? '事件の詳細を読み込めませんでした。\nバックエンドが起動しているか確認してください。'
              : 'Could not load case details.\nPlease make sure the backend is running.'}
          </p>
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
