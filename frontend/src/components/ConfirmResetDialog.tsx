import { useLanguage } from '../contexts/LanguageContext'

interface Props {
  open: boolean
  resetting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function ConfirmResetDialog({ open, resetting, onCancel, onConfirm }: Props) {
  const { lang } = useLanguage()
  if (!open) return null
  return (
    <div className="confirm-overlay" onClick={onCancel}>
      <div className="confirm-dialog" onClick={e => e.stopPropagation()}>
        <p>
          {lang === 'ja'
            ? '進行状況は保存されません。\nよろしいですか？'
            : 'Your progress will not be saved.\nAre you sure?'}
        </p>
        <div className="confirm-actions">
          <button className="confirm-cancel-btn" onClick={onCancel}>
            {lang === 'ja' ? 'キャンセル' : 'Cancel'}
          </button>
          <button className="confirm-ok-btn" onClick={onConfirm} disabled={resetting}>
            {resetting
              ? (lang === 'ja' ? 'リセット中...' : 'Resetting...')
              : (lang === 'ja' ? 'メニューへ戻る' : 'Return to Menu')}
          </button>
        </div>
      </div>
    </div>
  )
}
