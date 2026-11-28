import { useNavigate } from 'react-router-dom'
import { BookOpen, DoorOpen, Menu, MessageSquare, NotebookPen, Search } from 'lucide-react'
import { BG_LIBRARY } from '../utils/backgroundMatch'
import { AppHeader, GoldButton, OrnamentDivider, Panel, PaperCard, SectionTitle, Stamp } from '../components/ui/Noir'
import CaseFileCard from '../components/CaseFileCard'
import MapView from '../components/MapView'
import mapsData from '../data/maps.json'
import { bakedBriefing, type BriefingResult } from '../api/examine'
import CaseNotebookModal from '../components/notebook/CaseNotebookModal'
import './StyleGuidePage.css'

// Dev-only preview of the noir theme's building blocks (/style-guide).
const theatre = BG_LIBRARY.find(b => b.keywords.includes('theatre'))?.url ?? BG_LIBRARY[0].url
const dressing = BG_LIBRARY.find(b => b.keywords.includes('dressing room'))?.url ?? BG_LIBRARY[0].url

// The shipped briefing for The Final Act, so the preview shows the real card.
const sampleBriefing: BriefingResult = bakedBriefing('the_final_act', 'ja') ?? {
  title: 'The Final Act', setting: '', victim: '', time_of_murder: '', time_discovered: '', weapon: '', scene: '', suspects: [],
}

const sampleClues = ['真鍮の燭台', '破られた手紙', '銀のコンパクトミラー', '換気口の格子']

// Japanese names for /style-guide?map=<scenarioId>, which shows a map with every place unlocked
const MAP_NAMES: Record<string, Record<string, string>> = {
  the_final_act: {
    n_stage: '舞台', n_stalls: '客席', n_backstage: '舞台裏', n_corridor: '廊下',
    n_dressing_room: 'マーカスの楽屋', n_elena_room: 'エレナの楽屋', n_vent_shaft: '換気ダクト',
    n_lobby: 'ロビー', n_bar: 'バー',
  },
  z_The_Four_Pillars_of_Murder: {
    n_loc_vance_office: 'ヴァンス博士の書斎', n_loc_monitoring_station: 'モニタリング室',
    n_loc_sector2_sandbox: 'デジタル空間', n_loc_server_room: 'サーバー室',
  },
}

export default function StyleGuidePage() {
  const navigate = useNavigate()
  const mapId = new URLSearchParams(window.location.search).get('map')
  if (mapId && MAP_NAMES[mapId]) {
    const names = MAP_NAMES[mapId]
    const ids = Object.keys((mapsData as Record<string, object>)[mapId] ?? {})
    const locations = ids.map(id => ({ id, name: names[id] ?? id, description: '', suspects: [] }))
    return (
      <div className="noir">
        <div className="nr-scene" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ width: 'min(100%, calc((100vh - 170px) * 16 / 9))' }}>
          <MapView
            scenarioId={mapId}
            locations={locations}
            unlocked={ids}
            currentId={ids[0]}
            locationBg={() => ''}
            onGo={() => {}}
          />
          </div>
        </div>
      </div>
    )
  }
  // /style-guide?notebook opens the notebook modal on load (for screenshots).
  const showNotebook = new URLSearchParams(window.location.search).has('notebook')

  return (
    <div className="noir">
      <div className="nr-scene sg-scene" style={{ backgroundImage: `url(${theatre})` }}>
        <AppHeader
          sectionJa="スタイルガイド"
          sectionEn="Style Guide"
          right={<GoldButton size="sm" label="メニュー" icon={<Menu size={16} />} onClick={() => navigate('/')} />}
        />

        <main className="sg-main">
          <section className="sg-hero">
            <h1 className="sg-hero__ja nr-gold-text">事件解決</h1>
            <div className="sg-hero__en">— CASE SOLVED —</div>
            <OrnamentDivider style={{ width: 360, margin: '12px auto 0' }} />
          </section>

          <div className="sg-grid">
            <div className="sg-casefile">
              <CaseFileCard briefing={sampleBriefing} photoUrl={dressing} photoCaption="Marcus's Dressing Room" />
              <Stamp>証拠に追加済み</Stamp>
            </div>

            <Panel className="sg-clues">
              <SectionTitle ja="手がかり一覧" en="Evidence" />
              <ul>
                {sampleClues.map(name => (
                  <li key={name}>
                    <span className="sg-clues__thumb" />
                    {name}
                  </li>
                ))}
              </ul>
              <GoldButton size="sm" label="詳細を見る" icon={<Search size={16} />} style={{ width: '100%' }} />
            </Panel>
          </div>

          <Panel className="sg-actions">
            <GoldButton label="調べる" sub="Investigate" icon={<Search size={22} />} />
            <GoldButton label="話す（3人）" sub="Talk" icon={<MessageSquare size={22} />} />
            <GoldButton label="移動" sub="Move" icon={<DoorOpen size={22} />} />
            <span className="sg-actions__sep" />
            <GoldButton label="事件概要" icon={<BookOpen size={20} />} />
            <GoldButton label="捜査ノート" icon={<NotebookPen size={20} />} />
          </Panel>

          <div className="sg-row">
            <GoldButton size="lg" variant="primary" label="ゲーム開始" sub="Start Game" chevron />
            <GoldButton label="推理を突きつける" chevron variant="primary" />
            <GoldButton label="追及する" variant="danger" />
            <GoldButton label="無効" disabled />
          </div>

          <PaperCard className="sg-newspaper">
            <div className="sg-newspaper__masthead">The Daily Chronicle</div>
            <div className="sg-newspaper__headline">MURDER CASE SOLVED</div>
            <OrnamentDivider />
            <p>劇場で発生した殺人事件は、探偵の推理によって解決へと至った。</p>
          </PaperCard>

          <Panel className="sg-fonts">
            <SectionTitle ja="フォント" en="Typography" />
            <p style={{ fontWeight: 400 }}>400 — あの時間、どこにいましたか？ Where were you at 9 PM?</p>
            <p style={{ fontWeight: 700 }}>700 — 犯人はあなただ</p>
            <p style={{ fontWeight: 400, fontSize: '1.4rem', letterSpacing: '0.28em' }}>POIROT</p>
            <p><span className="nr-section-title__en">Case File · Interrogation · Evidence</span></p>
          </Panel>
        </main>
        {showNotebook && <CaseNotebookModal onClose={() => navigate('/style-guide')} />}
      </div>
    </div>
  )
}
