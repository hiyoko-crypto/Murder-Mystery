import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LanguageProvider } from './contexts/LanguageContext'
import { ScenarioProvider } from './contexts/ScenarioContext'
import { CaseNotesProvider } from './contexts/CaseNotesContext'
import { GameProvider } from './contexts/GameContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <ScenarioProvider>
        <CaseNotesProvider>
          <GameProvider>
            <App />
          </GameProvider>
        </CaseNotesProvider>
      </ScenarioProvider>
    </LanguageProvider>
  </StrictMode>,
)
