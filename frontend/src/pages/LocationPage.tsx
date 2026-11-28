import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BookOpen, DoorOpen, Loader2, Menu, MapPin, MessageSquare, Search, Unlock, X } from 'lucide-react'
import { useGame } from '../contexts/GameContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useScenario } from '../contexts/ScenarioContext'
import { useCaseNotes } from '../contexts/CaseNotesContext'
import { useSceneTransition } from '../contexts/sceneTransitionContext'
import { examineItem, fetchBriefing, type BriefingResult } from '../api/examine'
import { suspectAvatarEmoji } from '../utils/avatar'
import { portraitUrl } from '../utils/portraits'
import { chime, discover, paper, ping } from '../utils/sfx'
import { getExamine, hasSeenOnMap, hasVisited, hasVisitedAny, isRevealed, markSeenOnMap, markVisited } from '../utils/gameProgress'
import ConfirmResetDialog from '../components/ConfirmResetDialog'
import NotebookLauncher from '../components/notebook/NotebookLauncher'
import BgCredit from '../components/BgCredit'
import CaseFileCard from '../components/CaseFileCard'
import MapView from '../components/MapView'
import PoirotBox from '../components/PoirotBox'
import ThoughtBubble from '../components/ThoughtBubble'
import { AppHeader, GoldButton, OrnamentDivider, Panel, SectionTitle } from '../components/ui/Noir'
import ItemIcon from '../components/ItemIcon'
import './LocationPage.css'

