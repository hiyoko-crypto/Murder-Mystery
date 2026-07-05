import { useNavigate } from 'react-router-dom'
import { useGame } from '../contexts/GameContext'
import { useScenario } from '../contexts/ScenarioContext'
import { useLanguage } from '../contexts/LanguageContext'
import './EvidencePage.css'

export default function EvidencePage() {
  const navigate = useNavigate()
  const { foundItems } = useGame()
  const { items: getItems } = useScenario()
  const { lang } = useLanguage()

  const allItems = getItems(lang)
  const evidenceItems = allItems.filter((item) => foundItems.includes(item.id))

  return (
    <div className="evidence-page">
      <div className="evidence-header">
        <button className="back-btn" onClick={() => navigate('/map')}>← マップに戻る</button>
        <h2>証拠カード</h2>
      </div>
      {evidenceItems.length === 0 ? (
        <p className="empty">まだ証拠が見つかっていない</p>
      ) : (
        <div className="evidence-grid">
          {evidenceItems.map((item) => (
            <button
              key={item.id}
              className="evidence-card"
              onClick={() => navigate(`/item/${item.id}`)}
            >
              <span className="evidence-emoji">{item.emoji}</span>
              <span className="evidence-name">{item.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
