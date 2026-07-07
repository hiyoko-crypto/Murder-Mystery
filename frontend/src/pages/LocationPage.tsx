import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame } from '../contexts/GameContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useScenario } from '../contexts/ScenarioContext'
import { useCaseNotes } from '../contexts/CaseNotesContext'
import { examineLocation, examineItem, fetchBriefing, type BriefingResult } from '../api/examine'
import ConfirmResetDialog from '../components/ConfirmResetDialog'
import NotebookLauncher from '../components/notebook/NotebookLauncher'
import BgCredit from '../components/BgCredit'
import './LocationPage.css'
import './OpeningPage.css'

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
  const { foundItems, unlockedLocations, refetchState, resetGame } = useGame()
  const { lang, t } = useLanguage()
  const { locations: getLocations, items: getItems, suspects: getSuspects, locationBg } = useScenario()
  const { appendHistory } = useCaseNotes()

  const locations   = getLocations(lang)
  const items       = getItems(lang)
  const allSuspects = getSuspects(lang)

  const [mode, setMode] = useState<Mode>('menu')
  const [discoveries, setDiscoveries] = useState<Discovery[]>([])
  const [allFound, setAllFound] = useState(false)

  // Item detail state
  const [selectedItem, setSelectedItem] = useState<Discovery | null>(null)
  const [itemSignificance, setItemSignificance] = useState<string>('')
  const [itemDetailLoading, setItemDetailLoading] = useState(false)
  const [unlockNoticeName, setUnlockNoticeName] = useState<string | null>(null)

  // Case File overlay
  const [showCaseFile, setShowCaseFile] = useState(false)
  const [briefing, setBriefing] = useState<BriefingResult | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)

  // Main menu confirm
  const [showMenuConfirm, setShowMenuConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    setMode('menu')
    setDiscoveries([])
    setAllFound(false)
  }, [id])

  const location = locations.find((l) => l.id === id)
  if (!location) return <div>{t('not.found')}</div>

  const locationItems    = items.filter((item) => location.items.includes(item.id))
  const moveLocations    = locations.filter((l) => unlockedLocations.includes(l.id))
  const foundCount       = locationItems.filter((item) => foundItems.includes(item.id)).length

  const handleExamineAction = async () => {
    if (allFound) {
      setMode('found-list')
      return
    }
    setMode('examine')
    try {
      const result = await examineLocation(id!, lang)
      const allItems = [...result.newly_found, ...result.already_found]
      const newDiscoveries: Discovery[] = allItems.map(backendItem => {
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
      if (result.newly_found.length > 0) {
        appendHistory({
          type: 'examine_location',
          locationId: id,
          itemIds: result.newly_found.map(i => i.id),
          summary: lang === 'ja'
            ? `${location.name}を調べ、${result.newly_found.map(i => i.name).join('、')}を発見`
            : `Examined ${location.name}, found ${result.newly_found.map(i => i.name).join(', ')}`,
        })
      }
      await refetchState()
    } catch {
      setMode('menu')
    }
  }

  const handleItemClick = async (item: Discovery) => {
    setSelectedItem(item)
    setItemSignificance('')
    setUnlockNoticeName(null)
    setMode('item-detail')

    setItemDetailLoading(true)
    try {
      const res = await examineItem(item.itemId, lang)
      setItemSignificance(res.significance ?? '')
      if (res.unlocked_location) {
        const locName = locations.find(l => l.id === res.unlocked_location)?.name ?? res.unlocked_location
        setUnlockNoticeName(locName)
        appendHistory({
          type: 'unlock_location',
          locationId: res.unlocked_location,
          itemIds: [item.itemId],
          summary: lang === 'ja'
            ? `${item.name}を調べ、${locName}が解放された`
            : `Examining ${item.name} unlocked ${locName}`,
        })
        await refetchState()
      }
    } catch {
      // significance stays empty on failure
    } finally {
      setItemDetailLoading(false)
    }
  }

  const handleOpenCaseFile = async () => {
    setShowCaseFile(true)
    if (!briefing && !briefingLoading) {
      setBriefingLoading(true)
      try {
        const b = await fetchBriefing(lang)
        setBriefing(b)
      } catch { /* ignore */ } finally {
        setBriefingLoading(false)
      }
    }
  }

  const handleConfirmReturn = async () => {
    setResetting(true)
    await resetGame()
    navigate('/')
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
        <div className="loc-header-group">
          <button className="back-btn" onClick={handleOpenCaseFile}>
            {lang === 'ja' ? '📋 事件概要' : '📋 Case File'}
          </button>
          <NotebookLauncher className="loc-notebook-btn" />
        </div>
        <button className="loc-menu-btn" onClick={() => setShowMenuConfirm(true)}>
          {lang === 'ja' ? 'メインメニューに戻る' : 'Return to Main Menu'}
        </button>
      </div>

      {/* 場所名 */}
      <div className="loc-title-area">
        <h2 className="loc-title">{location.name}</h2>
        {mode === 'menu' && lang === 'en' && <p className="loc-desc">{location.description}</p>}
      </div>

      {/* ── メニュー（3ボタン） ── */}
      {mode === 'menu' && (
        <div className="loc-panel loc-menu-panel">
          <div className="loc-action-row">
            <button
              className="loc-action-btn"
              onClick={handleExamineAction}
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
              disabled={allSuspects.length === 0}
            >
              <span className="loc-action-icon">💬</span>
              <span className="loc-action-label">{t('loc.talk')}</span>
              <span className="loc-action-hint">
                {allSuspects.length === 0 ? t('loc.nobody') : `${allSuspects.length} ${t('loc.people')}`}
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
            <button className="icon-btn-close" onClick={() => setMode('menu')}>✕</button>
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
            <button className="icon-btn-close" onClick={() => setMode('menu')}>✕</button>
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
              <button className="icon-btn-close" onClick={() => setMode('found-list')}>✕</button>
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
              <div className="evidence-added-badge">
                <span className="evidence-added-badge-check">✓</span>
                {lang === 'ja' ? '証拠カードに追加済み' : 'Added to evidence'}
              </div>
              {unlockNoticeName && (
                <div className="loc-item-unlock-notice">
                  <p>🗺️ {lang === 'ja' ? `新しいエリアが解放されました：${unlockNoticeName}` : `New area unlocked: ${unlockNoticeName}`}</p>
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
            <button className="icon-btn-close" onClick={() => setMode('menu')}>✕</button>
          </div>
          <div className="loc-talk-list">
            {allSuspects.map((suspect) => (
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
              <button className="icon-btn-close" onClick={() => setMode('menu')}>✕</button>
            </div>
            <div className="loc-move-list">
              {moveLocations.map((loc) => {
                const isCurrent = loc.id === id
                return (
                  <button
                    key={loc.id}
                    className={`loc-move-btn${isCurrent ? ' current' : ''}`}
                    style={{ backgroundImage: `url(${locationBg(loc.id)})` }}
                    onClick={() => navigate(`/location/${loc.id}`)}
                    disabled={isCurrent}
                  >
                    <div className="loc-move-btn-inner">
                      <span className="loc-move-name">
                        {loc.name}
                        {isCurrent && <span className="loc-move-here">{lang === 'ja' ? '　◀ ここ' : '　◀ Here'}</span>}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 事件概要オーバーレイ ── */}
      {showCaseFile && (
        <div className="loc-move-overlay" onClick={() => setShowCaseFile(false)}>
          <div className="loc-casefile-panel" onClick={e => e.stopPropagation()}>
            <div className="loc-panel-header">
              <span className="loc-panel-title">
                {lang === 'ja' ? '— 事件概要 —' : '— CASE FILE —'}
              </span>
              <button className="icon-btn-close" onClick={() => setShowCaseFile(false)}>✕</button>
            </div>
            <div className="loc-casefile-body">
              {briefingLoading && (
                <p className="loc-item-loading">{lang === 'ja' ? '読み込み中...' : 'Loading...'}</p>
              )}
              {!briefingLoading && !briefing && (
                <p className="loc-examine-done">
                  {lang === 'ja' ? '事件概要を読み込めませんでした。' : 'Could not load case file.'}
                </p>
              )}
              {briefing && (
                <div className="briefing-card">
                  <p className="briefing-eyebrow">{lang === 'ja' ? '事件報告書' : 'CASE FILE'}</p>
                  <h2 className="briefing-title">{briefing.title}</h2>
                  <div className="briefing-divider" />
                  <p className="briefing-setting">{briefing.setting}</p>
                  <div className="briefing-victim-block">
                    <span className="briefing-victim-label">{lang === 'ja' ? '被害者' : 'VICTIM'}</span>
                    <p className="briefing-victim-text">{briefing.victim}</p>
                  </div>
                  <div className="briefing-facts">
                    <div className="briefing-fact">
                      <span className="briefing-fact-icon">⏰</span>
                      <span className="briefing-fact-label">{lang === 'ja' ? '死亡推定' : 'Time of Death'}</span>
                      <span className="briefing-fact-value">{briefing.time_of_murder}</span>
                    </div>
                    <div className="briefing-fact">
                      <span className="briefing-fact-icon">🔍</span>
                      <span className="briefing-fact-label">{lang === 'ja' ? '発見時刻' : 'Discovered'}</span>
                      <span className="briefing-fact-value">{briefing.time_discovered}</span>
                    </div>
                    <div className="briefing-fact">
                      <span className="briefing-fact-icon">🗡️</span>
                      <span className="briefing-fact-label">{lang === 'ja' ? '凶器' : 'Weapon'}</span>
                      <span className="briefing-fact-value">{briefing.weapon}</span>
                    </div>
                  </div>
                  <p className="briefing-scene">📍 {briefing.scene}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmResetDialog
        open={showMenuConfirm}
        resetting={resetting}
        onCancel={() => setShowMenuConfirm(false)}
        onConfirm={handleConfirmReturn}
      />

      {mode === 'menu' && !showCaseFile && (
        <BgCredit locationId={location.id} className="loc-position" />
      )}
    </div>
  )
}
