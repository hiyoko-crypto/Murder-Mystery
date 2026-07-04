import type { Suspect, Item, Location } from '../../types'
import {
  locationData, itemData, suspectData, openingTextData,
  mockRepliesData, mockEvidenceRepliesData, confrontScriptData,
  type Lang,
} from './i18n'
import type { Emotion } from '../types'

/* 言語ごとにデータを返すヘルパー */
export function getLocations(lang: Lang): Location[] {
  return [
    { id: 'garden',   name: locationData.garden.name[lang],   description: locationData.garden.description[lang],   items: ['letter_opener', 'handkerchief'], suspects: [] },
    { id: 'ballroom', name: locationData.ballroom.name[lang], description: locationData.ballroom.description[lang], items: ['guest_list'],                    suspects: ['sophia', 'max'] },
    { id: 'study',    name: locationData.study.name[lang],    description: locationData.study.description[lang],    items: ['torn_note'],                     suspects: ['lucien'] },
  ]
}

export function getItems(lang: Lang): Item[] {
  return [
    {
      id: 'letter_opener', emoji: '🗡️', locationId: 'garden', found: false,
      name:          itemData.letter_opener.name[lang],
      detail:        itemData.letter_opener.detail[lang],
      discoveryText: itemData.letter_opener.discoveryText[lang],
    },
    {
      id: 'handkerchief', emoji: '🩸', locationId: 'garden', found: false, requiresItems: ['letter_opener'],
      name:          itemData.handkerchief.name[lang],
      detail:        itemData.handkerchief.detail[lang],
      discoveryText: itemData.handkerchief.discoveryText[lang],
    },
    {
      id: 'guest_list', emoji: '📋', locationId: 'ballroom', found: false,
      name:          itemData.guest_list.name[lang],
      detail:        itemData.guest_list.detail[lang],
      discoveryText: itemData.guest_list.discoveryText[lang],
    },
    {
      id: 'torn_note', emoji: '📝', locationId: 'study', found: false, requiresItems: ['handkerchief'],
      name:          itemData.torn_note.name[lang],
      detail:        itemData.torn_note.detail[lang],
      discoveryText: itemData.torn_note.discoveryText[lang],
    },
  ]
}

export function getSuspects(lang: Lang): Suspect[] {
  return [
    { id: 'lucien', name: suspectData.lucien.name, emotion: 'neutral', bio: suspectData.lucien.bio[lang], guilty: true },
    { id: 'sophia', name: suspectData.sophia.name, emotion: 'sad',     bio: suspectData.sophia.bio[lang], guilty: false },
    { id: 'max',    name: suspectData.max.name,    emotion: 'neutral', bio: suspectData.max.bio[lang],    guilty: false },
  ]
}

export function getMockReplies(lang: Lang): Record<string, { text: string; emotion: Emotion }[]> {
  return Object.fromEntries(
    Object.entries(mockRepliesData).map(([id, data]) => [
      id,
      data.replies.map((r) => ({ text: r.text[lang], emotion: r.emotion as Emotion })),
    ])
  )
}

export function getMockEvidenceReplies(lang: Lang): Record<string, Record<string, { text: string; emotion: Emotion }>> {
  return Object.fromEntries(
    Object.entries(mockEvidenceRepliesData).map(([itemId, suspects]) => [
      itemId,
      Object.fromEntries(
        Object.entries(suspects).map(([sId, r]) => [sId, { text: r.text[lang], emotion: r.emotion as Emotion }])
      ),
    ])
  )
}

export function getConfrontScript(lang: Lang) {
  return Object.fromEntries(
    Object.entries(confrontScriptData).map(([id, s]) => [
      id,
      {
        opening:         s.opening[lang],
        openingEmotion:  s.openingEmotion as Emotion,
        denials:         s.denials.map((d) => ({ text: d.text[lang], emotion: d.emotion as Emotion })),
        keyEvidence:     Object.fromEntries(
          Object.entries(s.keyEvidence).map(([k, v]) => [k, { text: v.text[lang], emotion: v.emotion as Emotion }])
        ),
        confession:      s.confession[lang],
        wrongAccusation: s.wrongAccusation[lang],
        cutoff:          s.cutoff[lang],
      },
    ])
  )
}

export function getOpeningText(lang: Lang): string {
  return openingTextData[lang]
}

/* 後方互換（言語未指定 → 日本語） */
export const suspects     = getSuspects('ja')
export const items        = getItems('ja')
export const locations    = getLocations('ja')
export const mockReplies  = getMockReplies('ja')
export const mockEvidenceReplies = getMockEvidenceReplies('ja')
export const openingText  = getOpeningText('ja')
