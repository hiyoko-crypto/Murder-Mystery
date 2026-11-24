import { NotebookPen } from 'lucide-react'
import { useCaseNotes } from '../../contexts/CaseNotesContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { GoldButton } from '../ui/Noir'
import CaseNotebookModal from './CaseNotebookModal'

/** "Case Notebook" button plus the modal it opens. `variant="noir"` renders
 *  the redesigned gold button; the default keeps the old style for pages that
 *  have not been redesigned yet. */
export default function NotebookLauncher({ className, variant = 'classic' }: { className?: string; variant?: 'classic' | 'noir' }) {
  const { lang } = useLanguage()
  const { isNotebookOpen, openNotebook, closeNotebook } = useCaseNotes()
  const label = lang === 'ja' ? '捜査ノート' : 'Case Notebook'

  return (
    <>
      {variant === 'noir' ? (
        <GoldButton className={className} label={label} icon={<NotebookPen size={20} />} onClick={openNotebook} />
      ) : (
        <button
          className={className ? `notebook-btn ${className}` : 'notebook-btn'}
          onClick={openNotebook}
        >
          🗒 {label}
        </button>
      )}
      {isNotebookOpen && <CaseNotebookModal onClose={closeNotebook} />}
    </>
  )
}
