import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Users } from 'lucide-react'
import { fetchScenarioList, selectScenario, type ScenarioListEntry } from '../api/scenario'
import { bakedBriefing } from '../api/examine'
import scenarioCards from '../data/scenarioCards.json'
import { useScenario } from '../contexts/ScenarioContext'
import { useGame } from '../contexts/GameContext'
import { useLanguage } from '../contexts/LanguageContext'
import { matchBackground, thumbnailUrl } from '../utils/backgroundMatch'
import { AppHeader, GoldButton } from '../components/ui/Noir'
import './ScenarioSelectPage.css'

// Fallback label from the filename when a scenario has no baked briefing yet
// ("z_" prefixes only exist to push a scenario down the backend's default sort).
function scenarioLabel(id: string): string {
  const cleaned = id.replace(/^z_/i, '').replace(/_/g, ' ').trim()
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function ScenarioSelectPage() {
  const navigate = useNavigate()
  const { refetchScenario } = useScenario()
  const { refetchState } = useGame()
  const { lang, tt } = useLanguage()

  const [scenarios, setScenarios] = useState<ScenarioListEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [selecting, setSelecting] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetchScenarioList()
      .then(setScenarios)
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  // Card text and thumbnail only depend on the list and language, not on
  // which card is currently being selected.
  const cards = useMemo(() => scenarios.map((s) => {
    const info = bakedBriefing(s.id, lang)
    const card = (scenarioCards as Record<string, { bg?: string } & Record<string, { tagline?: string }>>)[s.id]
    // Hand-written tagline and thumbnail hint win over the briefing's raw setting text
    const tagline = card?.[lang]?.tagline ?? info?.setting
    const thumb = thumbnailUrl(matchBackground(card?.bg ?? info?.scene ?? s.id, card?.bg ? '' : info?.setting ?? '').url)
    return { ...s, info, thumb, tagline }
  }), [scenarios, lang])

  const handleSelect = async (id: string) => {
    if (selecting) return
    setSelecting(id)
    try {
      await selectScenario(id)
      // ScenarioContext/GameContext both cache data fetched back at the
      // title screen, before this scenario was even picked — refresh both
      // so the rest of the game reflects the newly selected scenario.
      await Promise.all([refetchScenario(), refetchState()])
      navigate('/opening')
    } catch {
      setError(true)
      setSelecting(null)
    }
  }

  return (
    <div className="noir">
      <div className="nr-scene scn">
        <AppHeader
          sectionJa={tt('シナリオ選択', 'Select a Scenario')}
          sectionEn={lang === 'ja' ? 'Select a Scenario' : undefined}
          right={<GoldButton size="sm" label={tt('戻る', 'Back')} icon={<ArrowLeft size={16} />} onClick={() => navigate('/')} />}
        />

        <main className="scn__main">
          {loading && <p className="scn__status">{tt('読み込み中…', 'Loading…')}</p>}
          {error && <p className="scn__status is-error">{tt('シナリオの取得に失敗しました', 'Could not load scenarios')}</p>}
          {!loading && !error && scenarios.length === 0 && (
            <p className="scn__status">{tt('シナリオが見つかりません', 'No scenarios found')}</p>
          )}

          {!loading && !error && (
            <div className="scn__grid">
              {cards.map(({ info, thumb, tagline, ...s }) => {
                return (
                  <button
                    key={s.id}
                    className={`scn__card${s.active ? ' is-active' : ''}`}
                    onClick={() => handleSelect(s.id)}
                    disabled={selecting !== null}
                  >
                    <span className="scn__thumb" style={{ backgroundImage: `url(${thumb})` }} />
                    <span className="scn__body">
                      <span className="scn__title">{info?.title ?? scenarioLabel(s.id)}</span>
                      {tagline && <span className="scn__summary">{tagline}</span>}
                      <span className="scn__meta">
                        {info && (
                          <span className="scn__suspects">
                            <Users size={16} /> {tt(`容疑者：${info.suspects.length}人`, `${info.suspects.length} suspects`)}
                          </span>
                        )}
                        {selecting === s.id
                          ? <span className="scn__badge">{tt('読み込み中…', 'Loading…')}</span>
                          : s.active && <span className="scn__badge">{tt('前回選択', 'Last played')}</span>}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
