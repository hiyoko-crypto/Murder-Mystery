import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BookOpen, DoorOpen, Loader2, Lock, Menu, MapPin, MessageSquare, Search, X } from 'lucide-react'
import { useGame } from '../contexts/GameContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useScenario } from '../contexts/ScenarioContext'
import { useCaseNotes } from '../contexts/CaseNotesContext'
import { useSceneTransition } from '../contexts/sceneTransitionContext'
import { examineLocation, examineItem, fetchBriefing, type BriefingResult } from '../api/examine'
import { suspectAvatarEmoji } from '../utils/avatar'
import { portraitUrl } from '../utils/portraits'
import { chime, discover, paper } from '../utils/sfx'
import { thumbnailUrl } from '../utils/backgroundMatch'
import ConfirmResetDialog from '../components/ConfirmResetDialog'
import NotebookLauncher from '../components/notebook/NotebookLauncher'
import BgCredit from '../components/BgCredit'
import CaseFileCard from '../components/CaseFileCard'
import { AppHeader, GoldButton, Panel, PaperCard, SectionTitle, Stamp } from '../components/ui/Noir'
import './LocationPage.css'

/** What the right-hand side panel shows. */
type SidePanel = 'none' | 'clues' | 'talk' | 'move'

interface Discovery {
  itemId: string
  text: string
  emoji: string
  name: string
}

// Keyed by location id so all local state (open panel, discoveries, overlays)
// resets when moving to another location.
export default function LocationPage() {
  const { id } = useParams<{ id: string }>()
  return <LocationView key={id} id={id ?? ''} />
}

