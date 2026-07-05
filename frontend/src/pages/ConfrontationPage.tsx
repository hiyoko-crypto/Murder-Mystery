import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useGame } from '../contexts/GameContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useScenario } from '../contexts/ScenarioContext'
import { callIndict } from '../api/examine'
import './ConfrontationPage.css'

type Phase = 'confirm' | 'indicting' | 'confessed' | 'wrong'

export default function ConfrontationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { lang, t } = useLanguage()
  const { suspects: getSuspects, items: getItems } = useScenario()
  const { foundItems } = useGame()

  const suspects = getSuspects(lang)
  const items    = getItems(lang)
  const suspect  = suspects.find((s) => s.id === id)

  const [phase, setPhase] = useState<Phase>('confirm')
  const [indictResult, setIndictResult] = useState<{ won: boolean; message: string } | null>(null)

  if (!suspect) return <div>{t('not.found')}</div>

  const foundEvidenceItems = items.filter((item) => foundItems.includes(item.id))

  const handleIndict = async () => {
    setPhase('indicting')
    const reason = foundEvidenceItems.map(i => i.name).join(', ')
      || (lang === 'ja' ? '証拠なし' : 'no evidence')
    try {
      const res = await callIndict(id!, reason, lang)
      setIndictResult({ won: res.won, message: res.message })
      setPhase(res.won ? 'confessed' : 'wrong')
    } catch {
      const errText = lang === 'ja'
        ? 'バックエンドに接続できませんでした。'
        : 'Could not connect to backend.'
      setIndictResult({ won: false, message: errText })
      setPhase('wrong')
    }
  }

  if (phase === 'indicting') {
    return (
      <div className="confrontation-page">
        <div className="ending correct">
          <p className="ending-label">{lang === 'ja' ? '判定中...' : 'Judging…'}</p>
        </div>
      </div>
    )
  }

  if (phase === 'confessed') {
    return (
      <div className="confrontation-page">
        <div className="ending correct">
          <p className="ending-label">{t('ending.confession')}</p>
          <p className="ending-name">{suspect.name}</p>
          <p className="ending-emotion">😨</p>
          <p className="ending-text" style={{ whiteSpace: 'pre-line' }}>
            {indictResult?.message ?? `${suspect.name} ${t('ending.confessed')}`}
          </p>
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
            {indictResult?.message ?? `${suspect.name} ${t('ending.innocent')}`}
          </p>
          <div className="ending-actions">
            <button className="ending-btn secondary" onClick={() => navigate(-1)}>{t('ending.reaccuse')}</button>
            <button className="ending-btn" onClick={() => navigate('/map')}>{t('ending.backinv')}</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="confrontation-page">
      <div className="confrontation-confirm">
        <div className="confrontation-header">
          <button className="back-btn" onClick={() => navigate(-1)}>{t('confront.back')}</button>
          <span className="confrontation-label">{t('confront.label')}</span>
          <div style={{ width: '60px' }} />
        </div>
        <div className="confront-confirm-body">
          <p className="confront-confirm-label">
            {lang === 'ja' ? '⚖️ 告発' : '⚖️ Accusation'}
          </p>
          <p className="confront-confirm-suspect">{suspect.name}</p>
          <p className="confront-confirm-question">
            {lang === 'ja'
              ? `${suspect.name} が犯人だと確信していますか？`
              : `Are you certain ${suspect.name} is the killer?`}
          </p>
          {foundEvidenceItems.length > 0 && (
            <div className="confront-confirm-evidence">
              <p className="confront-evidence-label">
                {lang === 'ja' ? '提示する証拠：' : 'Evidence presented:'}
              </p>
              <ul className="confront-evidence-list">
                {foundEvidenceItems.map(item => (
                  <li key={item.id}>{item.emoji} {item.name}</li>
                ))}
              </ul>
            </div>
          )}
          <button className="confront-indict-btn" onClick={handleIndict}>
            {lang === 'ja' ? `⚖️ ${suspect.name} を起訴する` : `⚖️ Indict ${suspect.name}`}
          </button>
        </div>
      </div>
    </div>
  )
}
