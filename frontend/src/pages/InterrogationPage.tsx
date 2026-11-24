import { useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame } from '../contexts/GameContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useScenario } from '../contexts/ScenarioContext'
import { useCaseNotes } from '../contexts/CaseNotesContext'
import { sendChat } from '../api/chat'
import { callIndict } from '../api/examine'
import { ArrowLeft, ChevronDown, ChevronUp, Gavel, Lock, Plus, Search, Send, X } from 'lucide-react'
import NotebookLauncher from '../components/notebook/NotebookLauncher'
import { AppHeader, DetectiveMark, GoldButton, OrnamentDivider, Panel, PaperCard, PortraitSilhouette } from '../components/ui/Noir'
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
  const [showLog, setShowLog] = useState(true)
  const [selectedEvidence, setSelectedEvidence] = useState<typeof items[0] | null>(null)

  const [displayedText, setDisplayedText] = useState('')
  const [currentSuspectMsg, setCurrentSuspectMsg] = useState<Message | null>(null)
  const [isTyping, setIsTyping] = useState(false)
  const [lastPlayerText, setLastPlayerText] = useState('')
  const [unlockNotice, setUnlockNotice] = useState<{ id: string; name: string } | null>(null)
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

  const suspectLocation = allLocations.find(l => l.suspects.includes(id ?? ''))
  const bgLocationId = suspectLocation?.id ?? id ?? ''
  const bgUrl = locationBg(bgLocationId)

  if (indictResult) {
    return (
      <div className="noir">
        <div className="nr-scene iv-ending" style={{ backgroundImage: `url(${bgUrl})` }}>
          <AppHeader sectionJa={tt('結末', 'Ending')} sectionEn={lang === 'ja' ? 'Ending' : undefined} />
          <div className="iv-ending__body">
            <div className="iv-ending__headline">
              <h1 className="nr-gold-text">{tt('事件解決', 'Case Solved')}</h1>
              <div className="iv-ending__sub">— CASE SOLVED —</div>
              <OrnamentDivider style={{ width: 320, margin: '10px 0 0' }} />
              <p className="iv-ending__label">
                <span>{t('ending.confession')}</span>
                <span>{suspect.name}</span>
              </p>
            </div>
            <PaperCard className="iv-ending__paper">
              <div className="iv-ending__masthead">The Daily Chronicle</div>
              <div className="iv-ending__news">MURDER CASE SOLVED</div>
              <OrnamentDivider />
              <p className="iv-ending__truth">{indictResult.message}</p>
            </PaperCard>
          </div>
          <div className="iv-ending__actions">
            <GoldButton size="lg" variant="primary" label={t('ending.toTitle')} chevron onClick={() => navigate('/')} />
          </div>
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
        setUnlockNotice({ id: res.unlocked_location, name: locName })
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
  const inputDisabled = loading || isTyping

  return (
    <div className="noir">
      <div
        className={`nr-scene iv${interrogating ? ' is-accusing' : ''}`}
        style={{ backgroundImage: `url(${bgUrl})` }}
      >
        {showIndictFlash && (
          <div className="iv-flash">
            <span className="nr-gold-text">{tt('犯人はあなただ', "J'accuse!")}</span>
          </div>
        )}

        <AppHeader
          sectionJa={interrogating ? tt('追及', 'Accusation') : tt('尋問', 'Interrogation')}
          sectionEn={lang === 'ja' ? (interrogating ? 'Accusation' : 'Interrogation') : undefined}
          right={
            <>
              <GoldButton size="sm" label={tt('戻る', 'Back')} icon={<ArrowLeft size={16} />} onClick={() => navigate(-1)} />
              <NotebookLauncher variant="noir" className="nr-btn--sm" />
            </>
          }
        />

        <div className="iv__body">
          {/* ── Left: character + dialogue ── */}
          <section className="iv__stage">
            {interrogating && (
              <div className="iv__accuse-title">
                <span className="nr-gold-text">{tt('犯人はあなただ', 'You are the culprit')}</span>
                <span className="iv__accuse-name">— {suspect.name} —</span>
              </div>
            )}

            {/* Portrait slot: swap the emoji for a 2D portrait once the art exists. */}
            <div className="iv__portrait" aria-hidden="true">
              <PortraitSilhouette height={420} />
            </div>

            <div className="iv__nameplate">{suspect.name}</div>

            <Panel className={`iv__dialogue${isTyping ? ' is-typing' : ''}`}>
              <div className="iv__dialogue-scroll" ref={dialogueScrollRef} onClick={skipTyping}>
                {lastPlayerText && (
                  <p className="iv__player-line">{t('interro.detective')}：「{lastPlayerText}」</p>
                )}
                {isEmpty && <p className="iv__hint">{t('interro.hint')}</p>}
                {loading && !isTyping && (
                  <div className="iv__loading">
                    <span className="iv__typing-dots">{t('interro.typing')}</span>
                    <button className="iv__cancel" onClick={(e) => { e.stopPropagation(); cancelSend() }}>
                      <X size={14} /> {tt('取り消す', 'Cancel')}
                    </button>
                  </div>
                )}
                {currentSuspectMsg && (
                  <p className="iv__line">
                    「{displayedText}
                    {isTyping && <span className="iv__cursor">|</span>}
                    」
                  </p>
                )}
              </div>
              {isTyping && <span className="iv__skip">{t('interro.skip')}</span>}
            </Panel>

            {unlockNotice && !isTyping && (
              <Panel className="iv__unlock">
                <Lock size={20} className="iv__unlock-icon" />
                <span>{tt(`新しい場所が解放されました：${unlockNotice.name}`, `New area unlocked: ${unlockNotice.name}`)}</span>
                <GoldButton size="sm" label={tt('移動する', 'Go there')} chevron onClick={() => navigate(`/location/${unlockNotice.id}`)} />
              </Panel>
            )}
          </section>

          {/* ── Right: log, evidence, input ── */}
          <Panel className="iv__side">
            <button className="iv__side-head" onClick={() => setShowLog(v => !v)}>
              <span className="nr-section-title__ja">{t('interro.log')}</span>
              {showLog ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {showLog && (
              <div className="iv__log">
                {messages.length === 0 && <p className="iv__muted">{tt('まだ会話がない', 'No messages yet')}</p>}
                {messages.map((msg, i) => (
                  msg.role === 'system' ? (
                    <p key={i} className="iv__log-system">{msg.text}</p>
                  ) : (
                    <div key={i} className={`iv__log-entry is-${msg.role}`}>
                      <span className="iv__log-avatar">
                        {msg.role === 'player' ? <DetectiveMark size={18} /> : suspect.name.charAt(0)}
                      </span>
                      <div>
                        <span className="iv__log-role">{msg.role === 'player' ? t('interro.detective') : suspect.name}</span>
                        <p>{msg.presentedItemId ? `${t('interro.present.fmt')}${msg.text}` : msg.text}</p>
                      </div>
                    </div>
                  )
                ))}
                <div ref={logEndRef} />
              </div>
            )}

            <div className="iv__evidence">
              <button
                className="iv__side-head"
                onClick={() => setShowEvidencePanel(v => !v)}
                disabled={inputDisabled}
              >
                <span className="nr-section-title__ja">{t('interro.panel')}</span>
                {showEvidencePanel ? <ChevronUp size={18} /> : <Plus size={18} />}
              </button>
              {showEvidencePanel && (
                foundEvidenceItems.length === 0 ? (
                  <p className="iv__muted">{t('interro.noevidence')}</p>
                ) : (
                  <div className="iv__evidence-grid">
                    {foundEvidenceItems.map((item) => (
                      <button
                        key={item.id}
                        className={`iv__evidence-item${selectedEvidence?.id === item.id ? ' is-selected' : ''}`}
                        onClick={() => handleSelectEvidence(item.id)}
                        title={item.name}
                      >
                        <span className="iv__evidence-thumb">{item.emoji}</span>
                        <span className="iv__evidence-name">{item.name}</span>
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>

            {selectedEvidence && (
              <div className="iv__chip">
                <span>{selectedEvidence.emoji} {selectedEvidence.name}</span>
                <button onClick={() => setSelectedEvidence(null)} title={tt('証拠を外す', 'Remove evidence')}>
                  <X size={14} />
                </button>
              </div>
            )}

            <div className="iv__input-row">
              <input
                className="iv__input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && handleSend()}
                placeholder={
                  selectedEvidence
                    ? t('interro.comment')
                    : interrogating ? tt('あなたの推理を入力…', 'State your reasoning…') : t('interro.question')
                }
                disabled={inputDisabled}
                autoFocus
              />
              <button
                className="iv__send"
                onClick={handleSend}
                disabled={inputDisabled || (!input.trim() && !selectedEvidence)}
                title={interrogating ? tt('推理を突きつける', 'Press your case') : t('interro.send')}
              >
                <Send size={18} />
              </button>
            </div>

            {interrogating ? (
              <GoldButton label={tt('尋問に戻る', 'Back to questioning')} icon={<Search size={18} />} onClick={stopInterrogating} />
            ) : (
              <GoldButton
                variant="danger"
                label={tt(`${suspect.name} を追及する`, `Accuse ${suspect.name}`)}
                icon={<Gavel size={18} />}
                onClick={startInterrogating}
              />
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
