import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import TitlePage from './pages/TitlePage'
import ScenarioSelectPage from './pages/ScenarioSelectPage'
import LanguageSelectPage from './pages/LanguageSelectPage'
import OpeningPage from './pages/OpeningPage'
import LocationPage from './pages/LocationPage'
import InterrogationPage from './pages/InterrogationPage'
import StyleGuidePage from './pages/StyleGuidePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TitlePage />} />
        <Route path="/scenario-select" element={<ScenarioSelectPage />} />
        <Route path="/language" element={<LanguageSelectPage />} />
        <Route path="/opening" element={<OpeningPage />} />
        <Route path="/location/:id" element={<LocationPage />} />
        <Route path="/interrogate/:id" element={<InterrogationPage />} />
        {import.meta.env.DEV && <Route path="/style-guide" element={<StyleGuidePage />} />}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
