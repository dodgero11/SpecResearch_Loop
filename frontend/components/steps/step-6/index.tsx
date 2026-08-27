'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { Header } from '@/components/research-loop/header'
import { FinalStepper } from './final-stepper'
import { FinalSpecList } from './final-spec-list'
import { LlmSummaryPanel } from './llm-summary-panel'
import { ExamplePanel } from './example-panel'
import { ConfirmPanel } from './confirm-panel'

export default function StepSix() {
  const [specConfirmed, setSpecConfirmed] = useState(false)

  return (
    <div className="app-shell">
      <Header />
      <main className="content final-content" id="final-spec">
        <FinalStepper />

        <div className="final-grid">
          <FinalSpecList />
          <section className="final-right">
            <LlmSummaryPanel />
            <ExamplePanel />
            <ConfirmPanel specConfirmed={specConfirmed} onConfirm={() => setSpecConfirmed(true)} />
          </section>
        </div>

        {specConfirmed && (
          <div className="ready-banner">
            <CheckCircle2 size={24} />
            <strong>Spec đã sẵn sàng cho bước triển khai hoặc viết proposal.</strong>
          </div>
        )}

        <Link href="/step-5" className="back-link">
          ← Quay lại Judge
        </Link>
      </main>
    </div>
  )
}
