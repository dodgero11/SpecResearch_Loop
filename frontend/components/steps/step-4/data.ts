export type ClaimEvidence = {
  claim: string
  baseline: string
  metric: string
  evidence: string
  rejectionCondition: string
}

export type ContributionItem = {
  id: string
  label: string
  claimEvidence: ClaimEvidence | null
}

export type ExperimentRow = {
  code: string
  title: string
  bullets: string[]
  relatedContributionIds: string[]
}

export type Feasibility = {
  model: string
  seedPrompts: number
  rounds: number
  candidates: number
  vram: number
  hours: number
  tokens: number
  isFeasible: boolean
  explanation: string
}
