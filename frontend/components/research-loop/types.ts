export type FlowState = {
  ideaAnalyzed: boolean
  understandingConfirmed: boolean
  questionsConfirmed: boolean
}

export type Understanding = {
  clarifiedIdea: string
  keyIssues: string[]
  confidence: number | null
}

export type ClarifyQuestion = {
  id: string
  title: string
  example: string | null
  options: string[]
  /** Present when restoring a previously-answered question from GET /summary. */
  selectedIndex?: number | null
  customAnswer?: string | null
}

export type QuestionAnswer = {
  questionId: string
  selectedIndex: number
  customAnswer?: string
}
