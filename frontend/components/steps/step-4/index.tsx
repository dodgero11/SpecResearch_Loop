'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, FlaskConical, Loader2, Pencil } from 'lucide-react'
import { Header } from '@/components/research-loop/header'
import { apiGet, apiPost, apiPut } from '@/lib/api'
import { getProjectId } from '@/lib/project'
import { ContributionPanel } from './contribution-panel'
import { ClaimPanel } from './claim-panel'
import { ExperimentPanel } from './experiment-panel'
import { FeasibilityPanel } from './feasibility-panel'
import { ProgressSummary } from './progress-summary'
import type { ClaimEvidence, ContributionItem, ExperimentRow, Feasibility } from './data'

type RawPlan = {
  contributions: ContributionItem[]
  experiments: Record<string, unknown>[]
  feasibility: Record<string, unknown>
  confirmed?: boolean
  selectedContributionIds?: string[]
}

/** ai_service's experiment items don't yet split out code/bullets/relatedContributionIds — derive them if missing. */
function toExperimentRow(raw: Record<string, unknown>, index: number): ExperimentRow {
  const bullets = Array.isArray(raw.bullets)
    ? raw.bullets.map(String)
    : [raw.protocol, raw.expected_outcome].filter((v): v is string => typeof v === 'string' && v.length > 0)
  return {
    code: typeof raw.code === 'string' ? raw.code : `TN${index + 1}`,
    title: typeof raw.title === 'string' ? raw.title : String(raw.name ?? `Thí nghiệm ${index + 1}`),
    bullets,
    relatedContributionIds: Array.isArray(raw.relatedContributionIds) ? raw.relatedContributionIds.map(String) : [],
  }
}

