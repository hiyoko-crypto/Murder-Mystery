import { useParams, useNavigate } from 'react-router-dom'
import { items } from '../data/mockData'
import './ItemDetailPage.css'

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const item = items.find((i) => i.id === id)
  if (!item) return <div>アイテムが見つかりません</div>

  return (
    <div className="item-detail-page">
      <div className="item-detail-card">
        <div className="item-detail-emoji">{item.emoji}</div>
        <h2 className="item-detail-name">{item.name}</h2>
        <div className="item-detail-divider" />
        <p className="item-detail-text">{item.detail}</p>
        <div className="item-detail-badge">証拠カードに追加済み</div>
        <button className="back-btn" onClick={() => navigate(-1)}>
          戻る
        </button>
      </div>
    </div>
  )
}
