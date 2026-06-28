import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSuspects, getItems, getConfrontScript } from '../data/mockData'
import { useGameState } from '../hooks/useGameState'
import { useLanguage } from '../contexts/LanguageContext'
import { emotionLabel } from '../utils/emotion'
import type { Emotion } from '../types'
import './ConfrontationPage.css'

const KEY_EVIDENCE_IDS = ['handkerchief', 'torn_note']
const WRONG_LIMIT = 3

type Phase = 'confronting' | 'confessed' | 'wrong' | 'cutoff'

interface Line {
  speaker: 'suspect' | 'player'
  text: string
  emotion?: Emotion
  isEvidence?: boolean
}

export default function ConfrontationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { evidence } = useGameState()
  const { lang, t } = useLanguage()

  const suspects = getSuspects(lang)
  const items    = getItems(lang)
  const confrontScript = getConfrontScript(lang)

  const suspect = suspects.find((s) => s.id === id)
  const script  = id ? confrontScript[id] : null

  const [phase, setPhase] = useState<Phase>('confronting')
  const [lines, setLines] = useState<Line[]>([])
  const [input, setInput] = useState('')
  const [selectedEvidence, setSelectedEvidence] = useState<typeof items[0] | null>(null)
  const [showEvidencePanel, setShowEvidencePanel] = useState(false)
  const [displayedText, setDisplayedText] = useState('')
  const [currentLine, setCurrentLine] = useState<Line | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [keyHits, setKeyHits] = useState(0)
  const [wrongCount, setWrongCount] = useState(0)
  const [denialIndex, setDenialIndex] = useState(0)
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>('neutral')
  const [initialized, setInitialized] = useState(false)
  const [presentedIds, setPresentedIds] = useState<Set<string>>(new Set())

  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const foundEvidenceItems = items.filter((item) => evidence.includes(item.id))

  const startTyping = useCallback((line: Line) => {
    setCurrentLine(line)
    setCurrentEmotion(line.emotion ?? 'neutral')
    setDisplayedText('')
    setIsTyping(true)
    let i = 0
    typingTimerRef.current = setInterval(() => {
      i++
      setDisplayedText(line.text.slice(0, i))
      if (i >= line.text.length) {
        if (typingTimerRef.current) clearInterval(typingTimerRef.current)
        setIsTyping(false)
      }
    }, 45)
  }, [])

  const skipTyping = () => {
    if (!isTyping || !currentLine) return
    if (typingTimerRef.current) clearInterval(typingTimerRef.current)
    setDisplayedText(currentLine.text)
    setIsTyping(false)
  }

  const deliverLine = useCallback((line: Line) => {
    setLines((prev) => [...prev, line])
    startTyping(line)
  }, [startTyping])

  useEffect(() => {
    if (!suspect || !script || initialized) return
    setInitialized(true)
    setCurrentEmotion(script.openingEmotion)
    setTimeout(() => deliverLine({
      speaker: 'suspect',
      text: script.opening,
      emotion: script.openingEmotion,
    }), 400)
  }, [suspect, script, initialized, deliverLine])

  if (!suspect || !script) return <div>{t('not.found')}</div>

  const handleSend = () => {
    const hasEvidence = selectedEvidence !== null
    const hasText = input.trim().length > 0
    if ((!hasEvidence && !hasText) || isTyping || phase !== 'confronting') return

    const evidenceItem = selectedEvidence
    const rawText = hasText ? input.trim() : `${evidenceItem!.emoji} ${evidenceItem!.name} ${t('confront.present')}`
    const displayText = hasEvidence && hasText
      ? `${t('confront.evidence.fmt')}${evidenceItem!.emoji} ${evidenceItem!.name}｜「${rawText}」`
      : rawText

    setInput('')
    setSelectedEvidence(null)

    setLines((prev) => [...prev, { speaker: 'player', text: displayText, isEvidence: hasEvidence }])

    if (!hasEvidence) {
      setTimeout(() => {
        const denial = script.denials[denialIndex % script.denials.length]
        setDenialIndex((n) => n + 1)
        deliverLine({ speaker: 'suspect', ...denial })
      }, 300)
      return
    }

    const itemId = evidenceItem!.id
    setPresentedIds((prev) => new Set(prev).add(itemId))

    const isKey = KEY_EVIDENCE_IDS.includes(itemId)
    const newKeyHits = keyHits + (isKey ? 1 : 0)
    if (isKey) setKeyHits(newKeyHits)

    const isWrong = !isKey
    const newWrongCount = wrongCount + (isWrong ? 1 : 0)
    if (isWrong) setWrongCount(newWrongCount)

    setTimeout(() => {
      if (suspect.guilty && newKeyHits >= 2) {
        deliverLine({ speaker: 'suspect', text: script.confession, emotion: 'nervous' })
        setTimeout(() => setPhase('confessed'), script.confession.length * 45 + 600)
        return
      }
      if (newWrongCount >= WRONG_LIMIT) {
        deliverLine({ speaker: 'suspect', text: script.cutoff, emotion: 'angry' })
        setTimeout(() => setPhase('cutoff'), script.cutoff.length * 45 + 600)
        return
      }
      if (!suspect.guilty && lines.length >= 10) {
        deliverLine({ speaker: 'suspect', text: script.wrongAccusation, emotion: 'sad' })
        setTimeout(() => setPhase('wrong'), script.wrongAccusation.length * 45 + 600)
        return
      }
      const keyReply = script.keyEvidence[itemId]
      if (keyReply) {
        deliverLine({ speaker: 'suspect', ...keyReply })
        return
      }
      const denial = script.denials[denialIndex % script.denials.length]
      setDenialIndex((n) => n + 1)
      deliverLine({ speaker: 'suspect', ...denial })
    }, 300)
  }

  /* ── エンディング画面 ── */
  if (phase === 'confessed') {
    return (
      <div className="confrontation-page">
        <div className="ending correct">
          <p className="ending-label">{t('ending.confession')}</p>
          <p className="ending-name">{suspect.name}</p>
          <p className="ending-emotion">😨</p>
          <p className="ending-text" style={{ whiteSpace: 'pre-line' }}>
            {suspect.name} {t('ending.confessed')}
          </p>
          <p className="ending-sub">{t('ending.solved')}</p>
          <button className="ending-btn" onClick={() => navigate('/')}>{t('ending.toTitle')}</button>
        </div>
      </div>
    )
  }

  if (phase === 'wrong') {
    return (
      <div className="confrontation-page">
        <div className="ending wrong">
          <p className="ending-label">{t('ending.wrong')}</p>
          <p className="ending-name">{suspect.name}</p>
          <p className="ending-text" style={{ whiteSpace: 'pre-line' }}>
            {suspect.name} {t('ending.innocent')}
          </p>
          <div className="ending-actions">
            <button className="ending-btn secondary" onClick={() => navigate(-1)}>{t('ending.reaccuse')}</button>
            <button className="ending-btn" onClick={() => navigate('/map')}>{t('ending.backinv')}</button>
          </div>
        </div>
      </div>
    )
  }

  if (phase === 'cutoff') {
    return (
      <div className="confrontation-page">
        <div className="ending wrong">
          <p className="ending-label">{t('ending.cutoff')}</p>
          <p className="ending-name">{suspect.name}</p>
          <p className="ending-text" style={{ whiteSpace: 'pre-line' }}>
            {suspect.name} {t('ending.cutoff.text')}
          </p>
          <div className="ending-actions">
            <button className="ending-btn secondary" onClick={() => navigate(-1)}>{t('ending.reaccuse')}</button>
            <button className="ending-btn" onClick={() => navigate('/map')}>{t('ending.backinv')}</button>
          </div>
        </div>
      </div>
    )
  }

  /* ── 対決メイン画面 ── */
  return (
    <div className="confrontation-page">
      <div className="confrontation-header">
        <button className="back-btn" onClick={() => navigate(-1)}>{t('confront.back')}</button>
        <span className="confrontation-label">{t('confront.label')}</span>
        <div className="header-right">
          <span className="key-hits-badge">{'⚡'.repeat(keyHits)}{'○'.repeat(Math.max(0, 2 - keyHits))}</span>
          <span className="wrong-badge" title={lang === 'ja' ? '失敗回数' : 'Wrong count'}>
            {'✗'.repeat(wrongCount)}{'·'.repeat(Math.max(0, WRONG_LIMIT - wrongCount))}
          </span>
        </div>
      </div>

      <div className="confrontation-character">
        <div className="character-emotion-display">{emotionLabel(currentEmotion)}</div>
        <div className="character-name-display">{suspect.name}</div>
      </div>

      <div className="confrontation-log">
        {lines.slice(-4).map((line, i) => (
          <div key={i} className={`conf-line ${line.speaker}${line.isEvidence ? ' evidence' : ''}`}>
            {line.isEvidence
              ? <span className="conf-evidence-text">{line.text}</span>
              : <span>{line.speaker === 'player' ? `${lang === 'ja' ? '探偵' : 'Detective'}：「${line.text}」` : line.text}</span>
            }
          </div>
        ))}
      </div>

      <div
        className={`confrontation-dialogue${isTyping ? ' typing' : ''}`}
        onClick={skipTyping}
      >
        {currentLine?.speaker === 'suspect' && (
          <p className="conf-dialogue-text">
            「{displayedText}{isTyping && <span className="cursor">|</span>}」
          </p>
        )}
        {isTyping && <span className="skip-hint">{t('confront.skip')}</span>}
      </div>

      {showEvidencePanel && (
        <div className="evidence-panel">
          <div className="evidence-panel-header">
            <span>{t('confront.evidence')}</span>
            <button className="evidence-panel-close" onClick={() => setShowEvidencePanel(false)}>✕</button>
          </div>
          {foundEvidenceItems.length === 0 ? (
            <p className="evidence-panel-empty">{t('confront.noevidence')}</p>
          ) : (
            <div className="evidence-panel-list">
              {foundEvidenceItems.map((item) => {
                const alreadyUsed = presentedIds.has(item.id)
                const isSelected = selectedEvidence?.id === item.id
                return (
                  <button
                    key={item.id}
                    className={`evidence-panel-item${isSelected ? ' selected' : ''}${alreadyUsed ? ' used' : ''}`}
                    onClick={() => {
                      if (alreadyUsed) return
                      setSelectedEvidence(item)
                      setShowEvidencePanel(false)
                    }}
                    disabled={alreadyUsed}
                  >
                    <span className="ep-emoji">{item.emoji}</span>
                    <div className="ep-info">
                      <span className="ep-name">{item.name}{alreadyUsed ? ` ${t('confront.used')}` : ''}</span>
                      <span className="ep-detail">{item.detail}</span>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}

      <div className="confrontation-input-area">
        {selectedEvidence && (
          <div className="selected-evidence-chip">
            <span>{selectedEvidence.emoji} {selectedEvidence.name}</span>
            <button className="chip-clear" onClick={() => setSelectedEvidence(null)}>✕</button>
          </div>
        )}
        <div className="confrontation-input-row">
          <button
            className={`confront-attach-btn${showEvidencePanel ? ' active' : ''}`}
            onClick={() => setShowEvidencePanel((v) => !v)}
            disabled={isTyping}
            title={t('confront.evidence')}
          >
            🗂
          </button>
          <input
            className="confrontation-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={selectedEvidence ? t('confront.comment') : t('confront.input')}
            disabled={isTyping}
          />
          <button
            className="confront-send-btn"
            onClick={handleSend}
            disabled={isTyping || (!input.trim() && !selectedEvidence)}
          >
            {t('confront.send')}
          </button>
        </div>
      </div>
    </div>
  )
}
