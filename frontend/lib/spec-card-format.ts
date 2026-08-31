/** BE stores card type as an UPPER_SNAKE_CASE enum (e.g. "RESEARCH_QUESTION"); show it as "Research question". */
export function formatCardType(type: string): string {
  const words = type.toLowerCase().split('_')
  return words.map((word, i) => (i === 0 ? word[0].toUpperCase() + word.slice(1) : word)).join(' ')
}
