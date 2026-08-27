'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Link2 } from 'lucide-react'
import { CONFLICT_EXAMPLE, CONFLICT_RESOLUTIONS, type RelatedWork } from './data'

type ConflictPanelProps = {
  results: RelatedWork[]
  onResolvedChange: (resolved: boolean) => void
}

export function ConflictPanel({ results, onResolvedChange }: ConflictPanelProps) {
  const [selectedLetter, setSelectedLetter] = useState('')
  const [customResolution, setCustomResolution] = useState('')
  const [resolved, setResolved] = useState(false)

  const matchedSources = results.filter((work) => CONFLICT_EXAMPLE.linkedSources.includes(work.name))
  const hasEvidence = matchedSources.length > 0
  const chosen = CONFLICT_RESOLUTIONS.find((r) => r.letter === selectedLetter)
  const canConfirm = selectedLetter !== '' && (selectedLetter !== 'D' || customResolution.trim().length > 0)

  useEffect(() => {
    onResolvedChange(!hasEvidence || resolved)
  }, [hasEvidence, resolved, onResolvedChange])

  if (!hasEvidence) return null

  if (resolved && chosen) {
    return (
      <section className="panel conflict-panel is-resolved">
        <h2 className="panel-title conflict-text">
          <AlertTriangle size={22} />
          Xung đột đã xử lý
        </h2>
        <div className="analysis-done-banner" role="status">
          <Check size={18} />
          Đã chọn hướng {chosen.letter}. {chosen.label}
          {chosen.letter === 'D' && ` — ${customResolution}`}
        </div>
        <p className="conflict-note">
          Claim "{CONFLICT_EXAMPLE.claim}" ở Bước 2 sẽ được cập nhật lại theo hướng này khi 2 bước được nối dữ liệu
          thật với nhau.
        </p>
        <button type="button" className="edit-action" onClick={() => setResolved(false)}>
          Chọn lại
        </button>
      </section>
    )
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
          <span>{CONFLICT_EXAMPLE.claim}</span>
        </div>
        <div>
          <strong>Evidence (Bước 2)</strong>
          <span>{CONFLICT_EXAMPLE.evidence}</span>
        </div>
      </div>

      <div className="conflict-sources">
        {matchedSources.map((work) => (
          <span className="conflict-source-chip" key={work.name}>
            <Link2 size={12} />
            {work.name} ({work.year})
          </span>
        ))}
      </div>

      <p className="conflict-reason">{CONFLICT_EXAMPLE.reason}</p>

      <p className="combine-label">Bạn muốn xử lý claim này như thế nào?</p>
      <div className="direction-options">
        {CONFLICT_RESOLUTIONS.map((resolution) => (
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

      {selectedLetter === 'D' && (
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

      <button type="button" className="confirm-action full" disabled={!canConfirm} onClick={() => setResolved(true)}>
        <Check size={18} />
        Xác nhận xử lý xung đột
      </button>
    </section>
  )
}
