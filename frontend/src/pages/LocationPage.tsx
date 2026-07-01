import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameState } from '../hooks/useGameState'
import { useLanguage } from '../contexts/LanguageContext'
import { useScenario } from '../contexts/ScenarioContext'
import { examineLocation } from '../api/examine'
import type { ExaminedItem } from '../api/examine'
import './LocationPage.css'

type Mode = 'menu' | 'examine' | 'talk' | 'move'

interface Discovery {
  itemId: string
  text: string
  emoji: string
  name: string
}

export default function LocationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { foundItems, addEvidence, unlockLocation, unlockedLocations } = useGameState()
  const { lang, t } = useLanguage()
  const { locations: getLocations, items: getItems, suspects: getSuspects, locationBg, examineRules } = useScenario()

  const locations   = getLocations(lang)
  const items       = getItems(lang)
  const allSuspects = getSuspects(lang)

  const [mode, setMode] = useState<Mode>('menu')
  const [discoveries, setDiscoveries] = useState<Discovery[]>([])
  const [allFound, setAllFound] = useState(false)
  const [examineLoading, setExamineLoading] = useState(false)
  // Items queued from backend, revealed one per click
  const [pendingItems, setPendingItems] = useState<ExaminedItem[]>([])
  const [backendFetched, setBackendFetched] = useState(false)

  useEffect(() => {
    setMode('menu')
    setDiscoveries([])
    setAllFound(false)
    setPendingItems([])
    setBackendFetched(false)
  }, [id])

  const location = locations.find((l) => l.id === id)
  if (!location) return <div>{t('not.found')}</div>

  const locationItems    = items.filter((item) => location.items.includes(item.id))
  const locationSuspects = allSuspects.filter((s) => location.suspects.includes(s.id))
  const otherLocations   = locations.filter((l) => l.id !== id && (examineRules ? unlockedLocations.includes(l.id) : true))
  const foundCount       = locationItems.filter((item) => foundItems.includes(item.id)).length

  const revealItem = (backendItem: ExaminedItem) => {
    addEvidence(backendItem.id)
    // Unlock location if this item triggers one (from examine_rules or backend response)
    const unlocks = examineRules?.itemUnlocksLocation[backendItem.id]
    if (unlocks) unlockLocation(unlocks)
    const scenarioItem = items.find(i => i.id === backendItem.id)
    setDiscoveries(prev => [...prev, {
      itemId: backendItem.id,
      text: backendItem.description,
      emoji: scenarioItem?.emoji ?? '📦',
      name: backendItem.name,
    }])
  }

  const handleExamineAction = async () => {
    // If backend items are queued, reveal the next one
    if (pendingItems.length > 0) {
      const [next, ...rest] = pendingItems
      setPendingItems(rest)
      revealItem(next)
      if (rest.length === 0) setAllFound(true)
      return
    }
    // Already fetched but nothing left
    if (backendFetched) { setAllFound(true); return }

    // First click: fetch from backend
    setExamineLoading(true)
    try {
      const result = await examineLocation(id!, lang)
      setBackendFetched(true)
      if (result.unlocked_location) unlockLocation(result.unlocked_location)
      const queue = result.newly_found
      if (queue.length === 0) {
        setAllFound(true)
      } else {
        const [first, ...rest] = queue
        setPendingItems(rest)
        revealItem(first)
        if (rest.length === 0) setAllFound(true)
      }
    } catch {
      // Fallback to local scenario data
      setBackendFetched(true)
      const nextItem = locationItems.find(item => {
        if (foundItems.includes(item.id)) return false
        if (!item.requiresItems) return true
        return item.requiresItems.every(req => foundItems.includes(req))
      })
      if (!nextItem) { setAllFound(true); return }
      addEvidence(nextItem.id)
      const unlocks = examineRules?.itemUnlocksLocation[nextItem.id]
      if (unlocks) unlockLocation(unlocks)
      setDiscoveries(prev => [...prev, {
        itemId: nextItem.id,
        text: nextItem.discoveryText,
        emoji: nextItem.emoji,
        name: nextItem.name,
      }])
    } finally {
      setExamineLoading(false)
    }
  }

  const bgUrl = locationBg(location.id)

  return (
    <div className="location-page">

      {/* ── レイヤー0: 背景画像（最底部・動かない） ── */}
      <div
        className="loc-bg"
        style={bgUrl ? { backgroundImage: `url(${bgUrl})` } : undefined}
      />

      {/* ── レイヤー1: グラデーションオーバーレイ ── */}
      <div className="loc-overlay" />

      {/* ── レイヤー2: UI（全て背景の上に浮く） ── */}

      {/* ヘッダー */}
      <div className="loc-header">
        <button className="back-btn" onClick={() => navigate(-1)}>
          {lang === 'ja' ? '← 戻る' : '← Back'}
        </button>
      </div>

      {/* 場所名 */}
      <div className="loc-title-area">
        <h2 className="loc-title">{location.name}</h2>
        {mode === 'menu' && <p className="loc-desc">{location.description}</p>}
      </div>

      {/* ── メニュー（3ボタン） ── */}
      {mode === 'menu' && (
        <div className="loc-panel loc-menu-panel">
          <div className="loc-action-row">
            <button className="loc-action-btn" onClick={() => { setDiscoveries([]); setAllFound(false); setMode('examine') }}>
              <span className="loc-action-icon">🔍</span>
              <span className="loc-action-label">{t('loc.examine')}</span>
              <span className="loc-action-hint">
                {foundCount > 0 ? `${foundCount} ${t('loc.found.hint')}` : t('loc.examine.hint')}
              </span>
            </button>
            <button
              className="loc-action-btn"
              onClick={() => setMode('talk')}
              disabled={locationSuspects.length === 0}
            >
              <span className="loc-action-icon">💬</span>
              <span className="loc-action-label">{t('loc.talk')}</span>
              <span className="loc-action-hint">
                {locationSuspects.length === 0 ? t('loc.nobody') : `${locationSuspects.length} ${t('loc.people')}`}
              </span>
            </button>
            <button className="loc-action-btn" onClick={() => setMode('move')}>
              <span className="loc-action-icon">🚶</span>
              <span className="loc-action-label">{lang === 'ja' ? '移動する' : 'Move'}</span>
              <span className="loc-action-hint">{lang === 'ja' ? '別の場所へ' : 'Go elsewhere'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ── 調べるパネル ── */}
      {mode === 'examine' && (
        <div className="loc-panel loc-content-panel">
          <div className="loc-panel-header">
            <span className="loc-panel-title">{location.name} {t('loc.examine.title')}</span>
            <button className="loc-panel-close" onClick={() => setMode('menu')}>✕</button>
          </div>
          <div className="loc-discovery-log">
            {discoveries.length === 0 && !allFound && (
              <p className="loc-examine-prompt">{t('loc.examine.start')}</p>
            )}
            {discoveries.map((d, i) => (
              <div key={i} className="loc-discovery-entry">
                <span className="loc-discovery-emoji">{d.emoji}</span>
                <div className="loc-discovery-text-wrap">
                  <p className="loc-discovery-text">{d.text}</p>
                  <button className="loc-detail-btn" onClick={() => navigate(`/item/${d.itemId}`)}>
                    {d.name} {t('loc.item.detail')}
                  </button>
                </div>
              </div>
            ))}
            {allFound && (
              <p className="loc-examine-done">
                {foundCount === 0 ? t('loc.examine.done0') : t('loc.examine.doneN')}
              </p>
            )}
            {foundCount > 0 && (
              <div className="loc-found-chips">
                {locationItems
                  .filter((item) => foundItems.includes(item.id))
                  .map((item) => (
                    <button key={item.id} className="loc-found-chip" onClick={() => navigate(`/item/${item.id}`)}>
                      {item.emoji} {item.name}
                    </button>
                  ))}
              </div>
            )}
          </div>
          {!allFound && (
            <button className="loc-examine-btn" onClick={handleExamineAction} disabled={examineLoading}>
              {examineLoading ? (lang === 'ja' ? '調査中...' : 'Examining...') : t('loc.examine.btn')}
            </button>
          )}
        </div>
      )}

      {/* ── 話すパネル ── */}
      {mode === 'talk' && (
        <div className="loc-panel loc-content-panel">
          <div className="loc-panel-header">
            <span className="loc-panel-title">{t('loc.talk.title')}</span>
            <button className="loc-panel-close" onClick={() => setMode('menu')}>✕</button>
          </div>
          <div className="loc-talk-list">
            {locationSuspects.map((suspect) => (
              <button
                key={suspect.id}
                className="loc-suspect-btn"
                onClick={() => navigate(`/interrogate/${suspect.id}`)}
              >
                <span className="loc-suspect-name">{suspect.name}</span>
                <span className="loc-suspect-arrow">→</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── 移動オーバーレイ（背景の上に全面） ── */}
      {mode === 'move' && (
        <div className="loc-move-overlay">
          <div className="loc-move-panel">
            <div className="loc-panel-header">
              <span className="loc-panel-title">
                {lang === 'ja' ? '— 移動先を選ぶ —' : '— Choose Destination —'}
              </span>
              <button className="loc-panel-close" onClick={() => setMode('menu')}>✕</button>
            </div>
            <div className="loc-move-list">
              {otherLocations.map((loc) => (
                <button
                  key={loc.id}
                  className="loc-move-btn"
                  style={{ backgroundImage: `url(${locationBg(loc.id)})` }}
                  onClick={() => navigate(`/location/${loc.id}`)}
                >
                  <div className="loc-move-btn-inner">
                    <span className="loc-move-name">{loc.name}</span>
                    <span className="loc-move-desc">{loc.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
