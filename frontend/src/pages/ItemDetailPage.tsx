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
  const { items: getItems, locations: getLocations } = useScenario()
  const { unlockLocation } = useGameState()
  const items = getItems(lang)
  const locations = getLocations(lang)

  const scenarioItem = items.find(i => i.id === id)

  const [detail, setDetail] = useState<{ name: string; description: string; significance: string } | null>(null)
  const [newLocId, setNewLocId] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setNewLocId(null)
    examineItem(id, lang)
      .then(res => {
        setDetail({ name: res.name, description: res.description, significance: res.significance })
        if (res.unlocked_location) {
          unlockLocation(res.unlocked_location)
          setNewLocId(res.unlocked_location)
        }
      })
      .catch(() => {
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
  const newLocName  = newLocId ? (locations.find(l => l.id === newLocId)?.name ?? newLocId) : null

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

        {newLocName && (
          <div className="item-unlock-notice">
            <p className="item-unlock-text">
              🗺️ {lang === 'ja' ? `新しい場所が解放されました：${newLocName}` : `New area unlocked: ${newLocName}`}
            </p>
            <button className="item-unlock-btn" onClick={() => navigate(`/location/${newLocId}`)}>
              {lang === 'ja' ? `${newLocName} へ移動` : `Go to ${newLocName}`}
            </button>
          </div>
        )}

        <button className="back-btn" onClick={() => navigate(-1)}>
          {lang === 'ja' ? '戻る' : 'Back'}
        </button>
      </div>
    </div>
  )
}
