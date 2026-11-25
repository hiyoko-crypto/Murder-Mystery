/**
 * Picks a scene-appropriate background image for a location purely from its
 * name/description text — no ML embeddings, just a small tagged image
 * library scored by keyword overlap. Good enough to tell "dressing room"
 * from "garden" without needing a model or an API call.
 */

export interface BgCredit {
  name: string
  /** Unsplash's own short photo ID — used for the trigger_download ping. */
  unsplashId: string
}

export interface BgEntry {
  keywords: string[]
  url: string
  credit: BgCredit
}

export const BG_LIBRARY: BgEntry[] = [
  {
    keywords: ['garden', 'greenhouse', 'plant', 'outdoor', 'patio', 'terrace', '庭', '温室', 'テラス', '植物'],
    url: 'https://images.unsplash.com/photo-1684479924024-3b243f3155e8?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'Stefan Lehner', unsplashId: 'guUouKIbQI0' },
  },
  {
    keywords: ['ballroom', 'theatre', 'theater', 'stage', 'auditorium', 'curtain', 'stalls', 'audience', '舞台', '劇場', 'ホール', '舞踏', '客席'],
    url: 'https://images.unsplash.com/photo-1690740553224-cd74145f82f5?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'Alexandr Istomin', unsplashId: 'f78PJNzR0bs' },
  },
  {
    keywords: ['study', 'library', 'office', 'book', 'archive', 'desk', '書斎', '書庫', '図書'],
    url: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?q=80&w=928&auto=format&fit=crop',
    credit: { name: 'Janko Ferlič', unsplashId: 'sfL_QOnmy00' },
  },
  {
    keywords: ['dressing room', 'vanity', 'mirror', 'makeup', 'wardrobe', '控室', '楽屋', '化粧'],
    url: 'https://images.unsplash.com/photo-1551723454-7565a1f5b161?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'Romina Farías', unsplashId: 'ShAHFTy-HKQ' },
  },
  {
    keywords: ['corridor', 'hallway', 'vent', 'shaft', 'duct', 'passage', 'stage door', 'backstage', '廊下', '通路', '換気', 'ダクト'],
    url: 'https://images.unsplash.com/photo-1714756124356-6bbe68e51a9f?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'Mario Scheibl', unsplashId: 'nudzVlTUaOI' },
  },
  {
    keywords: ['lobby', 'foyer', 'entrance', 'reception', '玄関', 'ロビー', '受付'],
    url: 'https://images.unsplash.com/photo-1758194090785-8e09b7288199?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'Aalo Lens', unsplashId: 'aMFoc0cZENA' },
  },
  {
    keywords: ['bar', 'pub', 'cocktail', 'counter', 'バー', '酒場'],
    url: 'https://images.unsplash.com/photo-1756564800880-7a24d6c6cc15?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'Alex Dev', unsplashId: '1zGxaFuG7LY' },
  },
  {
    keywords: ['bedroom', 'bed', 'hotel room', 'inn', 'chamber', '寝室', 'ベッドルーム', '寝台', '客室'],
    url: 'https://images.unsplash.com/photo-1754585944591-8c650721c389?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'Dmitry Spravko', unsplashId: 'VaWcBvz7iEg' },
  },
  {
    keywords: ['kitchen', 'stove', 'pantry', 'scullery', '台所', 'キッチン', '厨房'],
    url: 'https://images.unsplash.com/photo-1765696300114-160d3dd6c30e?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'ZENG YILI', unsplashId: 'UbZfxQ17gz8' },
  },
  {
    keywords: ['dining room', 'dining hall', 'banquet', 'feast', '食堂', 'ダイニング', '晩餐'],
    url: 'https://images.unsplash.com/photo-1774803685883-6767138dd892?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'Shoham Avisrur', unsplashId: 'mqBz_UETmWY' },
  },
  {
    keywords: ['cellar', 'basement', 'wine cellar', 'vault', 'underground', '地下', '酒蔵', '地下室'],
    url: 'https://images.unsplash.com/photo-1669711517630-7596bfc47351?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'Timothé Durand', unsplashId: 'cfiR6ju8sNI' },
  },
  {
    keywords: ['attic', 'loft', 'rafters', '屋根裏', '屋根裏部屋'],
    url: 'https://images.unsplash.com/photo-1773649966722-4e9a820e8da1?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'HsinKai Tai', unsplashId: '-e8uJ61-LtY' },
  },
  {
    keywords: ['alley', 'alleyway', 'street', 'night street', 'cobblestone', '路地', '通り', '夜道'],
    url: 'https://images.unsplash.com/photo-1750748305388-6f63b659d4a4?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'Stefan Cosma', unsplashId: 'eafH3zJsZsQ' },
  },
  {
    keywords: ['train', 'carriage', 'compartment', 'railway', '列車', '客車', '車両'],
    url: 'https://images.unsplash.com/photo-1708110874093-eae1241d1b74?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'Peter Herrmann', unsplashId: 'Axr7d_e5I-s' },
  },
  {
    keywords: ['church', 'chapel', 'cathedral', 'pew', 'stained glass', '教会', '礼拝堂', '聖堂'],
    url: 'https://images.unsplash.com/photo-1735969702825-9b7ea1598391?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'Lianhao Qu', unsplashId: 'V2FMCaEsesw' },
  },
  {
    keywords: ['museum', 'gallery', 'exhibit', 'exhibition', '美術館', '博物館', '展示'],
    url: 'https://images.unsplash.com/photo-1553644446-9f8f2762ea42?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'Mike Von', unsplashId: '-GO7TP8Umgs' },
  },
  {
    keywords: ['forest', 'woods', 'grove', '森', '森林', '木立'],
    url: 'https://images.unsplash.com/photo-1641667838410-b257ca266e38?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'Marvin Zettl', unsplashId: 'reoc0yCf67c' },
  },
  {
    keywords: ['cliff', 'coast', 'coastline', 'seaside', 'shore', '崖', '海岸', '岸壁'],
    url: 'https://images.unsplash.com/photo-1637061394502-b4a364c3ebd4?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'Maarten Oosterlinck', unsplashId: 'woiH_TsnQq0' },
  },
  {
    keywords: ['boardroom', 'conference room', 'meeting room', 'corporate office', '会議室'],
    url: 'https://images.unsplash.com/photo-1777264935754-aa53096c2d68?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'Aakriti Raina', unsplashId: 'HRsi-QzS3zw' },
  },
  // Added for the sci-fi "AI suspects" scenario (server room, monitoring
  // station, virtual sandbox) — the library above was built for the
  // theatre-murder scenario and had nothing appropriate for a tech setting.
  {
    keywords: ['server room', 'server', 'data center', 'datacenter', 'mainframe', 'servers', 'サーバー', 'サーバールーム', 'データセンター'],
    url: 'https://images.unsplash.com/photo-1584169417032-d34e8d805e8b?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'İsmail Enes Ayhan', unsplashId: 'lVZjvw-u9V8' },
  },
  {
    keywords: ['control room', 'monitoring station', 'monitoring', 'surveillance', 'security room', 'command center', '監視', '管制室', 'モニタリング'],
    url: 'https://images.unsplash.com/photo-1714596282575-82d224db8c70?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'Albert Sukhanov', unsplashId: 'EZTbB6p2cYk' },
  },
  {
    keywords: ['virtual', 'digital', 'cyberspace', 'sandbox', 'simulation', 'virtual reality', '仮想', 'デジタル空間', 'サイバー'],
    url: 'https://images.unsplash.com/photo-1644088379091-d574269d422f?q=80&w=1200&auto=format&fit=crop',
    credit: { name: 'Conny Schneider', unsplashId: 'xuTJZ7uD7PI' },
  },
]

