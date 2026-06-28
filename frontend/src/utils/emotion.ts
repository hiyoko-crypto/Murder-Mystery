import type { Emotion } from '../types'

const emotionMap: Record<Emotion, string> = {
  neutral: '😐 落ち着いている',
  nervous: '😟 不安そう',
  angry: '😠 怒っている',
  sad: '😢 悲しんでいる',
  surprised: '😲 驚いている',
  happy: '😊 穏やか',
}

export function emotionLabel(emotion: Emotion): string {
  return emotionMap[emotion] ?? '😐'
}
