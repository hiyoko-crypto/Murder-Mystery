import { useNavigate } from 'react-router-dom'
import { BookOpen, DoorOpen, FolderOpen, Menu, MessageSquare, NotebookPen, Search } from 'lucide-react'
import { BG_LIBRARY } from '../utils/backgroundMatch'
import { AppHeader, GoldButton, OrnamentDivider, Panel, PaperCard, Polaroid, SectionTitle, Stamp } from '../components/ui/Noir'
import CaseNotebookModal from '../components/notebook/CaseNotebookModal'
import './StyleGuidePage.css'

// Dev-only preview of the noir theme's building blocks (/style-guide).
const theatre = BG_LIBRARY.find(b => b.keywords.includes('theatre'))?.url ?? BG_LIBRARY[0].url
const dressing = BG_LIBRARY.find(b => b.keywords.includes('dressing room'))?.url ?? BG_LIBRARY[0].url

const sampleClues = ['真鍮の燭台', '破られた手紙', '銀のコンパクトミラー', '換気口の格子']

export default function StyleGuidePage() {
  const navigate = useNavigate()
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
            <PaperCard className="sg-casefile">
              <div className="sg-casefile__photo">
                <Polaroid src={dressing} alt="楽屋" caption="Marcus's Dressing Room" tilt={-4} />
              </div>
              <div className="sg-casefile__body">
                <div className="sg-casefile__label">
                  <FolderOpen size={18} /> 事件ファイル <em>Case File</em>
                </div>
                <h2>事件名：The Final Act</h2>
                <p>開演中の劇場で、主演俳優が楽屋で死亡しているのが見つかった。</p>
                <dl>
                  <dt>被害者</dt><dd>Marcus Vance</dd>
                  <dt>死亡推定時刻</dt><dd>21:05</dd>
                  <dt>凶器</dt><dd>真鍮の燭台</dd>
                </dl>
                <Stamp>証拠に追加済み</Stamp>
              </div>
            </PaperCard>

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
            <p style={{ fontWeight: 900, fontSize: '1.4rem', letterSpacing: '0.2em' }}>900 — POIROT</p>
            <p><span className="nr-section-title__en">Case File · Interrogation · Evidence</span></p>
          </Panel>
        </main>
        {showNotebook && <CaseNotebookModal onClose={() => navigate('/style-guide')} />}
      </div>
    </div>
  )
}
