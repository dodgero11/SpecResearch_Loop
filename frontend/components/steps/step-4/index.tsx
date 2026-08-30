'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, FlaskConical, Pencil } from 'lucide-react'
import { Header } from '@/components/research-loop/header'
import { ContributionPanel } from './contribution-panel'
import { ClaimPanel } from './claim-panel'
import { ExperimentPanel } from './experiment-panel'
import { FeasibilityPanel } from './feasibility-panel'
import { ProgressSummary } from './progress-summary'
import {
  buildExperimentRowForContribution,
  CONTRIBUTIONS,
  EXPERIMENT_ROWS,
  type ClaimEvidence,
  type ContributionItem,
  type ExperimentRow,
} from './data'

const EMPTY_CLAIM_EVIDENCE: ClaimEvidence = {
  claim: '',
  baseline: '',
  metric: '',
  evidence: '',
  rejectionCondition: '',
}

export default function StepFour() {
  const [planConfirmed, setPlanConfirmed] = useState(false)
  const [contributions, setContributions] = useState<ContributionItem[]>(CONTRIBUTIONS)
  const [selectedIds, setSelectedIds] = useState<string[]>(CONTRIBUTIONS.map((item) => item.id))
  const [experimentRows, setExperimentRows] = useState<ExperimentRow[]>(EXPERIMENT_ROWS)
  const [generatingForId, setGeneratingForId] = useState<string | null>(null)

  function toggleContribution(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  function editContributionLabel(id: string, label: string) {
    setContributions((prev) => prev.map((item) => (item.id === id ? { ...item, label } : item)))
  }

  function addContribution(label: string) {
    const created: ContributionItem = {
      id: crypto.randomUUID(),
      label,
      claimEvidence: EMPTY_CLAIM_EVIDENCE,
    }
    setContributions((prev) => [...prev, created])
    setSelectedIds((prev) => [...prev, created.id])
  }

  function editClaimEvidence(id: string, patch: ClaimEvidence) {
    setContributions((prev) => prev.map((item) => (item.id === id ? { ...item, claimEvidence: patch } : item)))

    const isFilled = Object.values(patch).every((value) => value.trim() !== '')
    const alreadyHasExperiment = experimentRows.some((row) => row.relatedContributionIds.includes(id))
    if (!isFilled || alreadyHasExperiment) return

    const target = contributions.find((item) => item.id === id)
    if (!target) return

    setGeneratingForId(id)
    setTimeout(() => {
      setExperimentRows((prev) => [...prev, buildExperimentRowForContribution({ ...target, claimEvidence: patch }, prev.length)])
      setGeneratingForId(null)
    }, 900)
  }

  const selectedContributions = contributions.filter((item) => selectedIds.includes(item.id))
  const canConfirmPlan = selectedContributions.length > 0

  useEffect(() => {
    if (!canConfirmPlan && planConfirmed) setPlanConfirmed(false)
  }, [canConfirmPlan, planConfirmed])

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
            rows={experimentRows}
            selectedContributionIds={selectedIds}
            generatingLabel={generatingForId ? contributions.find((item) => item.id === generatingForId)?.label : undefined}
          />
          <FeasibilityPanel selectedCount={selectedContributions.length} totalCount={contributions.length} />
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
              onClick={() => setPlanConfirmed(true)}
            >
              <CheckCircle2 size={16} />
              Xác nhận kế hoạch
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
