import { useLanguage } from '../../contexts/LanguageContext'
import { useCaseNotes, type HistoryEventType } from '../../contexts/CaseNotesContext'
import './HistoryList.css'

const HISTORY_ICON: Record<HistoryEventType, string> = {
  chat: '💬',
  unlock_location: '🗺️',
  examine_location: '🔍',
  indict: '⚖️',
}

export default function HistoryList() {
  const { lang } = useLanguage()
  const { history } = useCaseNotes()
  const reversed = [...history].reverse()

  if (reversed.length === 0) {
    return <p className="notebook-empty">{lang === 'ja' ? 'まだ記録がありません' : 'No activity yet'}</p>
  }

  return (
    <div className="history-list">
      {reversed.map((entry, i) => (
        <div key={entry.id} className="history-entry">
          <span className="history-icon">{HISTORY_ICON[entry.type]}</span>
          <span className="history-index">#{reversed.length - i}</span>
          <span className="history-summary">{entry.summary}</span>
        </div>
      ))}
    </div>
  )
}
