export type CardStatus = 'CONFIRMED' | 'PROPOSED' | 'MISSING' | 'AMBIGUOUS' | 'UNSUPPORTED' | 'CONFLICT'

export const CARD_STATUSES: CardStatus[] = [
  'CONFIRMED',
  'PROPOSED',
  'MISSING',
  'AMBIGUOUS',
  'UNSUPPORTED',
  'CONFLICT',
]

/** Matches the backend's SpecCardType enum (Prisma) exactly. */
export const SUGGESTED_CARD_TYPES = [
  'PROBLEM',
  'RESEARCH_QUESTION',
  'GAP_CANDIDATE',
  'CONTRIBUTION',
  'CLAIM',
  'EVIDENCE',
  'CONSTRAINT',
  'OPEN_QUESTION',
]

export type DecompositionCard = {
  id: string
  type: string
  content: string
  status: CardStatus
  isSeed: boolean
  linkedIds: string[]
  reason: string
}

export type SpecCardLink = {
  id: string
  sourceCardId: string
  targetCardId: string
  type: string
}
