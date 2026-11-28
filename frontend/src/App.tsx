import { lazy, Suspense } from 'react'
import AiStatusBanner from './components/AiStatusBanner'
import SceneTransition from './components/SceneTransition'
import GlobalSfx from './components/GlobalSfx'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import TitlePage from './pages/TitlePage'
import ScenarioSelectPage from './pages/ScenarioSelectPage'
import OpeningPage from './pages/OpeningPage'
import LocationPage from './pages/LocationPage'
import InterrogationPage from './pages/InterrogationPage'

// Dev-only preview page; the import is dropped from production builds.
const StyleGuidePage = import.meta.env.DEV ? lazy(() => import('./pages/StyleGuidePage')) : null

export default function App() {
  return (
    <BrowserRouter>
      <AiStatusBanner />
      <GlobalSfx />
      <SceneTransition>
      <Routes>
        <Route path="/" element={<TitlePage />} />
        <Route path="/scenario-select" element={<ScenarioSelectPage />} />
        <Route path="/opening" element={<OpeningPage />} />
        <Route path="/location/:id" element={<LocationPage />} />
        <Route path="/interrogate/:id" element={<InterrogationPage />} />
        {StyleGuidePage && <Route path="/style-guide" element={<Suspense><StyleGuidePage /></Suspense>} />}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      </SceneTransition>
    </BrowserRouter>
  )
}
