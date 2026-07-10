import { useScenario } from '../contexts/ScenarioContext'
import './BgCredit.css'

/** Unobtrusive "Photo by X on Unsplash" corner credit text.
 * `className` lets each page nudge the vertical position to clear its own
 * bottom UI (menu panel, chat input, etc.) instead of sitting behind it. */
export default function BgCredit({ locationId, className }: { locationId: string; className?: string }) {
  const { locationBgCredit } = useScenario()
  const credit = locationBgCredit(locationId)
  if (!credit) return null

  return (
    <span className={className ? `bg-credit ${className}` : 'bg-credit'}>
      Photo: {credit.name} / Unsplash
    </span>
  )
}
