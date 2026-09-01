export type SourceType = 'peer-reviewed' | 'proceedings' | 'author' | 'survey' | string

export type RelatedWork = {
  id: string
  name: string
  year: string
  whatItDid: string
  feedbackType: string
  missingGap: string
  url: string
  sourceType: SourceType
}

export type PrioritySource = { key: SourceType; label: string }

export const PRIORITY_SOURCES: PrioritySource[] = [
  { key: 'peer-reviewed', label: 'Paper peer-reviewed' },
  { key: 'proceedings', label: 'Proceedings chính thức' },
  { key: 'author', label: 'Tài liệu tác giả' },
  { key: 'survey', label: 'Survey có nguồn rõ ràng' },
]

export type GapDirection = { letter: string; label: string; description: string; selected?: boolean }

export type GapAnalysisResult = {
  whatWasDone: string
  limitation: string
  whyItMatters: string
  testableWith: string
  directions: GapDirection[]
}

export type ConflictSource = { paperTitle: string; year?: string | number }

export type Conflict = {
  id: string
  claimCardId: string
  evidenceCardId: string
  linkedSources: ConflictSource[]
  reason: string
  resolutionOptions: { letter: string; label: string; description: string }[]
}
