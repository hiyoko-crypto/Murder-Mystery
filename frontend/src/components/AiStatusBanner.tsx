import { TriangleAlert } from 'lucide-react'
import { useLanguage } from '../contexts/LanguageContext'
import { useOllamaStatus } from '../hooks/useOllamaStatus'
import './AiStatusBanner.css'

/** Slim warning bar shown while the local LLM server (Ollama) is unreachable. */
export default function AiStatusBanner() {
  const { tt } = useLanguage()
  const up = useOllamaStatus()
  if (up !== false) return null

  return (
    <div className="ai-banner" role="alert">
      <TriangleAlert size={18} />
      <span>
        {tt(
          'AI（Ollama）が応答していません。会話・調査・追及が止まります。Ollama を起動してください。',
          'The AI server (Ollama) is not responding, so conversations and investigation will stall. Please start Ollama.',
        )}
      </span>
    </div>
  )
}
