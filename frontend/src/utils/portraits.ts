/**
 * 2D suspect portraits, bundled from src/assets/portraits/<suspectId>/.
 * Each suspect folder holds neutral / nervous / resigned expressions plus a
 * square face icon cut from the neutral one. Suspects without a folder (e.g.
 * scenarios whose art isn't made yet) get undefined, and callers fall back to
 * the silhouette / emoji.
 */

export type Expression = 'neutral' | 'nervous' | 'resigned'

export const EXPRESSIONS: Expression[] = ['neutral', 'nervous', 'resigned']

// Only URLs are bundled here; the images themselves load when first shown.
const files = import.meta.glob('../assets/portraits/*/*.webp', { eager: true, import: 'default' }) as Record<string, string>

function lookup(suspectId: string, name: string): string | undefined {
  return files[`../assets/portraits/${suspectId}/${name}.webp`]
}

export function portraitUrl(suspectId: string, expression: Expression): string | undefined {
  return lookup(suspectId, expression)
}

export function suspectIconUrl(suspectId: string): string | undefined {
  return lookup(suspectId, 'icon')
}