export default function StepFour() {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectChecked, setProjectChecked] = useState(false)

  const [contributions, setContributions] = useState<ContributionItem[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [experiments, setExperiments] = useState<ExperimentRow[]>([])
  const [feasibility, setFeasibility] = useState<Feasibility | null>(null)
  const [planConfirmed, setPlanConfirmed] = useState(false)
  const [generatingForId, setGeneratingForId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setProjectId(getProjectId())
    setProjectChecked(true)
  }, [])

  function applyPlan(plan: RawPlan) {
    setContributions(plan.contributions)
    setExperiments(plan.experiments.map(toExperimentRow))
    setSelectedIds(plan.selectedContributionIds ?? plan.contributions.map((c) => c.id))
    setPlanConfirmed(Boolean(plan.confirmed))
  }

  async function refreshFeasibility(pid: string, ids: string[]) {
    if (ids.length === 0) {
      setFeasibility(null)
      return
    }
    const result = await apiPost<Feasibility>(`/projects/${pid}/feasibility`, { selectedContributionIds: ids })
    setFeasibility(result)
  }

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    ;(async () => {
      // Reuse an already-generated plan (so revisiting this page doesn't wipe your
      // edits by re-calling the AI) — only generate a fresh one the first time.
      const summary = await apiGet<{ latestSpec: { data: Record<string, unknown> } | null }>(`/projects/${projectId}/summary`)
      const existingPlan = summary.latestSpec?.data?.experimentPlan as RawPlan | undefined
      const plan =
        existingPlan && existingPlan.contributions?.length > 0
          ? existingPlan
          : await apiPost<RawPlan>(`/projects/${projectId}/spec-experiment`)
      applyPlan(plan)
      const ids = plan.selectedContributionIds ?? plan.contributions.map((c) => c.id)
      await refreshFeasibility(projectId, ids)
    })()
      .catch((err) => setError(err instanceof Error ? err.message : 'Không tải được kế hoạch thí nghiệm.'))
      .finally(() => setLoading(false))
  }, [projectId])

  function toggleContribution(id: string) {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      if (projectId) void refreshFeasibility(projectId, next).catch((err) => setError(err instanceof Error ? err.message : 'Không tính lại được tính khả thi.'))
      return next
    })
  }

  async function editContributionLabel(id: string, label: string) {
    if (!projectId) return
    setError(null)
    try {
      const result = await apiPut<{ contribution: ContributionItem }>(`/projects/${projectId}/contributions/${id}`, { label })
      setContributions((prev) => prev.map((item) => (item.id === id ? result.contribution : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sửa contribution thất bại, thử lại.')
    }
  }

  async function addContribution(label: string) {
    if (!projectId) return
    setError(null)
    try {
      const result = await apiPost<{ contribution: ContributionItem }>(`/projects/${projectId}/contributions`, { label })
      setContributions((prev) => [...prev, result.contribution])
      setSelectedIds((prev) => [...prev, result.contribution.id])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm contribution thất bại, thử lại.')
    }
  }

  async function editClaimEvidence(id: string, patch: ClaimEvidence) {
    if (!projectId) return
    setError(null)
    setGeneratingForId(id)
    try {
      const result = await apiPut<{ claimEvidence: ClaimEvidence; experiment: Record<string, unknown> | null }>(
        `/projects/${projectId}/contributions/${id}/claim-evidence`,
        patch,
      )
      setContributions((prev) => prev.map((item) => (item.id === id ? { ...item, claimEvidence: result.claimEvidence } : item)))
      if (result.experiment) {
        setExperiments((prev) => [...prev, toExperimentRow(result.experiment!, prev.length)])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lưu Claim–Evidence thất bại, thử lại.')
    } finally {
      setGeneratingForId(null)
    }
  }

  const selectedContributions = contributions.filter((item) => selectedIds.includes(item.id))
  const canConfirmPlan = selectedContributions.length > 0

  async function handleConfirmPlan() {
    if (!projectId || !canConfirmPlan) return
    setError(null)
    try {
      await apiPost(`/projects/${projectId}/spec-experiment/confirm`, { selectedContributionIds: selectedIds })
      setPlanConfirmed(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xác nhận kế hoạch thất bại, thử lại.')
    }
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="content" id="contribution">
        <div className="page-heading">
          <span className="hero-icon">
            <FlaskConical size={42} />
          </span>
          <div>
            <h1>
              <span>4.</span> Contribution &amp; Kế hoạch thí nghiệm
            </h1>
            <p>Biến research gap thành contribution, claim rõ ràng và kế hoạch kiểm chứng từng bước.</p>
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
            Đang tạo kế hoạch...
          </p>
        )}
        {error && <p className="lock-note">{error}</p>}

        {projectId && !loading && (
          <>
            <div className="experiment-grid">
              <section className="left-stack">
                <ContributionPanel
                  contributions={contributions}
                  selectedIds={selectedIds}
                  onToggle={toggleContribution}
                  onEditLabel={editContributionLabel}
                  onAdd={addContribution}
                />
                <ClaimPanel contributions={selectedContributions} onEditClaimEvidence={editClaimEvidence} />
              </section>
              <ExperimentPanel
                rows={experiments}
                selectedContributionIds={selectedIds}
                generatingLabel={generatingForId ? contributions.find((item) => item.id === generatingForId)?.label : undefined}
              />
              <FeasibilityPanel feasibility={feasibility} selectedCount={selectedContributions.length} totalCount={contributions.length} />
            </div>

            <ProgressSummary planConfirmed={planConfirmed} />

            <div className="experiment-actions">
              <Link href="/step-3" className="back-link">
                ← Quay lại Bước 3
              </Link>
              {planConfirmed ? (
                <div className="plan-confirmed-actions">
                  <button type="button" className="edit-action" onClick={() => setPlanConfirmed(false)}>
                    <Pencil size={16} />
                    Sửa đổi
                  </button>
                  <span className="plan-saved-badge">
                    <CheckCircle2 size={16} />
                    Đã lưu kế hoạch
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  className="secondary-action"
                  disabled={!canConfirmPlan}
                  title={!canConfirmPlan ? 'Cần giữ lại ít nhất 1 contribution trước khi xác nhận kế hoạch' : undefined}
                  onClick={handleConfirmPlan}
                >
                  <CheckCircle2 size={16} />
                  Xác nhận kế hoạch
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  )
}
