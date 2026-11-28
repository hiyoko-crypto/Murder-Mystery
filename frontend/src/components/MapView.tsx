import { MapPin, Lock } from 'lucide-react'
import mapsData from '../data/maps.json'
import { useLanguage } from '../contexts/LanguageContext'
import { thumbnailUrl } from '../utils/backgroundMatch'
import type { Location } from '../types'
import './MapView.css'

// Map art lives in src/assets/maps/<scenarioId>.(webp|png|jpg), drawn without labels;
// the clickable places and their names are overlaid from data/maps.json.
const mapFiles = import.meta.glob('../assets/maps/*', { eager: true, import: 'default' }) as Record<string, string>

function mapImage(scenarioId: string): string | undefined {
  return Object.entries(mapFiles).find(([path]) => path.includes(`/${scenarioId}.`))?.[1]
}

interface Spot { x: number; y: number }

interface Props {
  scenarioId: string
  locations: Location[]
  unlocked: string[]
  currentId: string
  locationBg: (locationId: string) => string
  onGo: (locationId: string) => void
}

/** The map: the scenario's illustrated plan with its places as buttons. Until the
 *  art exists for a scenario, the unlocked places are shown as photo cards instead. */
export default function MapView({ scenarioId, locations, unlocked, currentId, locationBg, onGo }: Props) {
  const { tt } = useLanguage()
  const spots = (mapsData as Record<string, Record<string, Spot>>)[scenarioId] ?? {}
  const image = mapImage(scenarioId)
  const placed = locations.filter(l => spots[l.id])

  if (!image || placed.length === 0) {
    return (
      <div className="loc__cards">
        {locations.filter(l => unlocked.includes(l.id)).map(loc => {
          const isCurrent = loc.id === currentId
          return (
            <button
              key={loc.id}
              className={`loc-card loc-card--map${isCurrent ? ' is-current' : ''}`}
              onClick={() => onGo(loc.id)}
              disabled={isCurrent}
            >
              <span className="loc-card__img" style={{ backgroundImage: `url(${thumbnailUrl(locationBg(loc.id))})` }}>
                {isCurrent && <span className="loc-card__here">{tt('現在地', 'Here')}</span>}
              </span>
              <span className="loc-card__name">{loc.name}</span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="map-view" style={{ backgroundImage: `url(${image})` }}>
      {placed.map(loc => {
        const open = unlocked.includes(loc.id)
        const here = loc.id === currentId
        return (
          <button
            key={loc.id}
            className={`map-spot${here ? ' is-here' : ''}${open ? '' : ' is-locked'}`}
            style={{ left: `${spots[loc.id].x}%`, top: `${spots[loc.id].y}%` }}
            onClick={() => onGo(loc.id)}
            disabled={!open || here}
            title={open ? loc.name : tt('まだ行けない場所', 'Not yet reachable')}
          >
            <span className="map-spot__pin">{open ? <MapPin size={26} /> : <Lock size={20} />}</span>
            <span className="map-spot__label">
              {open ? loc.name : '？？？'}
              {here && <em>{tt('現在地', 'Here')}</em>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
