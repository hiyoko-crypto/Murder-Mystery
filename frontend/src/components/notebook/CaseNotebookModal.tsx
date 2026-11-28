import { useState } from 'react'
import { createPortal } from 'react-dom'
import { NotebookPen, X } from 'lucide-react'
import { useLanguage } from '../../contexts/LanguageContext'
import { useCaseNotes } from '../../contexts/CaseNotesContext'
import { useGame } from '../../contexts/GameContext'
import { useScenario } from '../../contexts/ScenarioContext'
import { SectionTitle } from '../ui/Noir'
import { renderMiniMarkdown } from '../../utils/miniMarkdown'
import RelationshipBoard from './RelationshipBoard'
import TimelineBoard from './TimelineBoard'
import HistoryList from './HistoryList'
import './CaseNotebookModal.css'

type Tab = 'history' | 'evidence' | 'relationships' | 'timeline' | 'memo'

function MemoTab() {
  const { lang } = useLanguage()
  const { memo, setMemo } = useCaseNotes()
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')

  return (
    <div className="memo-tab">
      <div className="memo-mode-toggle">
        <button
          className={`memo-mode-btn${mode === 'edit' ? ' active' : ''}`}
          onClick={() => setMode('edit')}
        >
          {lang === 'ja' ? '編集' : 'Edit'}
        </button>
        <button
          className={`memo-mode-btn${mode === 'preview' ? ' active' : ''}`}
          onClick={() => setMode('preview')}
        >
          {lang === 'ja' ? 'プレビュー' : 'Preview'}
        </button>
        <span className="memo-mode-hint">
          {lang === 'ja' ? '# 見出し／**太字**／- リストなどのMarkdownが使えます' : 'Supports Markdown: # heading, **bold**, - list, etc.'}
        </span>
      </div>
      {mode === 'edit' ? (
        <textarea
          className="memo-textarea"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder={lang === 'ja' ? '犯人は誰か、何が分かったか、自由に書き留めてください...' : 'Jot down who you suspect and what you\'ve learned...'}
        />
      ) : (
        <div className="memo-preview">
          {memo.trim() ? renderMiniMarkdown(memo) : (
            <p className="memo-preview-empty">{lang === 'ja' ? '（まだ何も書かれていません）' : '(Nothing written yet)'}</p>
          )}
        </div>
      )}
    </div>
  )
}

/** Found evidence: list on the left page, the selected item on the right. */
function EvidenceTab() {
  const { lang } = useLanguage()
  const { foundItems, itemDescriptions } = useGame()
  const { items } = useScenario()
  const found = items(lang).filter(item => foundItems.includes(item.id))
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = found.find(item => item.id === selectedId) ?? found[0]

  if (found.length === 0) {
    return <p className="nb-empty">{lang === 'ja' ? 'まだ証拠を見つけていません。' : 'No evidence found yet.'}</p>
  }

  return (
    <div className="nb-evidence">
      <ul className="nb-evidence__list">
        {found.map(item => (
          <li key={item.id}>
            <button
              className={`nb-evidence__row${item.id === selected?.id ? ' is-active' : ''}`}
              onClick={() => setSelectedId(item.id)}
            >
              <span className="nb-evidence__thumb">{item.emoji}</span>
              <span>{item.name}</span>
            </button>
          </li>
        ))}
      </ul>
      {selected && (
        <div className="nb-evidence__detail">
          <h3>{selected.name}</h3>
          <div className="nb-evidence__photo">{selected.emoji}</div>
          <p>{itemDescriptions[selected.id] || selected.detail || selected.discoveryText}</p>
        </div>
      )}
    </div>
  )
}

export default function CaseNotebookModal({ onClose }: { onClose: () => void }) {
  const { lang } = useLanguage()
  const [tab, setTab] = useState<Tab>('history')
  const ja = lang === 'ja'

  const tabs: { key: Tab; label: string }[] = [
    { key: 'history', label: ja ? '記録' : 'Log' },
    { key: 'evidence', label: ja ? '証拠' : 'Evidence' },
    { key: 'relationships', label: ja ? '人物相関図' : 'Relationships' },
    { key: 'timeline', label: ja ? 'タイムライン' : 'Timeline' },
    { key: 'memo', label: ja ? 'メモ' : 'Memo' },
  ]

  // Rendered via a portal straight into document.body: this modal gets
  // triggered from inside headers that use backdrop-filter, and
  // backdrop-filter creates a new containing block for position:fixed
  // descendants — without the portal, the overlay would center itself inside
  // that small header instead of the viewport.
  return createPortal(
    <div className="nr-scrim nb-overlay" onClick={onClose}>
      <div className="nb-panel" onClick={(e) => e.stopPropagation()}>
        <div className="nb-header">
          <SectionTitle
            icon={<NotebookPen size={22} />}
            ja={ja ? '捜査ノート' : 'Case Notebook'}
            en={ja ? 'Case Notebook' : undefined}
            divider={false}
          />
          <button className="nr-close" onClick={onClose} aria-label={ja ? '閉じる' : 'Close'}>
            <X size={18} />
          </button>
        </div>
        <div className="nb-tabs" role="tablist">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              className={`nb-tab${tab === key ? ' is-active' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="nb-page">
          {tab === 'history' && <HistoryList />}
          {tab === 'evidence' && <EvidenceTab />}
          {tab === 'relationships' && <RelationshipBoard />}
          {tab === 'timeline' && <TimelineBoard />}
          {tab === 'memo' && <MemoTab />}
        </div>
      </div>
    </div>,
    document.body,
  )
}
