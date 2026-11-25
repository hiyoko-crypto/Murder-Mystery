import { useLanguage } from '../contexts/LanguageContext'
import { GoldButton, Panel } from './ui/Noir'

interface Props {
  open: boolean
  resetting: boolean
  onCancel: () => void
  onConfirm: () => void
}

export default function ConfirmResetDialog({ open, resetting, onCancel, onConfirm }: Props) {
  const { tt } = useLanguage()
  if (!open) return null
  return (
    <div className="nr-scrim nr-dialog-scrim" onClick={onCancel}>
      <div onClick={e => e.stopPropagation()}>
        <Panel className="nr-dialog">
          <p className="nr-dialog__text">
            {tt('進行状況は保存されません。\nよろしいですか？', 'Your progress will not be saved.\nAre you sure?')}
          </p>
          <div className="nr-dialog__actions">
            <GoldButton size="sm" label={tt('キャンセル', 'Cancel')} onClick={onCancel} />
            <GoldButton
              size="sm"
              variant="primary"
              label={resetting ? tt('リセット中…', 'Resetting…') : tt('メニューへ戻る', 'Return to Menu')}
              onClick={onConfirm}
              disabled={resetting}
            />
          </div>
        </Panel>
      </div>
    </div>
  )
}
