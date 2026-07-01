import { useNavigate } from 'react-router-dom'
import { useGameState } from '../hooks/useGameState'
import { useLanguage } from '../contexts/LanguageContext'
import { useScenario } from '../contexts/ScenarioContext'
import './MapPage.css'

export default function MapPage() {
  const navigate = useNavigate()
  const { evidence, unlockedLocations } = useGameState()
  const { lang, t } = useLanguage()
  const { locations: getLocations, locationBg, examineRules } = useScenario()
  const allLocations = getLocations(lang)
  // If examineRules exist, show only unlocked locations; else show all (mock data fallback)
  const locations = examineRules
    ? allLocations.filter(l => unlockedLocations.includes(l.id))
    : allLocations

  return (
    <div className="map-page">
      <h2 className="map-title">{t('map.title')}</h2>
      <div className="location-list">
        {locations.map((loc) => (
          <button
            key={loc.id}
            className="location-btn"
            style={{ backgroundImage: `url(${locationBg(loc.id)})` }}
            onClick={() => navigate(`/location/${loc.id}`)}
          >
            <div className="location-btn-inner">
              <span className="location-name">{loc.name}</span>
              <span className="location-desc">{loc.description}</span>
            </div>
          </button>
        ))}
      </div>
      <div className="evidence-bar">
        <span>{t('map.evidence')}: {evidence.length}{t('map.evidenceUnit') ? ` ${t('map.evidenceUnit')}` : ''}</span>
        <button className="evidence-btn" onClick={() => navigate('/evidence')}>
          {t('map.viewEvidence')}
        </button>
      </div>
    </div>
  )
}
