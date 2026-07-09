/**
 * Picks a static per-suspect portrait emoji from their bio text — gender via
 * pronoun count (reliable enough: bios consistently use one pronoun set),
 * then one of a few look-alike variants (chosen by a stable hash of the
 * suspect's own id, so it's consistent across renders but differs between
 * suspects sharing a gender) so the whole cast doesn't share one identical
 * icon. Skin tone is deliberately left at the default (no modifier) rather
 * than guessed from nationality/setting details — those are weak,
 * stereotype-prone signals, and most bios never state ethnicity outright.
 * If a bio *does* name it explicitly, that's honored; otherwise everyone
 * gets the neutral tone rather than a fabricated one.
 */

const FEMALE_PRONOUNS = /\bshe\b|\bher\b|\bhers\b|\bherself\b/gi
const MALE_PRONOUNS = /\bhe\b|\bhim\b|\bhis\b|\bhimself\b/gi

const FEMALE_AVATARS = [
  '\u{1F469}',                                     // 👩
  '\u{1F469}\u{200D}\u{1F9B0}',                     // 👩‍🦰 red hair
  '\u{1F469}\u{200D}\u{1F9B1}',                     // 👩‍🦱 curly hair
  '\u{1F471}\u{200D}\u{2640}\u{FE0F}',              // 👱‍♀️ blond
]
const MALE_AVATARS = [
  '\u{1F468}',                                     // 👨
  '\u{1F468}\u{200D}\u{1F9B0}',                     // 👨‍🦰 red hair
  '\u{1F468}\u{200D}\u{1F9B1}',                     // 👨‍🦱 curly hair
  '\u{1F9D4}\u{200D}\u{2642}\u{FE0F}',              // 🧔‍♂️ bearded
]
const NEUTRAL_AVATARS = [
  '\u{1F9D1}',                                     // 🧑
  '\u{1F9D1}\u{200D}\u{1F9B0}',                     // 🧑‍🦰
  '\u{1F9D1}\u{200D}\u{1F9B1}',                     // 🧑‍🦱
]

const SKIN_TONE_TERMS: { pattern: RegExp; tone: string }[] = [
  { pattern: /\bblack\b woman|\bblack\b man|african[- ]american|\bafrican\b(?! market)/i, tone: '\u{1F3FF}' },
  { pattern: /\basian\b|chinese|japanese|korean|vietnamese|filipino/i, tone: '\u{1F3FD}' },
  { pattern: /\blatina\b|\blatino\b|hispanic/i, tone: '\u{1F3FD}' },
  { pattern: /\bsouth asian\b|\bindian\b(?! summer)|pakistani|bangladeshi/i, tone: '\u{1F3FE}' },
  { pattern: /\bmiddle eastern\b|arab\b/i, tone: '\u{1F3FC}' },
]

function detectGender(bio: string): 'female' | 'male' | 'unknown' {
  const femaleCount = (bio.match(FEMALE_PRONOUNS) ?? []).length
  const maleCount = (bio.match(MALE_PRONOUNS) ?? []).length
  if (femaleCount > maleCount) return 'female'
  if (maleCount > femaleCount) return 'male'
  return 'unknown'
}

function detectSkinTone(bio: string): string {
  const hit = SKIN_TONE_TERMS.find(({ pattern }) => pattern.test(bio))
  return hit?.tone ?? ''
}

function hashIndex(seed: string, length: number): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return hash % length
}

export function suspectAvatarEmoji(bio: string, seed: string): string {
  const gender = detectGender(bio)
  const tone = detectSkinTone(bio)
  const pool = gender === 'female' ? FEMALE_AVATARS : gender === 'male' ? MALE_AVATARS : NEUTRAL_AVATARS
  const base = pool[hashIndex(seed, pool.length)]
  return base + tone
}
