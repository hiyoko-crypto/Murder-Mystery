import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { useGame } from '../contexts/GameContext'
import { useScenario } from '../contexts/ScenarioContext'
import { useSceneTransition } from '../contexts/sceneTransitionContext'
import { fetchBriefing, type BriefingResult } from '../api/examine'
import { paper } from '../utils/sfx'
import CaseFileCard from '../components/CaseFileCard'
import PoirotIntro from '../components/PoirotIntro'
import { AppHeader, GoldButton } from '../components/ui/Noir'
import './OpeningPage.css'

const stripEnd = (s: string) => s.replace(/[。.\s]+$/, '')

/** Poirot's opening thoughts, built from the case file so every scenario gets its own. */
function introLines(b: BriefingResult, ja: boolean): string[] {
  return ja
    ? [
        '……事件の知らせか。ふむ、見過ごすわけにはいかないな。',
        `現場は、${stripEnd(b.scene)}。犯行は${stripEnd(b.time_of_murder)}のことらしい。`,
        `凶器は${stripEnd(b.weapon)}。実に興味深い。`,
        'さあ、私の灰色の脳細胞の出番だ。まずは現場を調べ、関係者の話を聞くとしよう。',
      ]
    : [
        '…A case, then. Hm. I cannot let this pass.',
        `The scene: ${stripEnd(b.scene)}. Time of death: ${stripEnd(b.time_of_murder)}.`,
        `The weapon: ${stripEnd(b.weapon)}. Most interesting.`,
        'Now, the little grey cells must work. First the scene, then the witnesses.',
      ]
}

export default function OpeningPage() {
  const navigate = useNavigate()
  const { go } = useSceneTransition()
  const { lang, tt } = useLanguage()
  const { unlockedLocations } = useGame()
  const { scenario, loading: scenarioLoading, locations, locationBg } = useScenario()

  // Each fetch is tagged with the (scenario, lang, attempt) it was made for,
  // so "loading" is derived instead of set synchronously inside the effect.
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${scenario?.scenarioId ?? ''}|${lang}|${attempt}`
  const [result, setResult] = useState<{ key: string; briefing: BriefingResult | null }>({ key: '', briefing: null })
  const [intro, setIntro] = useState(false)

  useEffect(() => {
    // Wait for ScenarioContext's own fetch to settle first — otherwise this
    // can race ahead with an empty scenario id (e.g. on a hard reload),
    // which bypasses the briefing cache entirely.
    if (scenarioLoading) return
    let cancelled = false
    fetchBriefing(scenario?.scenarioId ?? '', lang)
      .then(b => { if (!cancelled) setResult({ key: requestKey, briefing: b }) })
      .catch(() => { if (!cancelled) setResult({ key: requestKey, briefing: null }) })
    return () => { cancelled = true }
  }, [requestKey, scenarioLoading, scenario?.scenarioId, lang])

  const loading = result.key !== requestKey
  const briefing = loading ? null : result.briefing

  const firstLocationId = unlockedLocations[0] ?? ''

  // Poirot starts thinking out loud by himself once the paper has settled
  useEffect(() => {
    if (!briefing || !firstLocationId) return
    const id = setTimeout(() => setIntro(true), 2300)
    return () => clearTimeout(id)
  }, [briefing, firstLocationId])

  // The paper slides in as soon as the case file is ready
  useEffect(() => {
    if (briefing) paper()
  }, [briefing])

  const firstLocation = locations(lang).find(l => l.id === firstLocationId)

  return (
    <div className="noir">
      <div
        className="nr-scene opening"
        style={firstLocationId ? { backgroundImage: `url(${locationBg(firstLocationId)})` } : undefined}
      >
        <AppHeader
          sectionJa={tt('事件ファイル', 'Case File')}
          sectionEn={lang === 'ja' ? 'Case File' : undefined}
          right={<GoldButton size="sm" label={tt('シナリオ選択', 'Scenarios')} icon={<ArrowLeft size={16} />} onClick={() => navigate('/scenario-select')} />}
        />

        <main className="opening__main">
          {loading && (
            <p className="opening__status">
              <Loader2 size={26} className="nr-spin" />
              {tt('事件ファイルを用意しています…', 'Preparing the case file…')}
            </p>
          )}
          {!loading && !briefing && (
            <div className="opening__status">
              <p>{tt('事件の詳細を読み込めませんでした。', 'Could not load case details.')}</p>
              <GoldButton size="sm" label={tt('再試行', 'Retry')} onClick={() => setAttempt(a => a + 1)} />
            </div>
          )}
          {briefing && (
            <div className="opening__file">
              <CaseFileCard
                briefing={briefing}
                photoUrl={firstLocationId ? locationBg(firstLocationId) : undefined}
                photoCaption={firstLocation?.name}
              />
            </div>
          )}

        </main>

        {briefing && intro && (
          <PoirotIntro lines={introLines(briefing, lang === 'ja')} onFinish={() => go(`/location/${firstLocationId}`, 'fade')} />
        )}
      </div>
    </div>
  )
}
