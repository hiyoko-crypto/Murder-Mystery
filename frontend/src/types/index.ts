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
  discoveryText: string  // 発見時に表示されるテキスト
  detail: string
  locationId: string
  found: boolean
  requiresItems?: string[]  // 発見に必要な先行アイテムID
}

export interface Location {
  id: string
  name: string
  description: string
  items: string[]      // item ids
  suspects: string[]   // suspect ids
}

export interface Message {
  role: 'player' | 'suspect'
  text: string
  emotion?: Emotion
  presentedItemId?: string  // 証拠提示の場合にセット
}
