export type Emotion = 'neutral' | 'nervous' | 'angry' | 'sad' | 'surprised' | 'happy'

export interface Suspect {
  id: string
  name: string
  emotion: Emotion
  bio: string
  guilty: boolean
}

export interface Item {
  id: string
  name: string
  emoji: string
  discoveryText: string
  detail: string
}

export interface Location {
  id: string
  name: string
  description: string
  suspects: string[]   // suspect ids
}

export interface Message {
  role: 'player' | 'suspect' | 'system'
  text: string
  emotion?: Emotion
  presentedItemId?: string  // 証拠提示の場合にセット
}
