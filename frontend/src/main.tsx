import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { LanguageProvider } from './contexts/LanguageContext'
import { ScenarioProvider } from './contexts/ScenarioContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <LanguageProvider>
      <ScenarioProvider>
        <App />
      </ScenarioProvider>
    </LanguageProvider>
  </StrictMode>,
)
