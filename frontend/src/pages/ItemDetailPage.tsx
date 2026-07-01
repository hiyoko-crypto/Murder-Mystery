import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { useScenario } from '../contexts/ScenarioContext'
import { useGameState } from '../hooks/useGameState'
import { examineItem } from '../api/examine'
import './ItemDetailPage.css'

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { lang } = useLanguage()
  const { items: getItems } = useScenario()
  const { unlockLocation } = useGameState()
  const items = getItems(lang)

  const scenarioItem = items.find(i => i.id === id)

  const [detail, setDetail] = useState<{ name: string; description: string; significance: string } | null>(null)

  useEffect(() => {
    if (!id) return
    examineItem(id, lang)
      .then(res => {
        setDetail({ name: res.name, description: res.description, significance: res.significance })
        if (res.unlocked_location) unlockLocation(res.unlocked_location)
      })
      .catch(() => {
        // Fallback to scenario data
        if (scenarioItem) {
          setDetail({ name: scenarioItem.name, description: scenarioItem.detail, significance: '' })
        }
      })
  }, [id, lang]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!scenarioItem && !detail) {
    return <div>{lang === 'ja' ? 'アイテムが見つかりません' : 'Item not found'}</div>
  }

  const displayName = detail?.name ?? scenarioItem?.name ?? id
  const displayDesc = detail?.description ?? scenarioItem?.detail ?? ''
  const displaySig  = detail?.significance ?? ''

  return (
    <div className="item-detail-page">
      <div className="item-detail-card">
        <div className="item-detail-emoji">{scenarioItem?.emoji ?? '📦'}</div>
        <h2 className="item-detail-name">{displayName}</h2>
        <div className="item-detail-divider" />
        <p className="item-detail-text">{displayDesc}</p>
        {displaySig && (
          <p className="item-detail-text" style={{ marginTop: '0.75rem', fontStyle: 'italic', opacity: 0.85 }}>
            {displaySig}
          </p>
        )}
        <div className="item-detail-badge">{lang === 'ja' ? '証拠カードに追加済み' : 'Added to evidence'}</div>
        <button className="back-btn" onClick={() => navigate(-1)}>
          {lang === 'ja' ? '戻る' : 'Back'}
        </button>
      </div>
    </div>
  )
}
