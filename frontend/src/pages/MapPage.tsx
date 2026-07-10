import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useGame } from '../contexts/GameContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useScenario } from '../contexts/ScenarioContext'
import ConfirmResetDialog from '../components/ConfirmResetDialog'
import NotebookLauncher from '../components/notebook/NotebookLauncher'
import './MapPage.css'

export default function MapPage() {
  const navigate = useNavigate()
  const { foundItems, unlockedLocations, resetGame } = useGame()
  const { lang, t } = useLanguage()
  const { locations: getLocations, locationBg } = useScenario()
  const locations = getLocations(lang).filter(l => unlockedLocations.includes(l.id))
  const unit = t('map.evidenceUnit')

  const [showConfirm, setShowConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)

  const handleConfirmReturn = async () => {
    setResetting(true)
    await resetGame()
    navigate('/')
  }

  return (
    <div className="map-page">
      <div className="map-header">
        <button className="map-menu-btn" onClick={() => setShowConfirm(true)}>
          {lang === 'ja' ? 'メインメニューに戻る' : 'Return to Main Menu'}
        </button>
        <h2 className="map-title">{t('map.title')}</h2>
        <NotebookLauncher />
      </div>
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
        <span>{t('map.evidence')}: {foundItems.length}{unit ? ` ${unit}` : ''}</span>
        <button className="evidence-btn" onClick={() => navigate('/evidence')}>
          {t('map.viewEvidence')}
        </button>
      </div>

      <ConfirmResetDialog
        open={showConfirm}
        resetting={resetting}
        onCancel={() => setShowConfirm(false)}
        onConfirm={handleConfirmReturn}
      />
    </div>
  )
}
