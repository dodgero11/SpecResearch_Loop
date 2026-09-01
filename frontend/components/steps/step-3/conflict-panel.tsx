'use client'

import { useState } from 'react'
import { AlertTriangle, Check, Link2 } from 'lucide-react'
import type { Conflict } from './data'

type ConflictPanelProps = {
  conflicts: Conflict[]
  cardContentById: Record<string, string>
  onResolve: (conflictId: string, choice: string, customResolution?: string) => Promise<void>
}

export function ConflictPanel({ conflicts, cardContentById, onResolve }: ConflictPanelProps) {
  if (conflicts.length === 0) return null

  return (
    <>
      {conflicts.map((conflict) => (
        <ConflictCard key={conflict.id} conflict={conflict} cardContentById={cardContentById} onResolve={onResolve} />
      ))}
    </>
  )
}

function ConflictCard({
  conflict,
  cardContentById,
  onResolve,
}: {
  conflict: Conflict
  cardContentById: Record<string, string>
  onResolve: (conflictId: string, choice: string, customResolution?: string) => Promise<void>
}) {
  const [selectedLetter, setSelectedLetter] = useState('')
  const [customResolution, setCustomResolution] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chosen = conflict.resolutionOptions.find((r) => r.letter === selectedLetter)
  const isOther = chosen?.label === 'Other'
  const canConfirm = selectedLetter !== '' && (!isOther || customResolution.trim().length > 0)

  async function handleConfirm() {
    setSubmitting(true)
    setError(null)
    try {
      await onResolve(conflict.id, selectedLetter, isOther ? customResolution.trim() : undefined)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xử lý xung đột thất bại, thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="panel conflict-panel">
      <h2 className="panel-title conflict-text">
        <AlertTriangle size={22} />
        Xung đột phát hiện được
      </h2>

      <div className="conflict-claim-box">
        <div>
          <strong>Claim (Bước 2)</strong>
          <span>{cardContentById[conflict.claimCardId] ?? conflict.claimCardId}</span>
        </div>
        <div>
          <strong>Evidence (Bước 2)</strong>
          <span>{cardContentById[conflict.evidenceCardId] ?? conflict.evidenceCardId}</span>
        </div>
      </div>

      {conflict.linkedSources.length > 0 && (
        <div className="conflict-sources">
          {conflict.linkedSources.map((source, i) => (
            <span className="conflict-source-chip" key={`${source.paperTitle}-${i}`}>
              <Link2 size={12} />
              {source.paperTitle} {source.year ? `(${source.year})` : ''}
            </span>
          ))}
        </div>
      )}

      <p className="conflict-reason">{conflict.reason}</p>

      <p className="combine-label">Bạn muốn xử lý claim này như thế nào?</p>
      <div className="direction-options">
        {conflict.resolutionOptions.map((resolution) => (
          <button
            key={resolution.letter}
            type="button"
            className={selectedLetter === resolution.letter ? 'direction-option selected' : 'direction-option'}
            onClick={() => setSelectedLetter(resolution.letter)}
            title={resolution.description}
          >
            {resolution.letter}. {resolution.label}
          </button>
        ))}
      </div>

      {isOther && (
        <input
          type="text"
          className="direction-other-input"
          placeholder="Mô tả hướng xử lý của bạn..."
          value={customResolution}
          onChange={(e) => setCustomResolution(e.target.value)}
          aria-label="Hướng xử lý tự chọn"
        />
      )}

      {chosen && <p className="conflict-hint">{chosen.description}</p>}

      {error && (
        <p className="lock-note" role="alert">
          {error}
        </p>
      )}

      <button type="button" className="confirm-action full" disabled={!canConfirm || submitting} onClick={handleConfirm}>
        <Check size={18} />
        {submitting ? 'Đang xử lý...' : 'Xác nhận xử lý xung đột'}
      </button>
    </section>
  )
}
