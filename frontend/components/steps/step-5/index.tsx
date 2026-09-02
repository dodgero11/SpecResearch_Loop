'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2, Scale } from 'lucide-react'
import { Header } from '@/components/research-loop/header'
import { apiGet, apiPost } from '@/lib/api'
import { getProjectId } from '@/lib/project'
import { TemporarySpecPanel } from './temporary-spec-panel'
import { JudgesPanel } from './judges-panel'
import { IssuePanel } from './issue-panel'
import { ChoicePanel } from './choice-panel'
import { FinalSpecPanel } from './final-spec-panel'
import { ProgressSummary } from './progress-summary'
import type { JudgeIssue, SpecItem } from './data'

type RawIssue = {
  id: string
  judgeType: string
  severity: string
  title: string
  description: string
  suggestion: string
  flaggedBy: string
  choices: unknown
  status: string
}

function toJudgeIssue(raw: RawIssue): JudgeIssue {
  return {
    id: raw.id,
    judgeType: raw.judgeType,
    severity: raw.severity,
    title: raw.title,
    description: raw.description,
    suggestion: raw.suggestion,
    flaggedBy: raw.flaggedBy,
    choices: Array.isArray(raw.choices) ? (raw.choices as JudgeIssue['choices']) : [],
    status: raw.status,
  }
}

type RawTemporary = {
  problemStatement: string
  researchGap: string
  contributions: string[]
  claimEvidenceMatrix: Array<{ claim: string; baseline: string; metric: string; evidence: string; rejectionCondition: string }>
  experimentalProtocol: Array<Record<string, unknown>>
  computeBudget: Record<string, unknown>
}

function formatComputeBudget(raw: Record<string, unknown>): string {
  if (Object.keys(raw).length === 0) return 'Chưa có ước tính.'
  const model = raw.model_name ?? raw.model ?? '—'
  const vram = raw.vram_needed_gb ?? raw.vram ?? '—'
  const hours = raw.gpu_time_hours ?? raw.hours ?? '—'
  const tokens = raw.tokens_estimated ?? raw.tokens ?? '—'
  return `Model: ${model} · VRAM: ~${vram} GB · Thời gian: ~${hours} giờ · Token: ~${tokens}`
}

function toSpecItems(temp: RawTemporary): SpecItem[] {
  return [
    { title: 'Problem Statement', detail: 'Mô tả vấn đề và bối cảnh nghiên cứu.', fullContent: [temp.problemStatement || 'Chưa có nội dung.'] },
    { title: 'Research Gap', detail: 'Khoảng trống nghiên cứu cần giải quyết.', fullContent: [temp.researchGap || 'Chưa có nội dung.'] },
    {
      title: 'Contributions',
      detail: 'Những đóng góp chính của paper.',
      fullContent: temp.contributions.length > 0 ? temp.contributions.map((c, i) => `${i + 1}. ${c}`) : ['Chưa có contribution nào được giữ lại.'],
    },
    {
      title: 'Claim–Evidence Matrix',
      detail: 'Bảng ánh xạ claim và bằng chứng.',
      fullContent:
        temp.claimEvidenceMatrix.length > 0
          ? temp.claimEvidenceMatrix.map(
              (ce) =>
                `Claim: ${ce.claim} — Baseline: ${ce.baseline} — Metric: ${ce.metric} — Evidence: ${ce.evidence} — Điều kiện bác bỏ: ${ce.rejectionCondition}`,
            )
          : ['Chưa có Claim–Evidence nào.'],
    },
    {
      title: 'Experimental Protocol',
      detail: 'Thiết kế thí nghiệm & chi tiết thực thi.',
      fullContent:
        temp.experimentalProtocol.length > 0
          ? temp.experimentalProtocol.map((e) => {
              const name = String(e.name ?? e.title ?? e.code ?? 'Thí nghiệm')
              const detail = Array.isArray(e.bullets) ? e.bullets.join('; ') : String(e.protocol ?? '')
              return `${name}: ${detail}`
            })
          : ['Chưa có thí nghiệm nào.'],
    },
    { title: 'Compute Budget', detail: 'Ngân sách compute & tài nguyên.', fullContent: [formatComputeBudget(temp.computeBudget)] },
  ]
}

