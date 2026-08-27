'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Scale } from 'lucide-react'
import { Header } from '@/components/research-loop/header'
import { TemporarySpecPanel } from './temporary-spec-panel'
import { JudgesPanel } from './judges-panel'
import { IssuePanel } from './issue-panel'
import { ChoicePanel } from './choice-panel'
import { FinalSpecPanel } from './final-spec-panel'
import { ProgressSummary } from './progress-summary'
import { JUDGE_ISSUES } from './data'

export default function StepFive() {
  const [activeIssueTitle, setActiveIssueTitle] = useState(JUDGE_ISSUES[0].title)
  const [resolvedTitles, setResolvedTitles] = useState<string[]>([])
  const [specConfirmed, setSpecConfirmed] = useState(false)

  function resolveIssue(title: string) {
    setResolvedTitles((prev) => (prev.includes(title) ? prev : [...prev, title]))
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="content" id="judge">
        <div className="page-heading">
          <span className="hero-icon purple-hero">
            <Scale size={42} />
          </span>
          <div>
            <h1>
              <span>5.</span> Judge độc lập &amp; Xác nhận bản cuối
            </h1>
            <p>Spec tạm thời được phản biện bởi nhiều Judge độc lập trước khi bạn quyết định sửa đổi và chốt bản cuối.</p>
          </div>
        </div>

        <div className="judge-grid">
          <section className="temporary-spec">
            <TemporarySpecPanel />
          </section>
          <section className="judge-center">
            <JudgesPanel />
            <IssuePanel
              activeIssueTitle={activeIssueTitle}
              resolvedTitles={resolvedTitles}
              onSelectIssue={setActiveIssueTitle}
            />
          </section>
          <section className="user-choice">
            <ChoicePanel activeIssueTitle={activeIssueTitle} resolvedTitles={resolvedTitles} onResolve={resolveIssue} />
            <FinalSpecPanel
              resolvedTitles={resolvedTitles}
              confirmed={specConfirmed}
              onConfirm={() => setSpecConfirmed(true)}
            />
          </section>
        </div>

        <ProgressSummary specConfirmed={specConfirmed} />

        <div className="judge-actions">
          <Link href="/step-4" className="back-link">
            ← Quay lại Bước 4
          </Link>
        </div>
      </main>
    </div>
  )
}
