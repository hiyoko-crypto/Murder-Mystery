import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import SoundToggle from '../SoundToggle'

/** Detective silhouette (fedora + coat) used next to the POIROT wordmark. */
export function DetectiveMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.2} viewBox="0 0 40 48" fill="currentColor" aria-hidden="true">
      <path d="M13 13 C13 7 16 5 20 5 C24 5 27 7 27 13 Z" />
      <ellipse cx="20" cy="13.5" rx="12.5" ry="2.2" />
      <path d="M15 15.5 C15 20.5 17 23.5 20 23.5 C23 23.5 25 20.5 25 15.5 Z" />
      <path d="M5 48 C5 36 10.5 29 17 26.5 L20 31 L23 26.5 C29.5 29 35 36 35 48 Z" />
    </svg>
  )
}

/** Head-and-shoulders silhouette used as a stand-in until 2D portraits exist. */
export function PortraitSilhouette({ height = 360 }: { height?: number }) {
  return (
    <svg height={height} viewBox="0 0 200 240" aria-hidden="true" className="nr-silhouette">
      <defs>
        <linearGradient id="nr-silhouette-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2016" />
          <stop offset="100%" stopColor="#0b0806" />
        </linearGradient>
      </defs>
      <path
        fill="url(#nr-silhouette-fill)"
        stroke="rgba(230, 198, 126, 0.45)"
        strokeWidth="1.5"
        d="M100 18 C124 18 140 38 140 64 C140 90 126 112 100 112 C74 112 60 90 60 64 C60 38 76 18 100 18 Z
           M100 122 C140 122 178 140 190 176 L198 240 L2 240 L10 176 C22 140 60 122 100 122 Z"
      />
    </svg>
  )
}

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span className="nr-logo">
      <DetectiveMark size={size} />
      <span className="nr-logo__word">POIROT</span>
    </span>
  )
}

/** Gold rule with a small diamond, used under headings and between sections. */
export function OrnamentDivider({ style }: { style?: CSSProperties }) {
  return (
    <div className="nr-divider" style={style} aria-hidden="true">
      <span className="nr-divider__line" />
      <span className="nr-divider__diamond" />
      <span className="nr-divider__line" />
    </div>
  )
}

/** Translucent dark panel with a double gold rule and L-shaped corners. */
export function Panel({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`nr-panel ${className}`} style={style}>
      <span className="nr-corner nr-corner--tl" />
      <span className="nr-corner nr-corner--tr" />
      <span className="nr-corner nr-corner--bl" />
      <span className="nr-corner nr-corner--br" />
      {children}
    </div>
  )
}

/** Japanese heading with an English sub-label, e.g. 事件ファイル / CASE FILE. */
export function SectionTitle({ ja, en, icon, divider = true }: { ja: string; en?: string; icon?: ReactNode; divider?: boolean }) {
  return (
    <div className="nr-section-title">
      <div className="nr-section-title__row">
        {icon && <span className="nr-section-title__icon">{icon}</span>}
        <span className="nr-section-title__ja">{ja}</span>
        {en && <span className="nr-section-title__en">{en}</span>}
      </div>
      {divider && <OrnamentDivider />}
    </div>
  )
}

// Japanese sub-labels skip the English letter-spaced caps styling.
// eslint-disable-next-line no-control-regex
const NON_ASCII = /[^\x00-\x7F]/

interface GoldButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: ReactNode
  /** Small sub-label under the label (English caps, or a Japanese hint). */
  sub?: string
  icon?: ReactNode
  chevron?: boolean
  size?: 'sm' | 'md' | 'lg'
  variant?: 'default' | 'primary' | 'danger' | 'paper' | 'teal'
}

export function GoldButton({ label, sub, icon, chevron, size = 'md', variant = 'default', className = '', type = 'button', ...rest }: GoldButtonProps) {
  const classes = ['nr-btn', size !== 'md' && `nr-btn--${size}`, variant !== 'default' && `nr-btn--${variant}`, className]
    .filter(Boolean)
    .join(' ')
  return (
    <button type={type} className={classes} {...rest}>
      {icon && <span className="nr-btn__icon">{icon}</span>}
      <span className="nr-btn__text">
        <span>{label}</span>
        {sub && <span className={NON_ASCII.test(sub) ? 'nr-btn__sub nr-btn__sub--ja' : 'nr-btn__sub'}>{sub}</span>}
      </span>
      {chevron && (
        <span className="nr-btn__chevron">
          <ChevronRight size={18} />
        </span>
      )}
    </button>
  )
}

/** Top bar: logo, current section, and optional controls on the right. */
export function AppHeader({ sectionJa, sectionEn, right }: { sectionJa?: string; sectionEn?: string; right?: ReactNode }) {
  return (
    <header className="nr-header">
      <Logo />
      {sectionJa && (
        <div className="nr-header__section">
          <span className="nr-section-title__ja">{sectionJa}</span>
          {sectionEn && <span className="nr-section-title__en">{sectionEn}</span>}
        </div>
      )}
      <div className="nr-header__right">
        {right}
        <SoundToggle />
      </div>
    </header>
  )
}

export function PaperCard({ children, className = '', style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`nr-paper ${className}`} style={style}>
      {children}
    </div>
  )
}

export function Polaroid({ src, alt, caption, tilt = -3, width = 220, height = 180 }: {
  src: string
  alt: string
  caption?: string
  tilt?: number
  width?: number
  height?: number
}) {
  return (
    <figure className="nr-polaroid" style={{ '--nr-tilt': `${tilt}deg`, width } as CSSProperties}>
      <div style={{ height }}>
        <img src={src} alt={alt} />
      </div>
      {caption && <figcaption className="nr-polaroid__caption">{caption}</figcaption>}
    </figure>
  )
}

export function Stamp({ children, tilt = -8, color }: { children: ReactNode; tilt?: number; color?: string }) {
  return (
    <span className="nr-stamp" style={{ '--nr-tilt': `${tilt}deg`, color } as CSSProperties}>
      {children}
    </span>
  )
}
