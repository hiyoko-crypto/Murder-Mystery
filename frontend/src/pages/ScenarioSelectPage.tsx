import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchScenarioList, selectScenario, type ScenarioListEntry } from '../api/scenario'
import { useScenario } from '../contexts/ScenarioContext'
import { useGame } from '../contexts/GameContext'
import './ScenarioSelectPage.css'

// Filenames are just sorted alphabetically on the backend to pick a default
// (hence the "z_" prefixes some scenarios got to deprioritize them) — this
// just cleans that up into something presentable, not a real title source.
function scenarioLabel(id: string): string {
  const cleaned = id.replace(/^z_/i, '').replace(/_/g, ' ').trim()
  return cleaned.replace(/\b\w/g, (c) => c.toUpperCase())
}

export default function ScenarioSelectPage() {
  const navigate = useNavigate()
  const { refetchScenario } = useScenario()
  const { refetchState } = useGame()
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

  const handleSelect = async (id: string) => {
    if (selecting) return
    setSelecting(id)
    try {
      await selectScenario(id)
      // ScenarioContext/GameContext both cache data fetched back at the
      // title screen, before this scenario was even picked — refresh both
      // so the rest of the game reflects the newly selected scenario.
      await Promise.all([refetchScenario(), refetchState()])
      navigate('/language')
    } catch {
      setError(true)
      setSelecting(null)
    }
  }

  return (
    <div className="scenario-select-page">
      <p className="scenario-select-eyebrow">SCENARIO / シナリオ</p>
      {loading && <p className="scenario-select-status">読み込み中…</p>}
      {error && <p className="scenario-select-status error">シナリオの取得に失敗しました</p>}
      {!loading && !error && (
        <div className="scenario-select-list">
          {scenarios.map((s) => (
            <button
              key={s.id}
              className={`scenario-select-card${s.active ? ' active' : ''}`}
              onClick={() => handleSelect(s.id)}
              disabled={selecting !== null}
            >
              <span className="scenario-select-label">{scenarioLabel(s.id)}</span>
              {selecting === s.id
                ? <span className="scenario-select-badge">読み込み中…</span>
                : s.active && <span className="scenario-select-badge">現在選択中</span>}
            </button>
          ))}
          {scenarios.length === 0 && (
            <p className="scenario-select-status">シナリオが見つかりません</p>
          )}
        </div>
      )}
      <button className="scenario-select-back" onClick={() => navigate('/')}>← Back</button>
    </div>
  )
}
