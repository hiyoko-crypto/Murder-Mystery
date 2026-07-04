import { useNavigate } from 'react-router-dom'
import { useGameState } from '../hooks/useGameState'
import { useScenario } from '../contexts/ScenarioContext'
import { useLanguage } from '../contexts/LanguageContext'
import './EvidencePage.css'

export default function EvidencePage() {
  const navigate = useNavigate()
  const { evidence } = useGameState()
  const { items: getItems } = useScenario()
  const { lang } = useLanguage()

  const allItems = getItems(lang)
  const foundItems = allItems.filter((item) => evidence.includes(item.id))

  return (
    <div className="evidence-page">
      <div className="evidence-header">
        <button className="back-btn" onClick={() => navigate('/map')}>← マップに戻る</button>
        <h2>証拠カード</h2>
      </div>
      {foundItems.length === 0 ? (
        <p className="empty">まだ証拠が見つかっていない</p>
      ) : (
        <div className="evidence-grid">
          {foundItems.map((item) => (
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
