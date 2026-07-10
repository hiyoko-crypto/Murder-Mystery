import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import TitlePage from './pages/TitlePage'
import ScenarioSelectPage from './pages/ScenarioSelectPage'
import LanguageSelectPage from './pages/LanguageSelectPage'
import OpeningPage from './pages/OpeningPage'
import MapPage from './pages/MapPage'
import LocationPage from './pages/LocationPage'
import ItemDetailPage from './pages/ItemDetailPage'
import InterrogationPage from './pages/InterrogationPage'
import EvidencePage from './pages/EvidencePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TitlePage />} />
        <Route path="/scenario-select" element={<ScenarioSelectPage />} />
        <Route path="/language" element={<LanguageSelectPage />} />
        <Route path="/opening" element={<OpeningPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/location/:id" element={<LocationPage />} />
        <Route path="/item/:id" element={<ItemDetailPage />} />
        <Route path="/interrogate/:id" element={<InterrogationPage />} />
        <Route path="/evidence" element={<EvidencePage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