export default function StepFive() {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectChecked, setProjectChecked] = useState(false)

  const [specItems, setSpecItems] = useState<SpecItem[]>([])
  const [issues, setIssues] = useState<JudgeIssue[]>([])
  const [activeIssueId, setActiveIssueId] = useState<string | null>(null)
  const [runningJudges, setRunningJudges] = useState(false)
  const [specConfirmed, setSpecConfirmed] = useState(false)
  // True once we know judges have run at least once for this project — either this session ran
  // them, or they'd already run before (GET /issues came back non-empty on load). Used to tell
  // "chưa chạy" apart from "chạy rồi, judge đó sạch" in the per-judge consensus display.
  const [hasRunJudges, setHasRunJudges] = useState(false)
  const [failedJudgeTypes, setFailedJudgeTypes] = useState<string[]>([])
  // Keyed by issue id — filled in only for judge types the backend actually rewrites
  // content for (currently just "gap"). Other types resolve without a before/after.
  const [resolutionDiffs, setResolutionDiffs] = useState<Record<string, { before: unknown; after: unknown } | undefined>>({})

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setProjectId(getProjectId())
    setProjectChecked(true)
  }, [])

  async function loadIssues(pid: string) {
    const raw = await apiGet<RawIssue[]>(`/projects/${pid}/issues`)
    const mapped = raw.map(toJudgeIssue)
    setIssues(mapped)
    if (mapped.length > 0) setHasRunJudges(true)
    setActiveIssueId((prev) => (prev && mapped.some((i) => i.id === prev) ? prev : mapped.find((i) => i.status !== 'RESOLVED')?.id ?? mapped[0]?.id ?? null))
  }

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    ;(async () => {
      const temp = await apiGet<RawTemporary>(`/projects/${projectId}/spec/temporary`)
      setSpecItems(toSpecItems(temp))
      await loadIssues(projectId)
    })()
      .catch((err) => setError(err instanceof Error ? err.message : 'Không tải được spec tạm thời.'))
      .finally(() => setLoading(false))
  }, [projectId])

  async function handleRunJudges() {
    if (!projectId) return
    setRunningJudges(true)
    setError(null)
    try {
      const panel = await apiPost<{ status: string; judges: { type: string; status: string; error?: string }[] }>(
        `/projects/${projectId}/judges/panel`,
      )
      const failed = panel.judges.filter((j) => j.status === 'FAILED')
      setFailedJudgeTypes(failed.map((j) => j.type))
      // A judge that crashed before returning is a real failure, not "no issues found" —
      // surface it as an error so the consensus summary doesn't read the crash as clean.
      if (failed.length > 0) {
        setError(`${failed.length}/5 Judge chạy lỗi: ${failed[0].error ?? 'lỗi không xác định'}`)
      }
      setHasRunJudges(true) // covers the edge case where the run is fully clean (0 issues from any judge)
      await loadIssues(projectId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Chạy Judge thất bại, thử lại.')
    } finally {
      setRunningJudges(false)
    }
  }

  async function handleResolveIssue(issueId: string, choice: string, customChoice?: string) {
    if (!projectId) return
    setError(null)
    try {
      const result = await apiPost<{ before?: unknown; after?: unknown }>(`/projects/${projectId}/issues/${issueId}/resolve`, {
        choice,
        customChoice,
      })
      // `before`/`after` are only present for judge types the backend actually
      // rewrites content for (currently just "gap") — undefined otherwise.
      if (result.before !== undefined || result.after !== undefined) {
        setResolutionDiffs((prev) => ({ ...prev, [issueId]: { before: result.before, after: result.after } }))
      }
      setIssues((prev) => prev.map((issue) => (issue.id === issueId ? { ...issue, status: 'RESOLVED' } : issue)))
      setActiveIssueId(issues.find((i) => i.id !== issueId && i.status !== 'RESOLVED')?.id ?? null)
      // Refresh the temporary spec panel so the user sees the revised content.
      const temp = await apiGet<RawTemporary>(`/projects/${projectId}/spec/temporary`)
      setSpecItems(toSpecItems(temp))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xử lý issue thất bại, thử lại.')
    }
  }

  async function handleConfirmFinal() {
    if (!projectId) return
    setError(null)
    try {
      await apiPost(`/projects/${projectId}/spec/finalize`)
      setSpecConfirmed(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xác nhận spec cuối thất bại, thử lại.')
    }
  }

  const resolvedIds = issues.filter((i) => i.status === 'RESOLVED').map((i) => i.id)
  const activeIssue = issues.find((i) => i.id === activeIssueId) ?? null

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
            Đang tải spec tạm thời...
          </p>
        )}
        {error && (
          <p className="lock-note">
            <AlertTriangle size={16} style={{ display: 'inline', marginRight: 4 }} />
            {error}
          </p>
        )}

        {projectId && !loading && (
          <>
            <div className="judge-grid">
              <section className="temporary-spec">
                <TemporarySpecPanel items={specItems} />
              </section>
              <section className="judge-center">
                <JudgesPanel
                  running={runningJudges}
                  hasRun={hasRunJudges}
                  issues={issues}
                  failedTypes={failedJudgeTypes}
                  onRunJudges={handleRunJudges}
                />
                <IssuePanel issues={issues} activeIssueId={activeIssueId} onSelectIssue={setActiveIssueId} />
              </section>
              <section className="user-choice">
                <ChoicePanel
                  activeIssue={activeIssue}
                  resolutionDiff={activeIssue ? resolutionDiffs[activeIssue.id] : undefined}
                  onResolve={handleResolveIssue}
                />
                <FinalSpecPanel issues={issues} resolvedIds={resolvedIds} confirmed={specConfirmed} onConfirm={handleConfirmFinal} />
              </section>
            </div>

            <ProgressSummary specConfirmed={specConfirmed} />

            <div className="judge-actions">
              <Link href="/step-4" className="back-link">
                ← Quay lại Bước 4
              </Link>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
