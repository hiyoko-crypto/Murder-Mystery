import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BookOpen, DoorOpen, Loader2, Menu, MapPin, MessageSquare, Search, X } from 'lucide-react'
import { useGame } from '../contexts/GameContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useScenario } from '../contexts/ScenarioContext'
import { useCaseNotes } from '../contexts/CaseNotesContext'
import { useSceneTransition } from '../contexts/sceneTransitionContext'
import { examineItem, fetchBriefing, type BriefingResult } from '../api/examine'
import { suspectAvatarEmoji } from '../utils/avatar'
import { portraitUrl } from '../utils/portraits'
import { chime, discover, paper, ping } from '../utils/sfx'
import { getExamine, hasVisited, hasVisitedAny, isRevealed, markVisited } from '../utils/gameProgress'
import ConfirmResetDialog from '../components/ConfirmResetDialog'
import NotebookLauncher from '../components/notebook/NotebookLauncher'
import BgCredit from '../components/BgCredit'
import CaseFileCard from '../components/CaseFileCard'
import MapView from '../components/MapView'
import PoirotBox from '../components/PoirotBox'
import ThoughtBubble from '../components/ThoughtBubble'
import { AppHeader, GoldButton, Panel, SectionTitle } from '../components/ui/Noir'
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

  // What Poirot is thinking, shown near the top of the scene; a tap moves on
  const [thought, setThought] = useState<string | null>(null)
  const skipRef = useRef<(() => void) | null>(null)

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
  // This runs in the background while Poirot thinks about the clue.
  const examineClueInBackground = async (d: Discovery) => {
    try {
      const res = await examineItem(d.itemId, lang)
      if (!res.unlocked_location) return
      const locName = locations.find(l => l.id === res.unlocked_location)?.name ?? res.unlocked_location
      chime()
      appendHistory({
        type: 'unlock_location',
        locationId: res.unlocked_location,
        itemIds: [d.itemId],
        summary: lang === 'ja'
          ? `${d.name}を調べ、${locName}が解放された`
          : `Examining ${d.name} unlocked ${locName}`,
      })
      say(tt(`……${locName}へ行けるようだ。`, `…It seems I can get to ${locName} now.`))
      await refetchState()
    } catch {
      // the clue still counts as found
    }
  }

  const handleExamine = async () => {
    if (examining) return
    if (examined) {
      say(tt('ここはもう調べ尽くした。', 'I have searched everywhere here.'))
      return
    }
    setPanel('none')
    setExamining(true)
    ping()
    say(tt('……さて、調べてみよう。', 'Now then… let us have a look.'))

    // While the result comes back, Poirot keeps thinking
    const musings = lang === 'ja'
      ? ['机の上、床の下……何か見落としていないか。', '小さな違和感こそが、真実への入り口だ。', 'ふむ……もう少し、じっくり見てみよう。']
      : ['The desk, the floor… is there something I have missed?', 'A small oddity is the doorway to the truth.', 'Hm… let me look a little more closely.']
    let next = 0
    setThought(musings[next++])
    const ticker = setInterval(() => setThought(musings[next++ % musings.length]), 3800)
    // A tap (or the timeout) moves on to the next thought
    const pause = (ms: number) => new Promise<void>(resolve => {
      const timer = setTimeout(() => { skipRef.current = null; resolve() }, ms)
      skipRef.current = () => { clearTimeout(timer); skipRef.current = null; resolve() }
    })

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
      if (result.newly_found.some(i => !isRevealed(i.id))) {
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
      setDiscoveries(list)

      if (list.length === 0) {
        setThought(null)
        say(tt('なにもないな。', 'Nothing here.'))
        return
      }
      // One clue at a time: a line in the dialogue box, the details as a thought
      let background: Promise<void> = Promise.resolve()
      for (const d of list) {
        const fresh = newIds.has(d.itemId) && !isRevealed(d.itemId)
        releaseItem(d.itemId)
        if (fresh) {
          discover()
          say(tt(`${d.name}を発見した。`, `Found it: ${d.name}.`))
        } else {
          say(tt(`${d.name}がある。`, `${d.name} is here.`))
        }
        setThought(d.text || null)
        background = background.then(() => examineClueInBackground(d))
        await pause(d.text ? Math.min(7000, Math.max(2800, d.text.length * 55 + 1200)) : 1500)
      }
      setThought(null)
      say(newIds.size > 0 ? tt('……他にも何かあるかもしれない。', 'There may be more to find…') : tt('もう何も出てこないようだ。', 'Nothing more, it seems.'))
      await refetchState()
    } catch {
      clearInterval(ticker)
      setThought(null)
      setExamining(false)
      say(tt('……うまくいかないな。もう一度調べてみよう。', 'Hm, that did not work. Let us try again.'))
    }
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

        {thought && <ThoughtBubble key={thought} text={thought} onTap={() => skipRef.current?.()} />}

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
            onClick={() => setPanel(p => (p === 'talk' ? 'none' : 'talk'))}
            disabled={suspectsHere.length === 0}
          />
          <GoldButton label={tt('移動', 'Move')} icon={<DoorOpen size={28} />} onClick={() => {
              if (panel !== 'move') paper()
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
