import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGameState } from '../hooks/useGameState'
import { useLanguage } from '../contexts/LanguageContext'
import { useScenario } from '../contexts/ScenarioContext'
import { emotionLabel } from '../utils/emotion'
import { sendChat } from '../api/chat'
import type { Message, Emotion } from '../types'
import './InterrogationPage.css'

export default function InterrogationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { evidence, unlockLocation, markSpokenTo } = useGameState()
  const { lang, t } = useLanguage()
  const { suspects: getSuspects, items: getItems, locations: getLocations, locationBg, examineRules } = useScenario()

  const suspects     = getSuspects(lang)
  const items        = getItems(lang)
  const allLocations = getLocations(lang)

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [currentEmotion, setCurrentEmotion] = useState<Emotion>('neutral')
  const [showEvidencePanel, setShowEvidencePanel] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [selectedEvidence, setSelectedEvidence] = useState<typeof items[0] | null>(null)

  const [displayedText, setDisplayedText] = useState('')
  const [currentSuspectMsg, setCurrentSuspectMsg] = useState<Message | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [lastPlayerText, setLastPlayerText] = useState('')

  const logEndRef = useRef<HTMLDivElement>(null)
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const suspect = suspects.find((s) => s.id === id)

  useEffect(() => {
    if (suspect) setCurrentEmotion(suspect.emotion)
  }, [suspect])

  useEffect(() => {
    if (showLog) logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, showLog])

  const startTyping = useCallback((msg: Message) => {
    setCurrentSuspectMsg(msg)
    setCurrentEmotion(msg.emotion ?? 'neutral')
    setDisplayedText('')
    setIsTyping(true)
    let i = 0
    typingTimerRef.current = setInterval(() => {
      i++
      setDisplayedText(msg.text.slice(0, i))
      if (i >= msg.text.length) {
        if (typingTimerRef.current) clearInterval(typingTimerRef.current)
        setIsTyping(false)
      }
    }, 45)
  }, [])

  const skipTyping = () => {
    if (!isTyping || !currentSuspectMsg) return
    if (typingTimerRef.current) clearInterval(typingTimerRef.current)
    setDisplayedText(currentSuspectMsg.text)
    setIsTyping(false)
  }

  if (!suspect) return <div>{t('not.found')}</div>

  const foundEvidenceItems = items.filter((item) => evidence.includes(item.id))

  const deliverReply = (msg: Message) => {
    setMessages((prev) => [...prev, msg])
    startTyping(msg)
    setLoading(false)
  }

  const getErrorReply = (): Message => ({
    role: 'suspect',
    text: lang === 'ja' ? '…（通信エラー。バックエンドを確認してください）' : '…(Connection error. Please check the backend.)',
    emotion: 'neutral',
  })

  const fetchReply = async (allMessages: Message[], itemId?: string) => {
    const latestPlayer = [...allMessages].reverse().find(m => m.role === 'player')
    const messageText = latestPlayer?.text ?? ''
    try {
      const res = await sendChat(suspect.id, messageText, lang)
      deliverReply({ role: 'suspect', text: res.text, emotion: res.emotion as Emotion })
      // Unlock location signalled by the backend after testimony
      const addUnlockMessage = (locId: string) => {
        const locName = allLocations.find(l => l.id === locId)?.name ?? locId
        const text = lang === 'ja'
          ? `🗺️ 新しい場所が解放されました：${locName}`
          : `🗺️ New area unlocked: ${locName}`
        setMessages(prev => [...prev, { role: 'system', text }])
      }
      if (res.unlocked_location) {
        unlockLocation(res.unlocked_location)
        addUnlockMessage(res.unlocked_location)
      } else {
        // Fallback: unlock alibi location on first question
        markSpokenTo(suspect.id)
        const alibiLoc = examineRules?.suspectAlibiLocation[suspect.id]
        if (alibiLoc && allMessages.filter(m => m.role === 'player').length === 1) {
          unlockLocation(alibiLoc)
          addUnlockMessage(alibiLoc)
        }
      }
    } catch (err) {
      console.warn('API unavailable, using mock:', err)
      // Still unlock alibi location in mock mode
      markSpokenTo(suspect.id)
      const alibiLoc = examineRules?.suspectAlibiLocation[suspect.id]
      if (alibiLoc && allMessages.filter(m => m.role === 'player').length === 1) {
        unlockLocation(alibiLoc)
        const locName = allLocations.find(l => l.id === alibiLoc)?.name ?? alibiLoc
        const text = lang === 'ja'
          ? `🗺️ 新しい場所が解放されました：${locName}`
          : `🗺️ New area unlocked: ${locName}`
        setMessages(prev => [...prev, { role: 'system', text }])
      }
      deliverReply(getErrorReply())
    }
  }

  const handleSend = () => {
    const hasText = input.trim().length > 0
    const hasEvidence = selectedEvidence !== null
    if ((!hasText && !hasEvidence) || loading || isTyping) return

    const evidenceItem = selectedEvidence
    const text = hasText
      ? input.trim()
      : `${evidenceItem!.emoji} ${evidenceItem!.name} ${t('interro.present')}`

    const displayText = hasEvidence
      ? hasText
        ? `${t('interro.present.fmt')}${evidenceItem!.emoji} ${evidenceItem!.name}｜${text}`
        : `${evidenceItem!.emoji} ${evidenceItem!.name} ${t('interro.present')}`
      : text

    setInput('')
    setSelectedEvidence(null)
    setLastPlayerText(displayText)

    const playerMsg: Message = {
      role: 'player',
      text: displayText,
      presentedItemId: evidenceItem?.id,
    }
    const next = [...messages, playerMsg]
    setMessages(next)
    setLoading(true)
    fetchReply(next, evidenceItem?.id)
  }

  const handleSelectEvidence = (itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    setSelectedEvidence(item)
    setShowEvidencePanel(false)
  }

  const isEmpty = !currentSuspectMsg && !loading

  const suspectLocation = allLocations.find(l => l.suspects.includes(id ?? ''))
  const bgUrl = suspectLocation ? locationBg(suspectLocation.id) : locationBg(id ?? '')

  return (
    <div className="interrogation-page">
      {/* 背景レイヤー */}
      {bgUrl && <div className="interro-bg" style={{ backgroundImage: `url(${bgUrl})` }} />}
      <div className="interro-overlay" />

      <div className="interrogation-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← {lang === 'ja' ? '戻る' : 'Back'}</button>
        <span className="header-title">{suspect.name}</span>
        <div className="header-actions">
          <span className="evidence-count-badge">{t('interro.evidence')} {evidence.length}{t('interro.unit')}</span>
          <button
            className={`log-btn${showLog ? ' active' : ''}`}
            onClick={() => { setShowLog((v) => !v); setShowEvidencePanel(false) }}
            title={t('interro.log')}
          >
            📋
          </button>
        </div>
      </div>

      <div className="character-area">
        <div className="character-emotion-display">{emotionLabel(currentEmotion)}</div>
        <div className="character-name-display">{suspect.name}</div>
      </div>

      <div
        className={`dialogue-box${isTyping ? ' typing' : ''}${isEmpty ? ' empty' : ''}`}
        onClick={skipTyping}
      >
        {lastPlayerText && (
          <div className="player-line">
            {t('interro.detective')}：「{lastPlayerText}」
          </div>
        )}
        {isEmpty && <p className="dialogue-hint">{t('interro.hint')}</p>}
        {loading && !isTyping && (
          <p className="dialogue-typing-indicator">{t('interro.typing')}</p>
        )}
        {currentSuspectMsg && (
          <p className="dialogue-text">
            「{displayedText}
            {isTyping && <span className="cursor">|</span>}
            」
          </p>
        )}
        {isTyping && (
          <span className="skip-hint">{t('interro.skip')}</span>
        )}
      </div>

      {showEvidencePanel && (
        <div className="evidence-panel">
          <div className="evidence-panel-header">
            <span>{t('interro.panel')}</span>
            <button className="evidence-panel-close" onClick={() => setShowEvidencePanel(false)}>✕</button>
          </div>
          {foundEvidenceItems.length === 0 ? (
            <p className="evidence-panel-empty">{t('interro.noevidence')}</p>
          ) : (
            <div className="evidence-panel-list">
              {foundEvidenceItems.map((item) => (
                <button
                  key={item.id}
                  className={`evidence-panel-item${selectedEvidence?.id === item.id ? ' selected' : ''}`}
                  onClick={() => handleSelectEvidence(item.id)}
                >
                  <span className="ep-emoji">{item.emoji}</span>
                  <div className="ep-info">
                    <span className="ep-name">{item.name}</span>
                    <span className="ep-detail">{item.detail}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {showLog && (
        <div className="log-overlay" onClick={() => setShowLog(false)}>
          <div className="log-panel" onClick={(e) => e.stopPropagation()}>
            <div className="log-header">
              <span>{t('interro.log')}</span>
              <button className="evidence-panel-close" onClick={() => setShowLog(false)}>✕</button>
            </div>
            <div className="log-list">
              {messages.length === 0 && (
                <p className="log-empty">{lang === 'ja' ? 'まだ会話がない' : 'No messages yet'}</p>
              )}
              {messages.map((msg, i) => (
                msg.role === 'system' ? (
                  <div key={i} className="log-entry system">
                    <p className="log-system-text">{msg.text}</p>
                  </div>
                ) : (
                  <div key={i} className={`log-entry ${msg.role}`}>
                    <span className="log-role">
                      {msg.role === 'player' ? t('interro.detective') : suspect.name}
                      {msg.emotion ? `　${emotionLabel(msg.emotion)}` : ''}
                    </span>
                    <p className="log-text">
                      {msg.presentedItemId ? `${t('interro.present.fmt')}${msg.text}` : msg.text}
                    </p>
                  </div>
                )
              ))}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* 告発ボタン */}
      <button
        className="interro-accuse-btn"
        onClick={() => navigate(`/confront/${suspect.id}`)}
      >
        {lang === 'ja' ? `⚖️ ${suspect.name} を告発する` : `⚖️ Accuse ${suspect.name}`}
      </button>

      <div className="chat-input-area">
        {selectedEvidence && (
          <div className="selected-evidence-chip">
            <span>{selectedEvidence.emoji} {selectedEvidence.name}</span>
            <button
              className="chip-clear"
              onClick={() => setSelectedEvidence(null)}
              title={lang === 'ja' ? '証拠を外す' : 'Remove evidence'}
            >✕</button>
          </div>
        )}
        <div className="chat-input-row">
          <button
            className={`evidence-btn${showEvidencePanel ? ' active' : ''}`}
            onClick={() => { setShowEvidencePanel((v) => !v); setShowLog(false) }}
            disabled={loading || isTyping}
            title={t('interro.panel')}
          >
            🗂
          </button>
          <input
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder={selectedEvidence ? t('interro.comment') : t('interro.question')}
            disabled={loading || isTyping}
            autoFocus
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={loading || isTyping || (!input.trim() && !selectedEvidence)}
          >
            {t('interro.send')}
          </button>
        </div>
      </div>
    </div>
  )
}
