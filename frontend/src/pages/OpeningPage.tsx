import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { useGame } from '../contexts/GameContext'
import { useScenario } from '../contexts/ScenarioContext'
import { fetchBriefing, type BriefingResult } from '../api/examine'
import CaseFileCard from '../components/CaseFileCard'
import { AppHeader, GoldButton } from '../components/ui/Noir'
import './OpeningPage.css'

export default function OpeningPage() {
  const navigate = useNavigate()
  const { lang, tt } = useLanguage()
  const { unlockedLocations } = useGame()
  const { scenario, loading: scenarioLoading, locations, locationBg } = useScenario()

  // Each fetch is tagged with the (scenario, lang, attempt) it was made for,
  // so "loading" is derived instead of set synchronously inside the effect.
  const [attempt, setAttempt] = useState(0)
  const requestKey = `${scenario?.scenarioId ?? ''}|${lang}|${attempt}`
  const [result, setResult] = useState<{ key: string; briefing: BriefingResult | null }>({ key: '', briefing: null })

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
              {tt('読み込み中…（シナリオ切替直後は時間がかかることがあります）', 'Loading… (can take a while right after switching scenarios)')}
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

          <GoldButton
            size="lg"
            variant="primary"
            label={tt('捜査開始', 'Begin Investigation')}
            sub={lang === 'ja' ? 'Start Investigation' : undefined}
            chevron
            onClick={() => navigate(`/location/${firstLocationId}`)}
            disabled={!firstLocationId}
          />
        </main>
      </div>
    </div>
  )
}
