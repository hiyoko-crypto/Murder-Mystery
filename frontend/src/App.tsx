import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import TitlePage from './pages/TitlePage'
import OpeningPage from './pages/OpeningPage'
import MapPage from './pages/MapPage'
import LocationPage from './pages/LocationPage'
import ItemDetailPage from './pages/ItemDetailPage'
import InterrogationPage from './pages/InterrogationPage'
import EvidencePage from './pages/EvidencePage'
import AccusationPage from './pages/AccusationPage'
import ConfrontationPage from './pages/ConfrontationPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TitlePage />} />
        <Route path="/opening" element={<OpeningPage />} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/location/:id" element={<LocationPage />} />
        <Route path="/item/:id" element={<ItemDetailPage />} />
        <Route path="/interrogate/:id" element={<InterrogationPage />} />
        <Route path="/evidence" element={<EvidencePage />} />
        <Route path="/accuse" element={<AccusationPage />} />
        <Route path="/confront/:id" element={<ConfrontationPage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  )
}
