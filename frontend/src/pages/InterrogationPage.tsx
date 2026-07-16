import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame } from '../contexts/GameContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useScenario } from '../contexts/ScenarioContext'
import { useCaseNotes } from '../contexts/CaseNotesContext'
import { sendChat } from '../api/chat'
import { callIndict } from '../api/examine'
import { suspectAvatarEmoji } from '../utils/avatar'
import NotebookLauncher from '../components/notebook/NotebookLauncher'
import type { Message } from '../types'
import './InterrogationPage.css'

export default function InterrogationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { foundItems, refetchState, getConversation, setConversation } = useGame()
  const { lang, t } = useLanguage()
  const { suspects: getSuspects, items: getItems, locations: getLocations, locationBg } = useScenario()
  const { appendHistory } = useCaseNotes()
  const tt = (ja: string, en: string) => (lang === 'ja' ? ja : en)

  const suspects     = getSuspects(lang)
  const items        = getItems(lang)
  const allLocations = getLocations(lang)

  const [messages, setMessagesLocal] = useState<Message[]>(() => getConversation(id ?? ''))

  const setMessages = (updater: Message[] | ((prev: Message[]) => Message[])) => {
    setMessagesLocal(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      setConversation(id ?? '', next)
      return next
    })
  }
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [showEvidencePanel, setShowEvidencePanel] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [selectedEvidence, setSelectedEvidence] = useState<typeof items[0] | null>(null)

  const [displayedText, setDisplayedText] = useState('')
  const [currentSuspectMsg, setCurrentSuspectMsg] = useState<Message | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [lastPlayerText, setLastPlayerText] = useState('')
  const [unlockNotice, setUnlockNotice] = useState<string | null>(null)
  const [interrogating, setInterrogating] = useState(false)
  const [showIndictFlash, setShowIndictFlash] = useState(false)
  const [indictResult, setIndictResult] = useState<{ message: string } | null>(null)

  const logEndRef = useRef<HTMLDivElement>(null)
  const dialogueScrollRef = useRef<HTMLDivElement>(null)
  const typingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const typingCompleteRef = useRef<(() => void) | null>(null)
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Bumped on every send and on cancel — fetchReply checks this after its
  // await to tell whether the player bailed out while waiting, since the
  // backend call itself can't actually be aborted mid-flight (it's already
  // running server-side by the time the response would arrive).
  const requestIdRef = useRef(0)
  // What to restore into the input/evidence chip if the player cancels
  // before the reply comes back, so a mistaken send doesn't lose their text.
  const pendingInputRef = useRef('')
  const pendingEvidenceRef = useRef<typeof items[0] | null>(null)
  const prevLastPlayerTextRef = useRef('')
  // Player statements made since entering interrogation mode — accumulated
  // as the "reason" handed to /indict when the player explicitly files the
  // charge. A ref, not state: it's an accumulator read at submit time, never
  // rendered on its own (the statements themselves already show in the chat).
  const accusationRef = useRef<string[]>([])

  const suspect = suspects.find((s) => s.id === id)

  useEffect(() => {
    if (showLog) logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, showLog])

  // Keeps the newest line in view as the suspect's reply streams in — long
  // replies no longer get clipped by the dialogue box's fixed height, they
  // scroll instead.
  useEffect(() => {
    const el = dialogueScrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [displayedText, lastPlayerText, loading, currentSuspectMsg])

  useEffect(() => {
    return () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current) }
  }, [])

  const startTyping = useCallback((msg: Message, onComplete?: () => void) => {
    setCurrentSuspectMsg(msg)
    setDisplayedText('')
    setIsTyping(true)
    typingCompleteRef.current = onComplete ?? null
    let i = 0
    typingTimerRef.current = setInterval(() => {
      i++
      setDisplayedText(msg.text.slice(0, i))
      if (i >= msg.text.length) {
        if (typingTimerRef.current) clearInterval(typingTimerRef.current)
        setIsTyping(false)
        const cb = typingCompleteRef.current
        typingCompleteRef.current = null
        cb?.()
      }
    }, 45)
  }, [])

  const skipTyping = () => {
    if (!isTyping || !currentSuspectMsg) return
    if (typingTimerRef.current) clearInterval(typingTimerRef.current)
    setDisplayedText(currentSuspectMsg.text)
    setIsTyping(false)
    const cb = typingCompleteRef.current
    typingCompleteRef.current = null
    cb?.()
  }

  if (!suspect) return <div>{t('not.found')}</div>

  if (indictResult) {
    return (
      <div className="interro-ending-page">
        <div className="ending correct">
          <p className="ending-label">{t('ending.confession')}</p>
          <p className="ending-name">{suspect.name}</p>
          <p className="ending-emotion">😨</p>
          <p className="ending-text" style={{ whiteSpace: 'pre-line' }}>{indictResult.message}</p>
          <button className="ending-btn" onClick={() => navigate('/')}>{t('ending.toTitle')}</button>
        </div>
      </div>
    )
  }

  const foundEvidenceItems = items.filter((item) => foundItems.includes(item.id))

  const deliverReply = (msg: Message, onComplete?: () => void) => {
    setMessages((prev) => [...prev, msg])
    startTyping(msg, onComplete)
    setLoading(false)
  }

  const suspectLine = (ja: string, en: string): Message => ({ role: 'suspect', text: tt(ja, en) })

  const getErrorReply = (): Message =>
    suspectLine('…（通信エラー。バックエンドを確認してください）', '…(Connection error. Please check the backend.)')

  const fetchReply = async (messageText: string, requestId: number) => {
    try {
      const res = await sendChat(suspect.id, messageText, lang)
      // Player hit cancel while this was in flight — the backend has already
      // processed it by now regardless, but there's nothing left to show for
      // it: skip displaying the reply and skip recording it as a statement.
      if (requestIdRef.current !== requestId) return

      const truncated = messageText.length > 40 ? `${messageText.slice(0, 40)}…` : messageText
      appendHistory({
        type: 'chat',
        suspectId: suspect.id,
        summary: tt(`${suspect.name}に「${truncated}」と質問`, `Asked ${suspect.name}: "${truncated}"`),
      })
      if (res.unlocked_location) {
        await refetchState()
        const locName = allLocations.find(l => l.id === res.unlocked_location)?.name ?? res.unlocked_location
        const text = tt(`🗺️ 新しい場所が解放されました：${locName}`, `🗺️ New area unlocked: ${locName}`)
        setMessages(prev => [...prev, { role: 'system', text }])
        setUnlockNotice(locName)
        appendHistory({
          type: 'unlock_location',
          locationId: res.unlocked_location,
          suspectId: suspect.id,
          summary: tt(`${suspect.name}との会話で${locName}が解放された`, `Talking to ${suspect.name} unlocked ${locName}`),
        })
      }

      if (!interrogating) {
        deliverReply({ role: 'suspect', text: res.text })
        return
      }

      // While pressing a suspect, hold the reply back until the verdict
      // check has resolved: if it's already a win, showing the suspect's
      // in-character denial first — only to immediately reverse it — reads
      // as an odd non-sequitur. res.message is the scenario's own
      // case-solution explanation (third-person, written for the ending
      // screen) — not something the suspect would say, so a fixed
      // confession line plays as dialogue instead, and the explanation
      // stays reserved for the ending screen.
      accusationRef.current.push(messageText)
      const reason = accusationRef.current.join('\n')
      const win = await callIndict(suspect.id, reason, lang)
        .then(indictRes => (indictRes.won ? { message: indictRes.message } : null))
        .catch(() => null) // background check — just try again next turn

      if (win) {
        appendHistory({
          type: 'indict',
          suspectId: suspect.id,
          summary: tt(`${suspect.name}を追及の末、自白させた`, `Pressed ${suspect.name} into a confession`),
        })
        const confessionLine = suspectLine(
          '……もう、ごまかせないみたいですね。……私が、やりました。',
          "……There's no point pretending anymore. …I did it.",
        )
        deliverReply(confessionLine, () => {
          setTimeout(() => setIndictResult({ message: win.message }), 1200)
        })
      } else {
        deliverReply({ role: 'suspect', text: res.text })
      }
    } catch (err) {
      if (requestIdRef.current !== requestId) return
      console.warn('API unavailable:', err)
      deliverReply(getErrorReply())
    }
  }

  // 追及モードに入る瞬間だけ一瞬「起訴！」のスタンプを出し、決まり文句の
  // 「犯人はあなただ！」→「なぜそう思うんですか？」を静的に（API を呼ばず）
  // 差し込んで追及の空気を作る。会話はそのまま続けられて、以降は毎ターンの
  // 返信のたびに裏で自動的に判定が走る（fetchReply参照）。
  const startInterrogating = () => {
    setInterrogating(true)
    accusationRef.current = []
    setShowEvidencePanel(false)
    setShowLog(false)
    setShowIndictFlash(true)
    flashTimerRef.current = setTimeout(() => setShowIndictFlash(false), 1100)

    const openingLine = tt('犯人はあなただ！', `You're the culprit!`)
    const openingReply = suspectLine('……なぜそう思うんですか？', '…Why would you think that?')
    setLastPlayerText(openingLine)
    setMessages(prev => [...prev, { role: 'player', text: openingLine }, openingReply])
    startTyping(openingReply)
  }

  const stopInterrogating = () => {
    setInterrogating(false)
    accusationRef.current = []
  }

  const handleSend = () => {
    const hasText = input.trim().length > 0
    const hasEvidence = selectedEvidence !== null
    if ((!hasText && !hasEvidence) || loading || isTyping) return

    const evidenceItem = selectedEvidence
    const displayText = hasEvidence
      ? hasText
        ? `${t('interro.present.fmt')}${evidenceItem!.emoji} ${evidenceItem!.name}｜${input.trim()}`
        : `${evidenceItem!.emoji} ${evidenceItem!.name} ${t('interro.present')}`
      : input.trim()

    pendingInputRef.current = input.trim()
    pendingEvidenceRef.current = evidenceItem
    prevLastPlayerTextRef.current = lastPlayerText

    setInput('')
    setSelectedEvidence(null)
    setUnlockNotice(null)
    setLastPlayerText(displayText)

    const playerMsg: Message = {
      role: 'player',
      text: displayText,
      presentedItemId: evidenceItem?.id,
    }
    setMessages((prev) => [...prev, playerMsg])
    setLoading(true)
    const requestId = ++requestIdRef.current
    fetchReply(displayText, requestId)
  }

  // Backs out of a send while the reply is still loading — the backend call
  // itself keeps running (see fetchReply's requestId check), but the pending
  // question is pulled back out of the chat and the input/evidence chip are
  // restored so a mistaken send can be corrected without losing it.
  const cancelSend = () => {
    if (!loading) return
    requestIdRef.current++
    setLoading(false)
    setMessages(prev => prev.slice(0, -1))
    setLastPlayerText(prevLastPlayerTextRef.current)
    setInput(pendingInputRef.current)
    setSelectedEvidence(pendingEvidenceRef.current)
  }

  const handleSelectEvidence = (itemId: string) => {
    const item = items.find((i) => i.id === itemId)
    if (!item) return
    setSelectedEvidence(item)
    setShowEvidencePanel(false)
  }

  const isEmpty = !currentSuspectMsg && !loading

  const suspectLocation = allLocations.find(l => l.suspects.includes(id ?? ''))
  const bgLocationId = suspectLocation?.id ?? id ?? ''
  const bgUrl = locationBg(bgLocationId)

  return (
    <div className="interrogation-page">
      {/* 背景レイヤー */}
      {bgUrl && <div className="interro-bg" style={{ backgroundImage: `url(${bgUrl})` }} />}
      <div className="interro-overlay" />

      {showIndictFlash && (
        <div className="indict-flash">
          <span>⚖️ {tt('起訴！', 'Indictment!')}</span>
        </div>
      )}

      <div className="interrogation-header">
        <button className="back-btn" onClick={() => navigate(-1)}>← {tt('戻る', 'Back')}</button>
        <span className="header-title">{suspect.name}</span>
        <div className="header-actions">
          <button
            className={`log-btn${showLog ? ' active' : ''}`}
            onClick={() => { setShowLog((v) => !v); setShowEvidencePanel(false) }}
            title={t('interro.log')}
          >
            {tt('ログ', 'Log')}
          </button>
          <NotebookLauncher className="interro-notebook-btn" />
        </div>
      </div>

      <div className="character-area">
        <div className="character-badge">
          <div className="character-avatar-display">{suspectAvatarEmoji(suspect.bio, suspect.id)}</div>
          <div className="character-name-display">{suspect.name}</div>
        </div>
      </div>

      <div
        className={`dialogue-box${isTyping ? ' typing' : ''}${isEmpty ? ' empty' : ''}`}
        onClick={skipTyping}
      >
        <div className="dialogue-box-scroll" ref={dialogueScrollRef}>
          {lastPlayerText && (
            <div className="player-line">
              {t('interro.detective')}：「{lastPlayerText}」
            </div>
          )}
          {isEmpty && <p className="dialogue-hint">{t('interro.hint')}</p>}
          {loading && !isTyping && (
            <div className="dialogue-loading-row">
              <p className="dialogue-typing-indicator">{t('interro.typing')}</p>
              <button
                className="dialogue-cancel-btn"
                onClick={(e) => { e.stopPropagation(); cancelSend() }}
                title={tt('送信を取り消す', 'Cancel this question')}
              >
                ✕ {tt('取り消す', 'Cancel')}
              </button>
            </div>
          )}
          {currentSuspectMsg && (
            <p className="dialogue-text">
              「{displayedText}
              {isTyping && <span className="cursor">|</span>}
              」
            </p>
          )}
        </div>
        {isTyping && (
          <span className="skip-hint">{t('interro.skip')}</span>
        )}
        {unlockNotice && !isTyping && (
          <div className="interro-unlock-notice">
            🗺️ {tt(`新しい場所が解放されました：${unlockNotice}`, `New area unlocked: ${unlockNotice}`)}
          </div>
        )}
      </div>

      {showEvidencePanel && (
        <div className="evidence-panel">
          <div className="evidence-panel-header">
            <span>{t('interro.panel')}</span>
            <button className="icon-btn-close" onClick={() => setShowEvidencePanel(false)}>✕</button>
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
                    {lang === 'en' && <span className="ep-detail">{item.detail}</span>}
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
              <button className="icon-btn-close" onClick={() => setShowLog(false)}>✕</button>
            </div>
            <div className="log-list">
              {messages.length === 0 && (
                <p className="log-empty">{tt('まだ会話がない', 'No messages yet')}</p>
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

      {interrogating ? (
        <button
          className="interro-accuse-btn return"
          onClick={stopInterrogating}
        >
          🔎 {tt('尋問に戻る', 'Back to questioning')}
        </button>
      ) : (
        <button
          className="interro-accuse-btn"
          onClick={startInterrogating}
        >
          {tt(`⚖️ ${suspect.name} を追及する`, `⚖️ Indict ${suspect.name}`)}
        </button>
      )}

      <div className="chat-input-area">
        {selectedEvidence && (
          <div className="selected-evidence-chip">
            <span>{selectedEvidence.emoji} {selectedEvidence.name}</span>
            <button
              className="icon-btn-close sm"
              onClick={() => setSelectedEvidence(null)}
              title={tt('証拠を外す', 'Remove evidence')}
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
            {tt('証拠', 'Evidence')}
          </button>
          <input
            className="chat-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
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
