import { useCaseNotes } from '../../contexts/CaseNotesContext'
import { useLanguage } from '../../contexts/LanguageContext'
import CaseNotebookModal from './CaseNotebookModal'

export default function NotebookLauncher({ className }: { className?: string }) {
  const { lang } = useLanguage()
  const { isNotebookOpen, openNotebook, closeNotebook } = useCaseNotes()

  return (
    <>
      <button
        className={className ? `notebook-btn ${className}` : 'notebook-btn'}
        onClick={openNotebook}
      >
        {lang === 'ja' ? '🗒 捜査ノート' : '🗒 Case Notebook'}
      </button>
      {isNotebookOpen && <CaseNotebookModal onClose={closeNotebook} />}
    </>
  )
}
