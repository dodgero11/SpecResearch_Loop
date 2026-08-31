'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lightbulb } from 'lucide-react'
import { apiGet, apiPost } from '@/lib/api'
import { getProjectId, setProjectId as saveProjectId } from '@/lib/project'
import { Header } from './header'
import { IdeaPanel } from './idea-panel'
import { UnderstandingPanel } from './understanding-panel'
import { QuestionsPanel } from './questions-panel'
import { ProgressSummary } from './progress-summary'
import type { ClarifyQuestion, FlowState, QuestionAnswer, Understanding } from './types'

const initialFlow: FlowState = {
  ideaAnalyzed: false,
  understandingConfirmed: false,
  questionsConfirmed: false,
}

type SummaryResponse = {
  clarification: { idea: string; clarifiedIdea: string; keyIssues: string[]; confidence: number | null } | null
  confirmations: Array<{
    id: string
    title: string | null
    question: string
    example: string | null
    options: string[]
    selectedIndex: number | null
    customAnswer: string | null
    answeredAt: string | null
  }>
}

export default function ResearchLoop() {
  const router = useRouter()
  const [flow, setFlow] = useState<FlowState>(initialFlow)
  const [projectId, setProjectIdState] = useState<string | null>(null)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [idea, setIdea] = useState('')
  const [understanding, setUnderstanding] = useState<Understanding | null>(null)
  const [questions, setQuestions] = useState<ClarifyQuestion[]>([])

  // Runs once when the page loads: reuse the projectId already saved in this
  // browser (or create a fresh project), then restore any idea/understanding/
  // questions already saved for it so navigating back here doesn't look empty.
  useEffect(() => {
    async function ensureProject() {
      let id = getProjectId()
      if (!id) {
        try {
          const project = await apiPost<{ id: string; title: string }>('/projects', { title: 'Untitled research' })
          saveProjectId(project.id)
          id = project.id
        } catch (err) {
          setProjectError(err instanceof Error ? err.message : 'Không tạo được project mới')
          return
        }
      }
      setProjectIdState(id)

      try {
        const summary = await apiGet<SummaryResponse>(`/projects/${id}/summary`)
        if (summary.clarification) {
          setIdea(summary.clarification.idea)
          setUnderstanding({
            clarifiedIdea: summary.clarification.clarifiedIdea,
            keyIssues: summary.clarification.keyIssues,
            confidence: summary.clarification.confidence,
          })
        }
        if (summary.confirmations.length > 0) {
          setQuestions(
            summary.confirmations.map((q) => ({
              id: q.id,
              title: q.title ?? q.question,
              example: q.example,
              options: q.options,
              selectedIndex: q.selectedIndex,
              customAnswer: q.customAnswer,
            })),
          )
        }
        setFlow({
          ideaAnalyzed: Boolean(summary.clarification),
          understandingConfirmed: summary.confirmations.length > 0,
          questionsConfirmed: summary.confirmations.length > 0 && summary.confirmations.every((q) => q.answeredAt),
        })
      } catch {
        // No saved data yet for this project — fine, the page just starts empty.
      }
    }
    void ensureProject()
  }, [])

  async function handleAnalyzeIdea(ideaText: string): Promise<Understanding> {
    if (!projectId) throw new Error('Chưa sẵn sàng project — thử lại sau vài giây.')
    setIdea(ideaText)
    const result = await apiPost<Understanding>(`/projects/${projectId}/clarify/understand`, { idea: ideaText })
    setUnderstanding(result)
    setFlow({ ideaAnalyzed: true, understandingConfirmed: false, questionsConfirmed: false })
    return result
  }

  async function handleRegenerateUnderstanding(feedback: string): Promise<Understanding> {
    if (!projectId) throw new Error('Chưa sẵn sàng project.')
    const result = await apiPost<Understanding>(`/projects/${projectId}/clarify/understand`, { idea, feedback })
    setUnderstanding(result)
    return result
  }

  function handleEditIdeaAgain() {
    // Idea text is about to change — the understanding/questions built from the old
    // text are now stale, so clear them and start the flow over from the top.
    setUnderstanding(null)
    setQuestions([])
    setFlow(initialFlow)
  }

  function handleUnconfirmUnderstanding() {
    setFlow((prev) => ({ ...prev, understandingConfirmed: false, questionsConfirmed: false }))
  }

  async function handleConfirmUnderstanding(finalText: string) {
    if (!projectId || !understanding) return
    const confirmed: Understanding = { ...understanding, clarifiedIdea: finalText }
    setUnderstanding(confirmed)
    setFlow((prev) => ({ ...prev, understandingConfirmed: true, questionsConfirmed: false }))

    const result = await apiPost<{ questions: ClarifyQuestion[] }>(`/projects/${projectId}/clarify/questions`)
    setQuestions(result.questions)
  }

  async function handleSubmitAnswers(answers: QuestionAnswer[]) {
    if (!projectId) return
    await apiPost(`/projects/${projectId}/clarify/questions/answers`, { answers })
    setFlow((prev) => ({ ...prev, questionsConfirmed: true }))
  }

  function handleReopenQuestions() {
    setFlow((prev) => ({ ...prev, questionsConfirmed: false }))
  }

  async function handleGoToStep2() {
    if (!projectId) throw new Error('Chưa sẵn sàng project.')
    // Ask the AI to break the confirmed idea into the 8 seed cards before leaving this page.
    await apiPost(`/projects/${projectId}/decompose`)
    router.push('/step-2')
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="content" id="home">
        <div className="page-heading">
          <span className="hero-icon">
            <Lightbulb size={42} />
          </span>
          <div>
            <h1>
              <span>1.</span> Nhập ý tưởng &amp; Làm rõ ban đầu
            </h1>
            <p>Biến ý tưởng nghiên cứu mơ hồ thành mô tả rõ ràng hơn bằng câu hỏi có giải thích và ví dụ.</p>
          </div>
        </div>

        {projectError && <p className="lock-note">Lỗi tạo project: {projectError}</p>}

        <div className="dashboard-grid">
          <IdeaPanel
            onAnalyze={handleAnalyzeIdea}
            onEditAgain={handleEditIdeaAgain}
            restoredIdea={idea}
            restoredAnalyzed={flow.ideaAnalyzed}
          />
          <UnderstandingPanel
            unlocked={flow.ideaAnalyzed}
            confirmed={flow.understandingConfirmed}
            understanding={understanding}
            onRegenerate={handleRegenerateUnderstanding}
            onConfirm={handleConfirmUnderstanding}
            onUnconfirm={handleUnconfirmUnderstanding}
          />
          <QuestionsPanel
            unlocked={flow.understandingConfirmed}
            confirmed={flow.questionsConfirmed}
            questions={questions}
            onSubmitAnswers={handleSubmitAnswers}
            onReopen={handleReopenQuestions}
          />
        </div>
        <ProgressSummary flow={flow} onGoToStep2={handleGoToStep2} />
      </main>
    </div>
  )
}
