const BASE = (import.meta as any).env?.VITE_API_URL ?? ''

export interface ApiSuspect {
  id: string
  name: string
  description: string
  alibi: string
  guilty: boolean
}

export interface ApiLocation {
  id: string
  name: string
  description: string
  suspects: string[]
}

export interface ApiItem {
  id: string
  name: string
  description: string
  emoji: string
  type: string
}

export interface ApiScenario {
  suspects: ApiSuspect[]
  locations: ApiLocation[]
  items: ApiItem[]
  victim: { id: string; name: string; description: string } | null
  displayNamesJa?: Record<string, string>
}

// Keyword → emoji table: first match wins, checked against lowercased (name + description)
const KEYWORD_EMOJI: Array<[string[], string]> = [
  [['candlestick', 'candle', '燭台', 'キャンドル'],            '🕯️'],
  [['knife', 'blade', 'dagger', '短剣', 'ナイフ'],            '🗡️'],
  [['sword', 'sabre', 'rapier', 'katana', '刀', '剣'],        '⚔️'],
  [['gun', 'pistol', 'revolver', 'firearm', '銃', 'ピストル'], '🔫'],
  [['poison', 'vial', 'flask', '毒', '毒薬'],                 '🧪'],
  [['bottle', 'glass', 'wine', 'whisky', 'whiskey', '瓶', 'ボトル', 'ワイン'], '🍾'],
  [['mirror', 'compact', '鏡', 'ミラー', 'コンパクト'],        '🪞'],
  [['key', '鍵', 'キー'],                                     '🗝️'],
  [['lock', 'locked', '錠', '施錠'],                          '🔒'],
  [['door', 'ドア', '扉'],                                    '🚪'],
  [['grate', 'vent', 'grille', 'shaft', '格子', '換気', 'ダクト'], '🔩'],
  [['rope', 'cord', 'wire', '縄', 'ロープ', 'ひも'],          '🪢'],
  [['letter', 'note', 'message', 'memo', '手紙', 'メモ', '書簡'], '📜'],
  [['paper', 'document', 'receipt', 'ticket', '書類', '紙', 'チケット'], '📄'],
  [['book', 'diary', 'journal', 'notebook', '日記', '本', 'ノート'], '📖'],
  [['photo', 'photograph', 'picture', 'image', '写真', '画像'], '📷'],
  [['ring', '指輪', 'リング'],                                '💍'],
  [['glove', '手袋', 'グローブ'],                             '🧤'],
  [['scarf', 'stole', 'スカーフ'],                            '🧣'],
  [['hat', 'cap', '帽子'],                                    '🎩'],
  [['blood', 'stain', '血', '染み'],                          '🩸'],
  [['wallet', 'purse', '財布'],                               '👛'],
  [['watch', 'clock', '時計', '懐中時計'],                    '⌚'],
  [['lighter', 'match', 'flame', 'fire', 'ライター', 'マッチ'], '🔥'],
  [['cigarette', 'cigar', 'tobacco', '煙草', 'タバコ'],       '🚬'],
  [['hammer', 'mallet', 'wrench', 'tool', 'ハンマー', '槌'],  '🔨'],
  [['bag', 'briefcase', 'suitcase', 'バッグ', 'カバン'],      '💼'],
  [['handkerchief', 'cloth', 'fabric', 'ハンカチ', '布'],     '🩲'],
  [['shoe', 'boot', 'footprint', '靴', '足跡'],               '👟'],
  [['phone', 'mobile', 'cell', '電話', 'スマホ'],             '📱'],
  [['computer', 'laptop', 'tablet', 'パソコン'],               '💻'],
  [['money', 'cash', 'coin', '金', '現金', 'コイン'],         '💰'],
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function emojiForItem(labels: string[], name: string, description: string): string {
  const text = `${name} ${description}`.toLowerCase()
  for (const [keywords, emoji] of KEYWORD_EMOJI) {
    if (keywords.some(kw => text.includes(kw.toLowerCase()))) return emoji
  }
  if (labels.includes('MurderWeapon')) return '⚔️'
  if (labels.includes('Evidence')) return '🔍'
  return '📦'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseKgFormat(raw: any): ApiScenario {
  const kg = raw.knowledge_graph
  const displayNamesJa: Record<string, string> = raw.display_names_ja ?? {}

  const nodeMap: Record<string, any> = {}
  for (const n of kg.nodes) nodeMap[n.id] = n

  const suspectNodes: any[] = kg.nodes.filter((n: any) => n.labels?.includes('Suspect'))
  const locationNodes: any[] = kg.nodes.filter((n: any) => n.labels?.includes('Location'))
  const itemNodes: any[] = kg.nodes.filter(
    (n: any) =>
      n.labels?.some((l: string) => ['Item', 'MurderWeapon', 'Evidence'].includes(l)) &&
      !n.labels?.includes('Location') &&
      !n.labels?.includes('Character'),
  )
  const victimNode = kg.nodes.find((n: any) => n.labels?.includes('Victim'))

  // Crime scene = first initially-available location
  const crimeSceneId =
    locationNodes.find((l: any) => l.properties?.initially_available)?.id ??
    locationNodes[0]?.id

  // Suspect → alibi location: HAS_ALIBI first, then WAS_IN
  // Build this BEFORE locSuspects so we can place suspects correctly
  const suspectAlibiLocation: Record<string, string> = {}
  for (const rel of ['HAS_ALIBI', 'WAS_IN']) {
    for (const edge of kg.edges) {
      if (edge.rel === rel && !suspectAlibiLocation[edge.from]) {
        const fromNode = nodeMap[edge.from]
        if (fromNode?.labels?.includes('Suspect')) {
          suspectAlibiLocation[edge.from] = edge.to
        }
      }
    }
  }

  // Place suspects at crime scene (always) AND their alibi location (for unlocked areas)
  const locSuspects: Record<string, string[]> = {}
  for (const l of locationNodes) {
    locSuspects[l.id] = []
  }
  for (const s of suspectNodes) {
    if (crimeSceneId && locSuspects[crimeSceneId] !== undefined) {
      locSuspects[crimeSceneId].push(s.id)
    }
    const alibiLoc = suspectAlibiLocation[s.id]
    if (alibiLoc && alibiLoc !== crimeSceneId && locSuspects[alibiLoc] !== undefined) {
      locSuspects[alibiLoc].push(s.id)
    }
  }

  return {
    suspects: suspectNodes.map((s: any) => ({
      id: s.id,
      name: s.properties?.name ?? s.id,
      description: s.properties?.bio ?? '',
      alibi: s.properties?.alibi_claim ?? '',
      guilty: s.properties?.guilty ?? false,
    })),
    locations: locationNodes.map((l: any) => ({
      id: l.id,
      name: l.properties?.name ?? l.id,
      description: l.properties?.room_description ?? l.properties?.description ?? '',
      suspects: locSuspects[l.id] ?? [],
    })),
    items: itemNodes.map((item: any) => ({
      id: item.id,
      name: item.properties?.name ?? item.id,
      description: item.properties?.description ?? item.properties?.significance ?? '',
      emoji: emojiForItem(item.labels ?? [], item.properties?.name ?? '', item.properties?.description ?? ''),
      type: (item.labels ?? []).find((l: string) => l !== 'Item') ?? 'Item',
    })),
    victim: victimNode
      ? {
          id: victimNode.id,
          name: victimNode.properties?.name ?? victimNode.id,
          description: victimNode.properties?.bio ?? '',
        }
      : null,
    displayNamesJa,
  }
}

export async function fetchScenario(): Promise<ApiScenario> {
  const res = await fetch(`${BASE}/scenario`, { signal: AbortSignal.timeout(3000) })
  if (!res.ok) throw new Error(`scenario fetch failed: ${res.status}`)
  const raw = await res.json()
  if (raw.knowledge_graph) return parseKgFormat(raw)
  return raw as ApiScenario
}

export interface ScenarioListEntry {
  id: string
  path: string
  active: boolean
}

export async function fetchScenarioList(): Promise<ScenarioListEntry[]> {
  const res = await fetch(`${BASE}/scenarios`)
  if (!res.ok) throw new Error(`scenario list fetch failed: ${res.status}`)
  return res.json()
}

export async function selectScenario(scenarioId: string): Promise<void> {
  const res = await fetch(`${BASE}/select_scenario`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario_id: scenarioId }),
  })
  if (!res.ok) throw new Error(`select_scenario failed: ${res.status}`)
}
