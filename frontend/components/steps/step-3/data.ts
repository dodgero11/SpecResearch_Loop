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
  // [FE-fix] ai_service's related-works prompt returns "preprint" as a valid
  // source_type (e.g. arXiv medical papers), but there was no filter entry for
  // it — any such result had no checkbox to enable it and was silently hidden
  // from the table forever, even though it was saved correctly in the DB.
  { key: 'preprint', label: 'Preprint (arXiv, chưa peer-review)' },
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
