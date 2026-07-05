import type { Emotion } from '../types'
import type { Lang } from '../i18n'

const emotionMap: Record<Emotion, Record<Lang, string>> = {
  neutral:   { ja: '😐 落ち着いている', en: '😐 Composed' },
  nervous:   { ja: '😟 不安そう',       en: '😟 Nervous' },
  angry:     { ja: '😠 怒っている',     en: '😠 Angry' },
  sad:       { ja: '😢 悲しんでいる',   en: '😢 Sad' },
  surprised: { ja: '😲 驚いている',     en: '😲 Surprised' },
  happy:     { ja: '😊 穏やか',         en: '😊 Calm' },
}

export function emotionLabel(emotion: Emotion, lang: Lang = 'ja'): string {
  return emotionMap[emotion]?.[lang] ?? '😐'
}
