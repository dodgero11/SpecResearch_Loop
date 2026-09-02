'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react'
import { Header } from '@/components/research-loop/header'
import { apiPost, apiPostBlob, downloadBlob } from '@/lib/api'
import { clearProjectId, getProjectId, setProjectId as saveProjectId } from '@/lib/project'
import { FinalStepper } from './final-stepper'
import { FinalSpecList } from './final-spec-list'
import { LlmSummaryPanel } from './llm-summary-panel'
import { ExamplePanel } from './example-panel'
import { ConfirmPanel } from './confirm-panel'

type FinalSpecResult = {
  markdownContent: string
  specJson: Record<string, unknown>
  before: string
  after: string
}

export default function StepSix() {
  const router = useRouter()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectChecked, setProjectChecked] = useState(false)

  const [result, setResult] = useState<FinalSpecResult | null>(null)
  const [specConfirmed, setSpecConfirmed] = useState(false)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setProjectId(getProjectId())
    setProjectChecked(true)
  }, [])

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    apiPost<FinalSpecResult>(`/projects/${projectId}/final-spec`)
      .then(setResult)
      .catch((err) => setError(err instanceof Error ? err.message : 'Không tạo được spec cuối.'))
      .finally(() => setLoading(false))
  }, [projectId])

  async function handleConfirm() {
    if (!projectId) return
    setError(null)
    try {
      await apiPost(`/projects/${projectId}/final-spec/confirm`)
      setSpecConfirmed(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xác nhận spec thất bại, thử lại.')
    }
  }

  async function handleExportPdf() {
    if (!projectId) return
    setError(null)
    try {
      const blob = await apiPostBlob(`/projects/${projectId}/final-spec/export-pdf`)
      downloadBlob(blob, 'spec.pdf')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xuất PDF thất bại, thử lại.')
    }
  }

  function handleExportMarkdown() {
    if (!result) return
    downloadBlob(new Blob([result.markdownContent], { type: 'text/markdown' }), 'spec.md')
  }

  function handleExportJson() {
    if (!result || !result.specJson) return
    const jsonString = JSON.stringify(result.specJson, null, 2)
    downloadBlob(new Blob([jsonString], { type: 'application/json' }), 'spec.json')
  }

  /** Creates a brand-new project via the API, forgets this one, and sends the user to Bước 1 with it. */
  async function handleCreateNewProject() {
    clearProjectId()
    const project = await apiPost<{ id: string; title: string }>('/projects', { title: 'Untitled research' })
    saveProjectId(project.id)
    router.push('/')
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="content final-content" id="final-spec">
        <FinalStepper />

        {projectChecked && !projectId && (
          <p className="lock-note">
            Chưa có dự án nào — quay lại{' '}
            <Link href="/" style={{ textDecoration: 'underline' }}>
              Bước 1
            </Link>{' '}
            để bắt đầu.
          </p>
        )}
        {projectId && loading && (
          <p className="lock-note">
            <Loader2 className="spin-icon" size={16} style={{ display: 'inline', marginRight: 6 }} />
            Đang tạo spec cuối...
          </p>
        )}
        {error && (
          <p className="lock-note">
            <AlertTriangle size={16} style={{ display: 'inline', marginRight: 4 }} />
            {error}
          </p>
        )}

        {projectId && !loading && result && (
          <>
            <div className="final-grid">
              <FinalSpecList goal={result.after} />
              <section className="final-right">
                <LlmSummaryPanel />
                <ExamplePanel before={result.before} after={result.after} />
                <ConfirmPanel
                  specConfirmed={specConfirmed}
                  onConfirm={handleConfirm}
                  onExportPdf={handleExportPdf}
                  onExportMarkdown={handleExportMarkdown}
                  onExportJson={handleExportJson}
                  onCreateNewProject={handleCreateNewProject}
                />
              </section>
            </div>

            {specConfirmed && (
              <div className="ready-banner">
                <CheckCircle2 size={24} />
                <strong>Spec đã sẵn sàng cho bước triển khai hoặc viết proposal.</strong>
              </div>
            )}
          </>
        )}

        <Link href="/step-5" className="back-link">
          ← Quay lại Judge
        </Link>
      </main>
    </div>
  )
}
