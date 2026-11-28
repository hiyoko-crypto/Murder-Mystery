import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BookOpen, DoorOpen, Loader2, Lock, Menu, MapPin, MessageSquare, Search, X } from 'lucide-react'
import { useGame } from '../contexts/GameContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useScenario } from '../contexts/ScenarioContext'
import { useCaseNotes } from '../contexts/CaseNotesContext'
import { useSceneTransition } from '../contexts/sceneTransitionContext'
import { examineItem, fetchBriefing, type BriefingResult } from '../api/examine'
import { suspectAvatarEmoji } from '../utils/avatar'
import { portraitUrl } from '../utils/portraits'
import { chime, discover, paper } from '../utils/sfx'
import { getExamine, hasVisited, hasVisitedAny, isRevealed, markVisited } from '../utils/gameProgress'
import ConfirmResetDialog from '../components/ConfirmResetDialog'
import NotebookLauncher from '../components/notebook/NotebookLauncher'
import BgCredit from '../components/BgCredit'
import CaseFileCard from '../components/CaseFileCard'
import MapView from '../components/MapView'
import PoirotBox from '../components/PoirotBox'
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

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

// Keyed by location id so all local state (open panel, discoveries, overlays)
// resets when moving to another location.
export default function LocationPage() {
  const { id } = useParams<{ id: string }>()
  return <LocationView key={id} id={id ?? ''} />
}

function LocationView({ id }: { id: string }) {
  const navigate = useNavigate()
  const { go } = useSceneTransition()
  const { unlockedLocations, refetchState, resetGame, holdItems, releaseItem } = useGame()
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

  // Poirot (the player) comments on what he sees; the first line depends on whether
  // this is the first place he has walked into (the crime scene) or a later one.
  const [poirot, setPoirot] = useState(() => {
    const name = locations.find(l => l.id === id)?.name ?? ''
    if (hasVisited(id)) return tt('さて、次はどうしようか。', 'Now, what next?')
    return hasVisitedAny()
      ? tt(`ここは${name}か。何か手がかりがあるだろうか。`, `So this is ${name}. Let us see what it holds.`)
      : tt('ここが殺人の現場か……。空気が重いな。', 'So this is where it happened… The air is heavy.')
  })
  const say = setPoirot

  useEffect(() => {
    markVisited(id)
  }, [id])

  // Start examining in the background as soon as Poirot arrives: the first Japanese
  // examine can take a while (the backend translates each clue), and what it finds
  // stays hidden until the player actually presses Examine.
  useEffect(() => {
    let cancelled = false
    getExamine(id, lang).then(result => {
      if (result && !cancelled) holdItems(result.newly_found.map(i => i.id))
    })
    return () => { cancelled = true }
  }, [id, lang, holdItems])

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

  const suspectsHere    = allSuspects.filter((s) => location.suspects.includes(s.id))

  const handleExamine = async () => {
    // Pressing Examine again while the clue cards are open closes them
    if (panel === 'clues' && examined) {
      setPanel('none')
      return
    }
    setPanel('clues')
    if (examined || examining) return
    setExamining(true)
    say(tt('……さて、調べてみよう。', 'Now then… let us have a look.'))

    // While the result comes back, Poirot keeps thinking out loud
    const musings = lang === 'ja'
      ? ['机の上、床の下……何か見落としていないか。', '小さな違和感こそが、真実への入り口だ。', 'ふむ……もう少し、じっくり見てみよう。']
      : ['The desk, the floor… is there something I have missed?', 'A small oddity is the doorway to the truth.', 'Hm… let me look a little more closely.']
    let next = 0
    const ticker = setInterval(() => say(musings[next++ % musings.length]), 3600)

    try {
      const result = await getExamine(id, lang)
      clearInterval(ticker)
      if (!result) throw new Error('examine failed')

      const newIds = new Set(result.newly_found.map(i => i.id))
      const list: Discovery[] = [...result.newly_found, ...result.already_found].map(b => ({
        itemId: b.id,
        text: b.description,
        emoji: items.find(i => i.id === b.id)?.emoji ?? '📦',
        name: b.name,
      }))
      if (newIds.size > 0 && result.newly_found.some(i => !isRevealed(i.id))) {
        appendHistory({
          type: 'examine_location',
          locationId: id,
          itemIds: result.newly_found.map(i => i.id),
          summary: lang === 'ja'
            ? `${location.name}を調べ、${result.newly_found.map(i => i.name).join('、')}を発見`
            : `Examined ${location.name}, found ${result.newly_found.map(i => i.name).join(', ')}`,
        })
      }
      setExamining(false)

      if (list.length === 0) {
        setDiscoveries([])
        say(tt('なにもないな。', 'Nothing here.'))
        return
      }
      // Show the clues one at a time, with Poirot remarking on each
      for (let i = 0; i < list.length; i++) {
        const d = list[i]
        const fresh = newIds.has(d.itemId) && !isRevealed(d.itemId)
        releaseItem(d.itemId)
        setDiscoveries(list.slice(0, i + 1))
        if (fresh) {
          discover()
          say(tt(`${d.name}を発見した。`, `Found it: ${d.name}.`))
        } else {
          say(tt(`${d.name}がある。`, `${d.name} is here.`))
        }
        await sleep(1500)
      }
      say(newIds.size > 0 ? tt('……他にも何かあるかもしれない。', 'There may be more to find…') : tt('もう何も出てこないようだ。', 'Nothing more, it seems.'))
      await refetchState()
    } catch {
      clearInterval(ticker)
      setExamining(false)
      say(tt('……うまくいかないな。もう一度調べてみよう。', 'Hm, that did not work. Let us try again.'))
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

          {(panel === 'clues' || panel === 'talk') && (
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

              </Panel>
            </div>
          )}
        </div>

        <PoirotBox key={poirot} text={poirot} />

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

        {/* ── Map: pick where to walk next ── */}
        {panel === 'move' && (
          <div className="nr-scrim loc-map-scrim" onClick={() => setPanel('none')}>
            <div className="loc-map" onClick={e => e.stopPropagation()}>
              <div className="loc-map__head">
                <SectionTitle ja={tt('どこへ向かう？', 'Where to?')} en={lang === 'ja' ? 'Map' : undefined} />
                <button className="nr-close" onClick={() => setPanel('none')} aria-label={tt('閉じる', 'Close')}>
                  <X size={16} />
                </button>
              </div>
              <MapView
                scenarioId={scenario?.scenarioId ?? ''}
                locations={locations}
                unlocked={unlockedLocations}
                currentId={id}
                locationBg={locationBg}
                onGo={(locId) => go(`/location/${locId}`)}
              />
            </div>
          </div>
        )}

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