/** What the right-hand side panel shows. */
type SidePanel = 'none' | 'talk' | 'move'

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
  const { unlockedLocations, refetchState, resetGame, holdItems, releaseItem } = useGame()
  const { lang, t, tt } = useLanguage()
  const { scenario, locations: getLocations, items: getItems, suspects: getSuspects, locationBg } = useScenario()
  const { appendHistory } = useCaseNotes()

  const locations   = getLocations(lang)
  const items       = getItems(lang)
  const allSuspects = getSuspects(lang)

  const [panel, setPanel] = useState<SidePanel>('none')
  const [examining, setExamining] = useState(false)
  // Each press of Examine shows one more clue; nothing happens on its own
  const cluesRef = useRef<Discovery[] | null>(null)
  const cursorRef = useRef(0)
  const freshRef = useRef<Set<string>>(new Set())
  const [shown, setShown] = useState<Discovery | null>(null)
  const [unlockBanner, setUnlockBanner] = useState<string | null>(null)
  const [mapNew, setMapNew] = useState<string[]>([])

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

  // What Poirot is thinking while he waits for the search to finish
  const [thought, setThought] = useState<string | null>(null)

  useEffect(() => {
    if (!unlockBanner) return
    const timer = setTimeout(() => setUnlockBanner(null), 3600)
    return () => clearTimeout(timer)
  }, [unlockBanner])

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

  // Looking at a clue also "examines" it on the backend, which can open a new place.
  const examineClueInBackground = async (d: Discovery) => {
    try {
      const res = await examineItem(d.itemId, lang)
      if (!res.unlocked_location) return
      const locName = locations.find(l => l.id === res.unlocked_location)?.name ?? res.unlocked_location
      chime()
      setUnlockBanner(locName)
      appendHistory({
        type: 'unlock_location',
        locationId: res.unlocked_location,
        itemIds: [d.itemId],
        summary: lang === 'ja'
          ? `${d.name}を調べ、${locName}が解放された`
          : `Examining ${d.name} unlocked ${locName}`,
      })
      await refetchState()
    } catch {
      // the clue still counts as found
    }
  }

  // One press = one step: the first press searches the room, each press after that shows
  // the next clue (picture on top, details below), and the last one says there is nothing more.
  const handleExamine = async () => {
    if (examining) return
    setPanel('none')
    ping()

    if (!cluesRef.current) {
      setExamining(true)
      say(tt('……さて、調べてみよう。', 'Now then… let us have a look.'))
      const musings = lang === 'ja'
        ? ['机の上、床の下……何か見落としていないか。', '小さな違和感こそが、真実への入り口だ。', 'ふむ……もう少し、じっくり見てみよう。']
        : ['The desk, the floor… is there something I have missed?', 'A small oddity is the doorway to the truth.', 'Hm… let me look a little more closely.']
      let next = 0
      setThought(musings[next++])
      const ticker = setInterval(() => setThought(musings[next++ % musings.length]), 3800)
      try {
        const result = await getExamine(id, lang)
        if (!result) throw new Error('examine failed')
        cluesRef.current = [...result.newly_found, ...result.already_found].map(b => ({
          itemId: b.id,
          text: b.description,
          emoji: items.find(i => i.id === b.id)?.emoji ?? '📦',
          name: b.name,
        }))
        freshRef.current = new Set(result.newly_found.map(i => i.id))
      } catch {
        say(tt('……うまくいかないな。もう一度調べてみよう。', 'Hm, that did not work. Let us try again.'))
        return
      } finally {
        clearInterval(ticker)
        setThought(null)
        setExamining(false)
      }
    }

    const clues = cluesRef.current
    if (cursorRef.current >= clues.length) {
      setShown(null)
      say(clues.length === 0 ? tt('なにもないな。', 'Nothing here.') : tt('もう何も出てこないようだ。', 'Nothing more, it seems.'))
      return
    }
    const d = clues[cursorRef.current++]
    const fresh = freshRef.current.has(d.itemId) && !isRevealed(d.itemId)
    releaseItem(d.itemId)
    setShown(d)
    if (fresh) {
      discover()
      say(tt(`${d.name}を発見した。`, `Found it: ${d.name}.`))
      appendHistory({
        type: 'examine_location',
        locationId: id,
        itemIds: [d.itemId],
        summary: lang === 'ja' ? `${location.name}を調べ、${d.name}を発見` : `Examined ${location.name}, found ${d.name}`,
      })
    } else {
      say(tt(`${d.name}がある。`, `${d.name} is here.`))
    }
    void examineClueInBackground(d)
    if (cursorRef.current < clues.length) return
    await refetchState()
  }

  const handleOpenCaseFile = async () => {
    setShowCaseFile(true)
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

        {thought && <ThoughtBubble key={thought} text={thought} onTap={() => setThought(null)} />}

        {/* The clue Poirot is looking at: picture on top, details below */}
        {shown && (
          <div className="clue-showcase" key={shown.itemId} onClick={() => setShown(null)}>
            <Panel className="clue-showcase__panel">
              <div className="clue-showcase__img">
                <ItemIcon itemId={shown.itemId} emoji={shown.emoji} />
              </div>
              <h3 className="clue-showcase__name">{shown.name}</h3>
              {shown.text && <p className="clue-showcase__text">{shown.text}</p>}
            </Panel>
          </div>
        )}

        {/* A new place opened up: say so across the whole screen */}
        {unlockBanner && (
          <div className="unlock-banner" onClick={() => setUnlockBanner(null)}>
            <div className="unlock-banner__inner">
              <Unlock size={46} />
              <p className="unlock-banner__label">{tt('新しい場所が解放された', 'NEW AREA UNLOCKED')}</p>
              <OrnamentDivider style={{ width: 360 }} />
              <h2 className="unlock-banner__name">{unlockBanner}</h2>
            </div>
          </div>
        )}

        <div className="loc__body">
          <div className="loc__title">
            <h1 className="loc__name">
              <MapPin size={26} className="loc__pin" />
              {location.name}
            </h1>
            {/* Descriptions are not translated yet, so only show them in English mode. */}
            {lang === 'en' && location.description && <p className="loc__desc">{location.description}</p>}
          </div>

          {panel === 'talk' && (
            <div className="loc__stage" key={panel}>
              <Panel className="loc__stage-panel">
                <div className="loc__stage-head">
                  <SectionTitle ja={tt('話す相手を選ぶ', 'Who to talk to')} en={lang === 'ja' ? 'Talk' : undefined} />
                  <button className="nr-close" onClick={() => setPanel('none')} aria-label={tt('閉じる', 'Close')}>
                    <X size={16} />
                  </button>
                </div>

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
            onClick={() => {
              setShown(null)
              setPanel(p => (p === 'talk' ? 'none' : 'talk'))
            }}
            disabled={suspectsHere.length === 0}
          />
          <GoldButton label={tt('移動', 'Move')} icon={<DoorOpen size={28} />} onClick={() => {
              if (panel !== 'move') {
                paper()
                setShown(null)
                // Places that became reachable since the map was last opened get a NEW badge, once
                setMapNew(unlockedLocations.filter(l => l !== id && !hasSeenOnMap(l)))
                markSeenOnMap(unlockedLocations)
              }
              setPanel(p => (p === 'move' ? 'none' : 'move'))
            }} />
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
                newIds={mapNew}
                onGo={(locId) => go(`/location/${locId}`)}
              />
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

        {!showCaseFile && <BgCredit locationId={location.id} className="loc-credit" />}
      </div>
    </div>
  )
}
