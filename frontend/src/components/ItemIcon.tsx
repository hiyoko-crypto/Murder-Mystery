import { itemImageUrl } from '../utils/itemImages'
import './ItemIcon.css'

/** A clue's picture, or its emoji while no art exists. Sized by the parent. */
export default function ItemIcon({ itemId, emoji, className = '' }: { itemId: string; emoji: string; className?: string }) {
  const src = itemImageUrl(itemId)
  return src
    ? <img src={src} alt="" className={`item-icon ${className}`} />
    : <span className={className}>{emoji}</span>
}
