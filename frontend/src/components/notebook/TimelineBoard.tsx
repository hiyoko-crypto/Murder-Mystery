import { useMemo, useRef, useState } from 'react'
import { useCaseNotes, type TimelineEntry } from '../../contexts/CaseNotesContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { useScenario } from '../../contexts/ScenarioContext'
import './TimelineBoard.css'

// "Unassigned" column key — TimelineEntry.suspectId is undefined for entries
// with no suspect picked, but undefined can't be a Map/object key the way
// we want it to compare, so it's normalized to this string instead.
const UNASSIGNED = '__none__'

function Column({
  columnId, title, entries, suspects, lang,
}: {
  columnId: string
  title: string
  entries: TimelineEntry[]
  suspects: { id: string; name: string }[]
  lang: string
}) {
  const { addTimelineEntry, updateTimelineEntry, removeTimelineEntry, reorderTimeline } = useCaseNotes()
  const [dragId, setDragId] = useState<string | null>(null)
  const dragOverId = useRef<string | null>(null)

  return (
    <div className="timeline-column">
      <div className="timeline-column-header">{title}</div>
      <div className="timeline-column-list">
        {entries.map(entry => (
          <div
            key={entry.id}
            className={`timeline-card${dragId === entry.id ? ' dragging' : ''}`}
            draggable
            onDragStart={() => setDragId(entry.id)}
            onDragOver={(e) => { e.preventDefault(); dragOverId.current = entry.id }}
            onDrop={() => {
              if (dragId && dragOverId.current && dragId !== dragOverId.current) {
                reorderTimeline(dragId, dragOverId.current)
              }
              setDragId(null)
            }}
            onDragEnd={() => setDragId(null)}
          >
            <span className="timeline-drag-handle" title={lang === 'ja' ? 'ドラッグで並べ替え' : 'Drag to reorder'}>⠿</span>
            <div className="timeline-card-fields">
              <div className="timeline-card-row">
                <input
                  className="timeline-time-input"
                  placeholder={lang === 'ja' ? '時刻（例：20:15）' : 'Time (e.g. 20:15)'}
                  value={entry.time}
                  onChange={(e) => updateTimelineEntry(entry.id, { time: e.target.value })}
                />
                <select
                  className="timeline-suspect-select"
                  value={entry.suspectId ?? ''}
                  onChange={(e) => updateTimelineEntry(entry.id, { suspectId: e.target.value || undefined })}
                  title={lang === 'ja' ? '別の人物の列に移す' : 'Move to another person\'s column'}
                >
                  <option value="">{lang === 'ja' ? '（人物なし）' : '(no one)'}</option>
                  {suspects.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <button
                  className="icon-btn-close"
                  onClick={() => removeTimelineEntry(entry.id)}
                  title={lang === 'ja' ? '削除' : 'Delete'}
                >✕</button>
              </div>
              <textarea
                className="timeline-text-input"
                placeholder={lang === 'ja' ? '出来事・アリバイなどを記入...' : 'Describe the event or alibi...'}
                value={entry.text}
                onChange={(e) => updateTimelineEntry(entry.id, { text: e.target.value })}
                rows={2}
              />
            </div>
          </div>
        ))}
        {entries.length === 0 && (
          <p className="timeline-empty">{lang === 'ja' ? 'まだ何もない' : 'Nothing yet'}</p>
        )}
      </div>
      <button
        className="timeline-add-btn"
        onClick={() => addTimelineEntry(columnId === UNASSIGNED ? undefined : columnId)}
      >
        {lang === 'ja' ? '＋ 追加' : '+ Add'}
      </button>
    </div>
  )
}

export default function TimelineBoard() {
  const { lang } = useLanguage()
  const { suspects: getSuspects } = useScenario()
  const { timeline } = useCaseNotes()
  const suspects = getSuspects(lang)

  // One pass over the flat timeline instead of a separate .filter() per
  // column (which would re-scan the whole array once per suspect).
  const bySuspect = useMemo(() => {
    const map = new Map<string, TimelineEntry[]>()
    for (const entry of timeline) {
      const key = entry.suspectId ?? UNASSIGNED
      const bucket = map.get(key)
      if (bucket) bucket.push(entry)
      else map.set(key, [entry])
    }
    return map
  }, [timeline])

  const unassigned = bySuspect.get(UNASSIGNED) ?? []

  return (
    <div className="timeline-board">
      <p className="rel-hint">
        {lang === 'ja'
          ? '容疑者ごとに列で並んでいます。ドラッグで並べ替え、時刻・内容を書き込めます'
          : 'Laid out one column per suspect — drag to reorder, fill in time and notes'}
      </p>
      <div className="timeline-columns">
        {suspects.map(s => (
          <Column
            key={s.id}
            columnId={s.id}
            title={s.name}
            entries={bySuspect.get(s.id) ?? []}
            suspects={suspects}
            lang={lang}
          />
        ))}
        {(unassigned.length > 0 || suspects.length === 0) && (
          <Column
            columnId={UNASSIGNED}
            title={lang === 'ja' ? '人物なし' : 'Unassigned'}
            entries={unassigned}
            suspects={suspects}
            lang={lang}
          />
        )}
      </div>
    </div>
  )
}
