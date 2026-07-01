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
  items: string[]
}

export interface ApiItem {
  id: string
  name: string
  description: string
  emoji: string
  type: string
  locationId: string
}

export interface ExamineRules {
  /** IDs of locations available at game start */
  initialLocations: string[]
  /** itemId → locationId that gets unlocked when item is found */
  itemUnlocksLocation: Record<string, string>
  /** suspectId → locationId (their alibi/testimony location) */
  suspectAlibiLocation: Record<string, string>
}

export interface ApiScenario {
  suspects: ApiSuspect[]
  locations: ApiLocation[]
  items: ApiItem[]
  victim: { id: string; name: string; description: string } | null
  displayNamesJa?: Record<string, string>
  examineRules?: ExamineRules
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function emojiForLabels(labels: string[]): string {
  if (labels.includes('MurderWeapon')) return '⚔️'
  if (labels.includes('Evidence')) return '🔍'
  return '📦'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseKgFormat(raw: any): ApiScenario {
  const kg = raw.knowledge_graph
  const displayNamesJa: Record<string, string> = raw.display_names_ja ?? {}
  const examineRulesRaw = raw.examine_rules ?? {}
  const locRules: Record<string, any> = examineRulesRaw.locations ?? {}
  const itemRulesRaw: Record<string, any> = examineRulesRaw.items ?? {}

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
    Object.entries(locRules).find(([, r]: any) => r.initially_available)?.[0] ??
    locationNodes[0]?.id

  const itemToLoc: Record<string, string> = {}
  for (const [locId, rules] of Object.entries(locRules) as any[]) {
    for (const itemId of (rules.items_present ?? [])) {
      itemToLoc[itemId] = locId
    }
  }

  // Build examine rules
  const initialLocations = Object.entries(locRules)
    .filter(([, r]: any) => r.initially_available)
    .map(([id]) => id)

  const itemUnlocksLocation: Record<string, string> = {}
  for (const [itemId, rules] of Object.entries(itemRulesRaw) as any[]) {
    if (rules.unlocks_location) itemUnlocksLocation[itemId] = rules.unlocks_location
  }

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
  const locItems: Record<string, string[]> = {}
  for (const l of locationNodes) {
    locSuspects[l.id] = []
    locItems[l.id] = locRules[l.id]?.items_present ?? []
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
      description: locRules[l.id]?.description ?? l.properties?.description ?? '',
      suspects: locSuspects[l.id] ?? [],
      items: locItems[l.id] ?? [],
    })),
    items: itemNodes.map((item: any) => ({
      id: item.id,
      name: item.properties?.name ?? item.id,
      description: item.properties?.description ?? item.properties?.significance ?? '',
      emoji: emojiForLabels(item.labels ?? []),
      type: (item.labels ?? []).find((l: string) => l !== 'Item') ?? 'Item',
      locationId: itemToLoc[item.id] ?? '',
    })),
    victim: victimNode
      ? {
          id: victimNode.id,
          name: victimNode.properties?.name ?? victimNode.id,
          description: victimNode.properties?.bio ?? '',
        }
      : null,
    displayNamesJa,
    examineRules: { initialLocations, itemUnlocksLocation, suspectAlibiLocation },
  }
}

export async function fetchScenario(): Promise<ApiScenario> {
  const res = await fetch(`${BASE}/scenario`, { signal: AbortSignal.timeout(3000) })
  if (!res.ok) throw new Error(`scenario fetch failed: ${res.status}`)
  const raw = await res.json()
  if (raw.knowledge_graph) return parseKgFormat(raw)
  return raw as ApiScenario
}
