import { FolderOpen } from 'lucide-react'
import type { BriefingResult } from '../api/examine'
import type { Lang } from '../i18n'
import { PaperCard, Polaroid } from './ui/Noir'
import './CaseFileCard.css'

/** Aged-paper dossier showing the case briefing. Used by the opening screen
 *  and the in-game "Case File" overlay. */
export default function CaseFileCard({ briefing, lang, photoUrl, photoCaption }: {
  briefing: BriefingResult
  lang: Lang
  photoUrl?: string
  photoCaption?: string
}) {
  const ja = lang === 'ja'
  const facts: [string, string][] = [
    [ja ? '被害者' : 'Victim', briefing.victim],
    [ja ? '死亡推定時刻' : 'Time of death', briefing.time_of_murder],
    [ja ? '発見時刻' : 'Discovered', briefing.time_discovered],
    [ja ? '凶器' : 'Weapon', briefing.weapon],
    [ja ? '現場' : 'Scene', briefing.scene],
  ]

  return (
    <PaperCard className="casefile">
      {photoUrl && (
        <div className="casefile__photo">
          <span className="casefile__clip" aria-hidden="true" />
          <Polaroid src={photoUrl} alt={photoCaption ?? briefing.scene} caption={photoCaption} tilt={-4} width={230} height={190} />
        </div>
      )}
      <div className="casefile__body">
        <div className="casefile__label">
          <FolderOpen size={18} />
          <span>{ja ? '事件ファイル' : 'Case File'}</span>
          {ja && <em>Case File</em>}
        </div>
        <h2 className="casefile__title">{briefing.title}</h2>
        <p className="casefile__setting">{briefing.setting}</p>
        <dl className="casefile__facts">
          {facts.map(([label, value]) => (
            <div key={label} className="casefile__fact">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>
      <span className="casefile__crime-stamp" aria-hidden="true">CRIME SCENE</span>
    </PaperCard>
  )
}