function LocationView({ id }: { id: string }) {
  const navigate = useNavigate()
  const { go } = useSceneTransition()
  const { unlockedLocations, refetchState, resetGame } = useGame()
  const { lang, t, tt } = useLanguage()
  const { scenario, locations: getLocations, items: getItems, suspects: getSuspects, locationBg } = useScenario()
  const { appendHistory } = useCaseNotes()

  const locations   = getLocations(lang)
  const items       = getItems(lang)
  const allSuspects = getSuspects(lang)

  const [panel, setPanel] = useState<SidePanel>('none')
  const [examining, setExamining] = useState(false)
  // null until the location has been examined
  const [discoveries, setDiscoveries] = useState<Discovery[] | null>(null)
  const examined = discoveries !== null

  // Item detail overlay
  const [selectedItem, setSelectedItem] = useState<Discovery | null>(null)
  const [itemSignificance, setItemSignificance] = useState<string>('')
  const [itemDetailLoading, setItemDetailLoading] = useState(false)
  const [unlocked, setUnlocked] = useState<{ id: string; name: string } | null>(null)

  // Case File overlay
  const [showCaseFile, setShowCaseFile] = useState(false)
  const [briefing, setBriefing] = useState<BriefingResult | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)

  // Main menu confirm
  const [showMenuConfirm, setShowMenuConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  const location = locations.find((l) => l.id === id)
  if (!location) return <div>{t('not.found')}</div>

  const moveLocations   = locations.filter((l) => unlockedLocations.includes(l.id))
  const suspectsHere    = allSuspects.filter((s) => location.suspects.includes(s.id))

  const handleExamine = async () => {
    // Pressing Examine again while the clue cards are open closes them
    if (panel === 'clues' && examined) {
      setPanel('none')
      return
    }
    setPanel('clues')
    if (examined) return
    setExamining(true)
    try {
      const result = await examineLocation(id, lang)
      const allItems = [...result.newly_found, ...result.already_found]
      setDiscoveries(allItems.map(backendItem => ({
        itemId: backendItem.id,
        text: backendItem.description,
        emoji: items.find(i => i.id === backendItem.id)?.emoji ?? '📦',
        name: backendItem.name,
      })))
      if (result.newly_found.length > 0) {
        discover()
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
      // leave the panel in its "not yet examined" state so the player can retry
    } finally {
      setExamining(false)
    }
  }

  const handleItemClick = async (item: Discovery) => {
    setSelectedItem(item)
    setItemSignificance('')
    setUnlocked(null)
    setItemDetailLoading(true)
    try {
      const res = await examineItem(item.itemId, lang)
      setItemSignificance(res.significance ?? '')
      if (res.unlocked_location) {
        const locName = locations.find(l => l.id === res.unlocked_location)?.name ?? res.unlocked_location
        setUnlocked({ id: res.unlocked_location, name: locName })
        chime()
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
    paper()
    if (!briefing && !briefingLoading) {
      setBriefingLoading(true)
      try {
        setBriefing(await fetchBriefing(scenario?.scenarioId ?? '', lang))
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


  return (
    <div className="noir">
      <div className="nr-scene loc" style={{ backgroundImage: `url(${locationBg(location.id)})` }}>
        <AppHeader
          right={
            <GoldButton size="sm" label={tt('メインメニュー', 'Main Menu')} icon={<Menu size={16} />} onClick={() => setShowMenuConfirm(true)} />
          }
        />

        <div className="loc__body">
          <div className="loc__title">
            <h1 className="loc__name">
              <MapPin size={26} className="loc__pin" />
              {location.name}
            </h1>
            {/* Descriptions are not translated yet, so only show them in English mode. */}
            {lang === 'en' && location.description && <p className="loc__desc">{location.description}</p>}
          </div>

          {panel !== 'none' && (
            <div className="loc__stage" key={panel}>
              <Panel className="loc__stage-panel">
                <div className="loc__stage-head">
                  <SectionTitle
                    ja={panel === 'clues' ? tt('手がかり', 'Clues') : panel === 'talk' ? tt('話す相手を選ぶ', 'Who to talk to') : tt('移動先（マップ）', 'Map')}
                    en={lang === 'ja' ? (panel === 'clues' ? 'Evidence' : panel === 'talk' ? 'Talk' : 'Map') : undefined}
                  />
                  <button className="nr-close" onClick={() => setPanel('none')} aria-label={tt('閉じる', 'Close')}>
                    <X size={16} />
                  </button>
                </div>

                {panel === 'clues' && (
                  <>
                    {!examined && examining && (
                      <p className="loc__stage-msg nr-loading">
                        <Loader2 size={24} className="nr-spin" />
                        {tt('現場を調べている…', 'Searching the scene…')}
                      </p>
                    )}
                    {!examined && !examining && (
                      <p className="loc__stage-msg">{tt('うまく調べられませんでした。もう一度「調べる」を押してください。', 'Could not examine the scene. Press Examine to try again.')}</p>
                    )}
                    {discoveries?.length === 0 && <p className="loc__stage-msg">{t('loc.examine.done0')}</p>}
                    <div className="loc__cards">
                      {discoveries?.map((d) => (
                        <button key={d.itemId} className="loc-card" onClick={() => handleItemClick(d)}>
                          <span className="loc-card__img">{d.emoji}</span>
                          <span className="loc-card__name">{d.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {panel === 'talk' && (
                  <div className="loc__cards">
                    {suspectsHere.length === 0 && <p className="loc__stage-msg">{t('loc.nobody')}</p>}
                    {suspectsHere.map((suspect) => (
                      <button key={suspect.id} className="loc-card" onClick={() => navigate(`/interrogate/${suspect.id}`)}>
                        <span className="loc-card__img">
                          {portraitUrl(suspect.id, 'neutral')
                            ? <img src={portraitUrl(suspect.id, 'neutral')} alt="" />
                            : suspectAvatarEmoji(suspect.bio, suspect.id)}
                        </span>
                        <span className="loc-card__name">{suspect.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {panel === 'move' && (
                  <div className="loc__cards">
                    {moveLocations.map((loc) => {
                      const isCurrent = loc.id === id
                      return (
                        <button
                          key={loc.id}
                          className={`loc-card loc-card--map${isCurrent ? ' is-current' : ''}`}
                          onClick={() => go(`/location/${loc.id}`)}
                          disabled={isCurrent}
                        >
                          <span className="loc-card__img" style={{ backgroundImage: `url(${thumbnailUrl(locationBg(loc.id))})` }}>
                            {isCurrent && <span className="loc-card__here">{tt('現在地', 'Here')}</span>}
                          </span>
                          <span className="loc-card__name">{loc.name}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </Panel>
            </div>
          )}
        </div>

        <Panel className="loc__actions">
          <GoldButton
            label={t('loc.examine')}
            icon={examining ? <Loader2 size={28} className="nr-spin" /> : <Search size={28} />}
            onClick={handleExamine}
            disabled={examining}
          />
          <GoldButton
            label={t('loc.talk')}
            icon={<MessageSquare size={28} />}
            onClick={() => setPanel(p => (p === 'talk' ? 'none' : 'talk'))}
            disabled={suspectsHere.length === 0}
          />
          <GoldButton label={tt('移動', 'Move')} icon={<DoorOpen size={28} />} onClick={() => setPanel(p => (p === 'move' ? 'none' : 'move'))} />
          <span className="loc__actions-sep" />
          <GoldButton variant="paper" label={tt('事件概要', 'Case File')} icon={<BookOpen size={24} />} onClick={handleOpenCaseFile} />
          <NotebookLauncher className="nr-btn--teal" />
        </Panel>

        {/* ── Item detail ── */}
        {selectedItem && (
          <div className="nr-scrim" onClick={() => setSelectedItem(null)}>
            <div className="loc-item" onClick={e => e.stopPropagation()}>
              <PaperCard className="loc-item__card">
                <div className="loc-item__photo">
                  <span>{selectedItem.emoji}</span>
                </div>
                <div className="loc-item__body">
                  <div className="loc-item__eyebrow">{tt('手がかり', 'Clue')}</div>
                  <h2 className="loc-item__name">{selectedItem.name}</h2>
                  <p>{selectedItem.text}</p>
                  {itemDetailLoading && <p className="loc-item__loading">{tt('読み込み中…', 'Loading…')}</p>}
                  {!itemDetailLoading && itemSignificance && <p className="loc-item__significance">{itemSignificance}</p>}
                  <div className="loc-item__stamp">
                    <Stamp>{tt('証拠に追加済み', 'Added to Evidence')}</Stamp>
                  </div>
                </div>
                <button className="nr-close nr-close--paper loc-item__close" onClick={() => setSelectedItem(null)} aria-label={tt('閉じる', 'Close')}>
                  <X size={18} />
                </button>
              </PaperCard>

              {unlocked && (
                <Panel className="loc-item__unlock">
                  <Lock size={22} className="loc-item__unlock-icon" />
                  <span>{tt(`新しい場所が解放されました：${unlocked.name}`, `New area unlocked: ${unlocked.name}`)}</span>
                  <GoldButton size="sm" variant="primary" label={tt('移動する', 'Go there')} chevron onClick={() => go(`/location/${unlocked.id}`)} />
                </Panel>
              )}
            </div>
          </div>
        )}

        {/* ── Case file ── */}
        {showCaseFile && (
          <div className="nr-scrim" onClick={() => setShowCaseFile(false)}>
            <div className="loc-casefile" onClick={e => e.stopPropagation()}>
              {briefingLoading && <p className="loc__stage-msg">{tt('読み込み中…', 'Loading…')}</p>}
              {!briefingLoading && !briefing && <p className="loc__stage-msg">{tt('事件概要を読み込めませんでした。', 'Could not load the case file.')}</p>}
              {briefing && <CaseFileCard briefing={briefing} />}
              <button className="nr-close nr-close--paper loc-casefile__close" onClick={() => setShowCaseFile(false)} aria-label={tt('閉じる', 'Close')}>
                <X size={18} />
              </button>
            </div>
          </div>
        )}

        <ConfirmResetDialog
          open={showMenuConfirm}
          resetting={resetting}
          onCancel={() => setShowMenuConfirm(false)}
          onConfirm={handleConfirmReturn}
        />

        {!selectedItem && !showCaseFile && <BgCredit locationId={location.id} className="loc-credit" />}
      </div>
    </div>
  )
}
