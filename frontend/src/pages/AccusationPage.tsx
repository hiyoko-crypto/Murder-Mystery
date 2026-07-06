import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import { useScenario } from '../contexts/ScenarioContext'
import { emotionLabel } from '../utils/emotion'
import './AccusationPage.css'

export default function AccusationPage() {
  const navigate = useNavigate()
  const { lang, t } = useLanguage()
  const { suspects: getSuspects } = useScenario()
  const suspects = getSuspects(lang)

  return (
    <div className="accusation-page">
      <div className="accusation-header">
        <button className="back-btn" onClick={() => navigate('/map')}>{t('back')}</button>
        <h2 className="accusation-title">{t('accuse.title')}</h2>
      </div>
      <p className="accusation-hint">{t('accuse.subtitle')}</p>
      <div className="suspect-list">
        {suspects.map((s) => (
          <button
            key={s.id}
            className="accuse-btn"
            onClick={() => navigate(`/confront/${s.id}`)}
          >
            <div className="accuse-info">
              <span className="accuse-name">{s.name}</span>
              <span className="accuse-bio">{s.bio}</span>
            </div>
            <span className="accuse-emotion">{emotionLabel(s.emotion)}</span>
          </button>
        ))}
      </div>
      <p className="accusation-warning">
        {lang === 'ja' ? '※ 告発すると対決が始まります' : '※ Confrontation begins upon accusation'}
      </p>
    </div>
  )
}
