import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useLanguage } from '../../contexts/LanguageContext'
import { useCaseNotes } from '../../contexts/CaseNotesContext'
import { renderMiniMarkdown } from '../../utils/miniMarkdown'
import RelationshipBoard from './RelationshipBoard'
import TimelineBoard from './TimelineBoard'
import HistoryList from './HistoryList'
import './CaseNotebookModal.css'

type Tab = 'history' | 'relationships' | 'timeline' | 'memo'

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

export default function CaseNotebookModal({ onClose }: { onClose: () => void }) {
  const { lang } = useLanguage()
  const [tab, setTab] = useState<Tab>('history')

  const tabs: { key: Tab; label: string }[] = [
    { key: 'history', label: lang === 'ja' ? '📜 記録' : '📜 History' },
    { key: 'relationships', label: lang === 'ja' ? '🕸️ 関係図' : '🕸️ Relationships' },
    { key: 'timeline', label: lang === 'ja' ? '🕐 タイムライン' : '🕐 Timeline' },
    { key: 'memo', label: lang === 'ja' ? '📝 メモ' : '📝 Memo' },
  ]

  // Rendered via a portal straight into document.body: this modal gets
  // triggered from inside headers that use backdrop-filter (e.g.
  // InterrogationPage), and backdrop-filter creates a new containing block
  // for position:fixed descendants — without the portal, the overlay would
  // center itself inside that small header instead of the viewport.
  return createPortal(
    <div className="confirm-overlay notebook-overlay" onClick={onClose}>
      <div className="confirm-dialog notebook-panel" onClick={(e) => e.stopPropagation()}>
        <div className="notebook-header">
          <span className="notebook-title">{lang === 'ja' ? '— 捜査ノート —' : '— Case Notebook —'}</span>
          <button className="icon-btn-close lg" onClick={onClose}>✕</button>
        </div>
        <div className="notebook-tabs">
          {tabs.map(({ key, label }) => (
            <button
              key={key}
              className={`notebook-tab-btn${tab === key ? ' active' : ''}`}
              onClick={() => setTab(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="notebook-body">
          {tab === 'history' && <HistoryList />}
          {tab === 'relationships' && <RelationshipBoard />}
          {tab === 'timeline' && <TimelineBoard />}
          {tab === 'memo' && <MemoTab />}
        </div>
      </div>
    </div>,
    document.body,
  )
}
