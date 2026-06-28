import { useNavigate } from 'react-router-dom'
import { getLocations } from '../data/mockData'
import { useGameState } from '../hooks/useGameState'
import { useLanguage } from '../contexts/LanguageContext'
import './MapPage.css'

const locationBg: Record<string, string> = {
  garden:  'https://images.unsplash.com/photo-1723053140058-7aa2e74ac794?q=80&w=1470&auto=format&fit=crop',
  ballroom:'https://images.unsplash.com/photo-1780383908348-66fe35ee95cf?w=1200&q=80',
  study:   'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?q=80&w=928&auto=format&fit=crop',
}

export default function MapPage() {
  const navigate = useNavigate()
  const { evidence } = useGameState()
  const { lang, t } = useLanguage()
  const locations = getLocations(lang)

  return (
    <div className="map-page">
      <h2 className="map-title">{t('map.title')}</h2>
      <div className="location-list">
        {locations.map((loc) => (
          <button
            key={loc.id}
            className="location-btn"
            style={{ backgroundImage: locationBg[loc.id] ? `url(${locationBg[loc.id]})` : undefined }}
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