// Shown when nothing in BG_LIBRARY scores above MIN_SCORE — an ambiguous,
// mostly-bare interior that doesn't visually commit to any specific room
// type, so it doesn't clash no matter what the location turns out to be.
const NEUTRAL_FALLBACK: BgEntry = {
  keywords: [],
  url: 'https://images.unsplash.com/photo-1678251543028-04f1ec670c6b?q=80&w=1200&auto=format&fit=crop',
  credit: { name: 'Alexander Kaufmann', unsplashId: 'Co4cGf93yT0' },
}

const MIN_SCORE = 1

export interface BgMatch {
  url: string
  credit: BgCredit
}

// The name is what a location *is*; the description is often full of
// incidental detail (who was where, what was found) that can otherwise
// outvote the name itself — e.g. "Elena's Dressing Room"'s description
// mentions a vent shaft, which would tip a flat count toward the corridor
// image instead of the dressing-room one it should get. Weighting name hits
// higher keeps the name as the primary signal and the description as a
// tie-breaker.
const NAME_WEIGHT = 2

// Plain substring matching lets a short single-word keyword like "bed" fire
// inside an unrelated word (e.g. "disturbed"). Word-boundary matching avoids
// that, but \b only means anything for \w (ASCII-word) keywords — multi-word
// phrases ("dressing room") and CJK keywords are specific enough already, so
// they keep using substring matching (CJK text has no spaces to bound on).
function containsKeyword(text: string, keyword: string): boolean {
  if (/^[a-z]+$/.test(keyword)) {
    return new RegExp(`\\b${keyword}\\b`).test(text)
  }
  return text.includes(keyword)
}

/** Smaller variant of a library photo, for thumbnails (library URLs are w=1200). */
export function thumbnailUrl(url: string): string {
  return url.replace('w=1200', 'w=400')
}

export function matchBackground(name: string, description: string): BgMatch {
  const nameText = name.toLowerCase()
  const descText = description.toLowerCase()

  let best: BgEntry | null = null
  let bestScore = 0
  for (const entry of BG_LIBRARY) {
    const score = entry.keywords.reduce((n, kw) => {
      const lower = kw.toLowerCase()
      const nameHit = containsKeyword(nameText, lower) ? NAME_WEIGHT : 0
      const descHit = containsKeyword(descText, lower) ? 1 : 0
      return n + nameHit + descHit
    }, 0)
    if (score > bestScore) {
      bestScore = score
      best = entry
    }
  }

  if (best && bestScore >= MIN_SCORE) {
    return { url: best.url, credit: best.credit }
  }
  return { url: NEUTRAL_FALLBACK.url, credit: NEUTRAL_FALLBACK.credit }
}
