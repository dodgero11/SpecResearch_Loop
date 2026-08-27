'use client'

import { useState } from 'react'
import { Lightbulb } from 'lucide-react'
import { Header } from './header'
import { IdeaPanel } from './idea-panel'
import { UnderstandingPanel } from './understanding-panel'
import { QuestionsPanel } from './questions-panel'
import { ProgressSummary } from './progress-summary'
import type { FlowState } from './types'

const initialFlow: FlowState = {
  ideaAnalyzed: false,
  understandingConfirmed: false,
  questionsConfirmed: false,
}

export default function ResearchLoop() {
  const [flow, setFlow] = useState<FlowState>(initialFlow)

  function handleIdeaAnalyzed(done: boolean) {
    setFlow((prev) => ({
      ideaAnalyzed: done,
      understandingConfirmed: done ? prev.understandingConfirmed : false,
      questionsConfirmed: done ? prev.questionsConfirmed : false,
    }))
  }

  function handleUnderstandingConfirmedChange(confirmed: boolean) {
    setFlow((prev) => ({
      ...prev,
      understandingConfirmed: confirmed,
      questionsConfirmed: confirmed ? prev.questionsConfirmed : false,
    }))
  }

  function handleQuestionsConfirmedChange(confirmed: boolean) {
    setFlow((prev) => ({ ...prev, questionsConfirmed: confirmed }))
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
        <div className="dashboard-grid">
          <IdeaPanel onAnalyzed={handleIdeaAnalyzed} />
          <UnderstandingPanel
            unlocked={flow.ideaAnalyzed}
            confirmed={flow.understandingConfirmed}
            onConfirmedChange={handleUnderstandingConfirmedChange}
          />
          <QuestionsPanel
            unlocked={flow.understandingConfirmed}
            confirmed={flow.questionsConfirmed}
            onConfirmedChange={handleQuestionsConfirmedChange}
          />
        </div>
        <ProgressSummary flow={flow} />
      </main>
    </div>
  )
}
