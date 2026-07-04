import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameState } from '../hooks/useGameState'
import { useLanguage } from '../contexts/LanguageContext'
import { useScenario } from '../contexts/ScenarioContext'
import { examineLocation, examineItem } from '../api/examine'
import './LocationPage.css'

type Mode = 'menu' | 'examine' | 'found-list' | 'item-detail' | 'talk' | 'move'

interface Discovery {
  itemId: string
  text: string
  emoji: string
  name: string
}

export default function LocationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { foundItems, addEvidence, unlockedLocations, unlockLocation } = useGameState()
  const { lang, t } = useLanguage()
  const { locations: getLocations, items: getItems, suspects: getSuspects, locationBg, examineRules } = useScenario()

  const locations   = getLocations(lang)
  const items       = getItems(lang)
  const allSuspects = getSuspects(lang)

  const [mode, setMode] = useState<Mode>('menu')
  const [discoveries, setDiscoveries] = useState<Discovery[]>([])
  const [allFound, setAllFound] = useState(false)
  const [examineLoading, setExamineLoading] = useState(false)

  // Item detail state
  const [selectedItem, setSelectedItem] = useState<Discovery | null>(null)
  const [itemSignificance, setItemSignificance] = useState<string>('')
  const [itemDetailLoading, setItemDetailLoading] = useState(false)
  const [unlockNoticeName, setUnlockNoticeName] = useState<string | null>(null)
  const [unlockNoticeLocId, setUnlockNoticeLocId] = useState<string | null>(null)
  // Track which items have been viewed (to show unlock notice only on first view)
  const [viewedItems, setViewedItems] = useState<string[]>([])

  useEffect(() => {
    setMode('menu')
    setDiscoveries([])
    setAllFound(false)
    setViewedItems([])
  }, [id])

  const location = locations.find((l) => l.id === id)
  if (!location) return <div>{t('not.found')}</div>

  const locationItems    = items.filter((item) => location.items.includes(item.id))
  const locationSuspects = allSuspects.filter((s) => location.suspects.includes(s.id))
  const otherLocations   = locations.filter((l) => l.id !== id && (examineRules ? unlockedLocations.includes(l.id) : true))
  const foundCount       = locationItems.filter((item) => foundItems.includes(item.id)).length

  const handleExamineAction = async () => {
    if (allFound) {
      setMode('found-list')
      return
    }
    setMode('examine')
    setExamineLoading(true)
    try {
      const result = await examineLocation(id!, lang)
      const allItems = [...result.newly_found, ...result.already_found]
      const newDiscoveries: Discovery[] = allItems.map(backendItem => {
        addEvidence(backendItem.id)
        const scenarioItem = items.find(i => i.id === backendItem.id)
        return {
          itemId: backendItem.id,
          text: backendItem.description,
          emoji: scenarioItem?.emoji ?? '📦',
          name: backendItem.name,
        }
      })
      setDiscoveries(newDiscoveries)
      setAllFound(true)
      setMode('found-list')
    } catch {
      // Fallback to local scenario data
      const unfound = locationItems.filter(item => !foundItems.includes(item.id))
      unfound.forEach(item => addEvidence(item.id))
      const fallback = unfound.map(item => ({
        itemId: item.id,
        text: item.discoveryText,
        emoji: item.emoji,
        name: item.name,
      }))
      setDiscoveries(fallback)
      setAllFound(true)
      setMode('found-list')
    } finally {
      setExamineLoading(false)
    }
  }

  const handleItemClick = async (item: Discovery) => {
    setSelectedItem(item)
    setItemSignificance('')
    setUnlockNoticeName(null)
    setUnlockNoticeLocId(null)
    setMode('item-detail')

    const isFirstView = !viewedItems.includes(item.itemId)
    if (isFirstView) {
      setViewedItems(prev => [...prev, item.itemId])
    }

    setItemDetailLoading(true)
    try {
      const res = await examineItem(item.itemId, lang)
      setItemSignificance(res.significance ?? '')
      if (isFirstView && res.unlocked_location) {
        unlockLocation(res.unlocked_location)
        const locName = locations.find(l => l.id === res.unlocked_location)?.name ?? res.unlocked_location
        setUnlockNoticeName(locName)
        setUnlockNoticeLocId(res.unlocked_location)
      }
    } catch {
      // significance stays empty on failure
    } finally {
      setItemDetailLoading(false)
    }
  }

  const handleHeaderBtn = () => {
    if (mode === 'item-detail') setMode('found-list')
    else if (mode === 'menu') navigate(-1)
    else setMode('menu')
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
        <button className="back-btn" onClick={handleHeaderBtn}>
          {mode === 'item-detail'
            ? (lang === 'ja' ? '← 一覧へ' : '← List')
            : (lang === 'ja' ? '← 戻る' : '← Back')}
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
            <button
              className="loc-action-btn"
              onClick={handleExamineAction}
              disabled={examineLoading}
            >
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

      {/* ── 調べる（ローディング中のみ表示） ── */}
      {mode === 'examine' && (
        <div className="loc-panel loc-content-panel">
          <div className="loc-panel-header">
            <span className="loc-panel-title">{location.name} {t('loc.examine.title')}</span>
            <button className="loc-panel-close" onClick={() => setMode('menu')}>✕</button>
          </div>
          <div className="loc-discovery-log">
            <p className="loc-examine-prompt">
              {lang === 'ja' ? '調査中...' : 'Examining...'}
            </p>
          </div>
        </div>
      )}

      {/* ── 発見済みアイテム一覧 ── */}
      {mode === 'found-list' && (
        <div className="loc-panel loc-content-panel">
          <div className="loc-panel-header">
            <span className="loc-panel-title">
              {lang === 'ja' ? '発見した手がかり' : 'CLUES FOUND'}
            </span>
            <button className="loc-panel-close" onClick={() => setMode('menu')}>✕</button>
          </div>
          <div className="loc-discovery-log">
            {discoveries.length === 0 && (
              <p className="loc-examine-done">{t('loc.examine.done0')}</p>
            )}
            {discoveries.map((d, i) => (
              <button
                key={i}
                className="loc-found-item-btn"
                onClick={() => handleItemClick(d)}
              >
                <span className="loc-discovery-emoji">{d.emoji}</span>
                <div className="loc-discovery-text-wrap">
                  <span className="loc-found-item-name">{d.name}</span>
                  <span className="loc-found-item-hint">
                    {lang === 'ja' ? '詳細を見る →' : 'View details →'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── アイテム詳細（全画面オーバーレイ） ── */}
      {mode === 'item-detail' && selectedItem && (
        <div className="loc-item-detail-overlay">
          <div className="loc-item-detail-card">

            <div className="loc-item-card-header">
              <span className="loc-item-card-eyebrow">
                {lang === 'ja' ? '手がかり' : 'CLUE'}
              </span>
              <button className="loc-panel-close" onClick={() => setMode('found-list')}>✕</button>
            </div>

            <div className="loc-item-card-body">
              <div className="loc-item-detail-emoji">{selectedItem.emoji}</div>
              <h3 className="loc-item-detail-name">{selectedItem.name}</h3>
              <div className="loc-item-detail-divider" />
              <p className="loc-item-detail-text">{selectedItem.text}</p>
              {itemDetailLoading && (
                <p className="loc-item-loading">{lang === 'ja' ? '読み込み中...' : 'Loading...'}</p>
              )}
              {!itemDetailLoading && itemSignificance && (
                <p className="loc-item-detail-text loc-item-significance">{itemSignificance}</p>
              )}
              <div className="loc-item-detail-badge">
                {lang === 'ja' ? '証拠カードに追加済み' : 'Added to evidence'}
              </div>
              {unlockNoticeName && (
                <div className="loc-item-unlock-notice">
                  <p>🗺️ {lang === 'ja' ? `新しいエリアが解放されました：${unlockNoticeName}` : `New area unlocked: ${unlockNoticeName}`}</p>
                  <button
                    className="loc-item-unlock-btn"
                    onClick={() => navigate(`/location/${unlockNoticeLocId}`)}
                  >
                    {lang === 'ja' ? `${unlockNoticeName} へ移動` : `Go to ${unlockNoticeName}`}
                  </button>
                </div>
              )}
            </div>

          </div>
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
