/**
 * Clue art, bundled from src/assets/items/<itemId>.webp. A clue without art
 * (e.g. a scenario whose art isn't made yet) returns undefined and callers
 * fall back to the scenario's emoji.
 */
const files = import.meta.glob('../assets/items/*.webp', { eager: true, import: 'default' }) as Record<string, string>

export function itemImageUrl(itemId: string): string | undefined {
  return files[`../assets/items/${itemId}.webp`]
}
