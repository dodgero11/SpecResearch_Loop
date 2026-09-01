'use client'

import { useEffect, useState } from 'react'
import { Check, ChevronLeft, ChevronRight, FileText, Pencil, Sparkles, X } from 'lucide-react'
import type { ClaimEvidence, ContributionItem } from './data'

type ClaimPanelProps = {
  contributions: ContributionItem[]
  onEditClaimEvidence: (id: string, patch: ClaimEvidence) => void
}

const FIELDS: { key: keyof ClaimEvidence; label: string }[] = [
  { key: 'claim', label: 'Claim' },
  { key: 'baseline', label: 'Baseline' },
  { key: 'metric', label: 'Metric' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'rejectionCondition', label: 'Điều kiện bác bỏ' },
]

const EMPTY_CLAIM_EVIDENCE: ClaimEvidence = { claim: '', baseline: '', metric: '', evidence: '', rejectionCondition: '' }

export function ClaimPanel({ contributions, onEditClaimEvidence }: ClaimPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<ClaimEvidence | null>(null)

  useEffect(() => {
    if (activeIndex > contributions.length - 1) {
      setActiveIndex(Math.max(0, contributions.length - 1))
    }
    setEditing(false)
  }, [contributions.length, activeIndex])

  const current = contributions[activeIndex]
  const currentClaimEvidence = current?.claimEvidence ?? EMPTY_CLAIM_EVIDENCE
  const isEmpty = current ? FIELDS.every((field) => currentClaimEvidence[field.key].trim() === '') : false

  function startEdit() {
    if (!current) return
    setDraft(currentClaimEvidence)
    setEditing(true)
  }

  function saveEdit() {
    if (current && draft) onEditClaimEvidence(current.id, draft)
    setEditing(false)
  }

  return (
    <div className="mini-panel claim-panel">
      <h2 className="mini-title blue-text">
        <FileText size={19} />
        Claim – Evidence Card
      </h2>
      {!current ? (
        <p className="claim-empty">
          Chưa có contribution nào được giữ lại — tick chọn ít nhất 1 contribution ở khung bên cạnh.
        </p>
      ) : (
        <div className="claim-pager">
          <button
            type="button"
            className="claim-pager-btn claim-pager-prev"
            disabled={contributions.length < 2}
            onClick={() => setActiveIndex((i) => (i - 1 + contributions.length) % contributions.length)}
            aria-label="Card trước"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="claim-card-block">
            <div className="claim-card-header">
              <p className="claim-card-title">
                {activeIndex + 1}/{contributions.length} — {current.label}
              </p>
              {!editing && (
                <button type="button" className="claim-card-edit-btn" onClick={startEdit} aria-label="Sửa card này">
                  <Pencil size={14} />
                </button>
              )}
            </div>

            {editing && draft ? (
              <>
                <div className="claim-edit-fields">
                  {FIELDS.map((field) => (
                    <label key={field.key}>
                      {field.label}
                      <textarea
                        className="claim-field-edit"
                        value={draft[field.key]}
                        onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                      />
                    </label>
                  ))}
                </div>
                <div className="card-edit-actions">
                  <button type="button" className="link-card" onClick={saveEdit}>
                    <Check size={15} />
                    Lưu
                  </button>
                  <button type="button" className="reset-card" onClick={() => setEditing(false)}>
                    <X size={15} />
                    Hủy
                  </button>
                </div>
              </>
            ) : isEmpty ? (
              <div className="claim-empty-hint">
                <Sparkles size={18} />
                <div>
                  <strong>Chưa có nội dung cho contribution này.</strong>
                  <p>Hãy điền Claim, Baseline, Metric, Evidence và Điều kiện bác bỏ để hoàn thiện card.</p>
                </div>
                <button type="button" className="confirm-action" onClick={startEdit}>
                  <Pencil size={14} />
                  Điền nội dung
                </button>
              </div>
            ) : (
              <div className="claim-table">
                {FIELDS.map((field) => (
                  <div key={field.key}>
                    <strong>{field.label}</strong>
                    <span>{currentClaimEvidence[field.key]}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            className="claim-pager-btn claim-pager-next"
            disabled={contributions.length < 2}
            onClick={() => setActiveIndex((i) => (i + 1) % contributions.length)}
            aria-label="Card tiếp theo"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
