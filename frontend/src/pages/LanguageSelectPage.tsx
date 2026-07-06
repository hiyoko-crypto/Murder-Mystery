import { useNavigate } from 'react-router-dom'
import { useLanguage } from '../contexts/LanguageContext'
import './LanguageSelectPage.css'

export default function LanguageSelectPage() {
  const navigate = useNavigate()
  const { setLang } = useLanguage()

  const handleSelect = (lang: 'ja' | 'en') => {
    setLang(lang)
    navigate('/opening')
  }

  return (
    <div className="lang-select-page">
      <p className="lang-select-eyebrow">LANGUAGE / 言語</p>
      <div className="lang-select-row">
        <button className="lang-select-card" onClick={() => handleSelect('ja')}>
          <span className="lang-select-label">日本語</span>
          <span className="lang-select-sub">Japanese</span>
        </button>
        <div className="lang-select-divider" />
        <button className="lang-select-card" onClick={() => handleSelect('en')}>
          <span className="lang-select-label">English</span>
          <span className="lang-select-sub">英語</span>
        </button>
      </div>
      <button className="lang-select-back" onClick={() => navigate('/')}>← Back</button>
    </div>
  )
}
