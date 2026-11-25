import { NotebookPen } from 'lucide-react'
import { useCaseNotes } from '../../contexts/CaseNotesContext'
import { useLanguage } from '../../contexts/LanguageContext'
import { GoldButton } from '../ui/Noir'
import CaseNotebookModal from './CaseNotebookModal'

/** "Case Notebook" button plus the modal it opens. */
export default function NotebookLauncher({ className }: { className?: string }) {
  const { tt } = useLanguage()
  const { isNotebookOpen, openNotebook, closeNotebook } = useCaseNotes()

  return (
    <>
      <GoldButton className={className} label={tt('捜査ノート', 'Case Notebook')} icon={<NotebookPen size={20} />} onClick={openNotebook} />
      {isNotebookOpen && <CaseNotebookModal onClose={closeNotebook} />}
    </>
  )
}
