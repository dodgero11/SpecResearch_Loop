'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Brain, Check, CheckCircle2, Loader2, UserCircle } from 'lucide-react'
import type { JudgeIssue } from './data'

// Judge types the backend actually rewrites spec content for on resolve (all 5
// judge types now — see backend/src/issue.service.ts). Used to tell "issue chưa
// hỗ trợ sửa" apart from "đã sửa nhưng bản xem trước bị mất do reload trang".
const SUPPORTED_REVISION_TYPES = ['gap', 'contribution', 'experiment', 'evidence', 'conference-readiness']

type ChoicePanelProps = {
  activeIssue: JudgeIssue | null
  resolutionDiff?: { before: unknown; after: unknown }
  onResolve: (issueId: string, choice: string, customChoice?: string) => Promise<void>
}

/** Turns the raw revision content the backend returns into a short readable line. */
function summarizeRevisionContent(value: unknown): string {
  if (value === undefined || value === null) return '(chưa có nội dung)'
  if (typeof value === 'string') return value || '(chưa có nội dung)'
  if (Array.isArray(value)) {
    if (value.length === 0) return '(trống)'
    return value
      .map((item) => {
        if (typeof item === 'string') return item
        if (item && typeof item === 'object') {
          const record = item as Record<string, unknown>
          const label = record.label ?? record.name ?? record.title ?? record.claim ?? record.paper_title
          if (typeof label === 'string' && label) return label
          if (typeof record.limitation === 'string' && record.limitation) return record.limitation
        }
        return JSON.stringify(item)
      })
      .join('; ')
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    const parts: string[] = []
    if (typeof record.limitation === 'string' && record.limitation) parts.push(`Hạn chế: "${record.limitation}"`)
    const selected = Array.isArray(record.directions)
      ? (record.directions as { letter?: string; label?: string; selected?: boolean }[]).find((d) => d.selected)
      : undefined
    if (selected) parts.push(`Hướng đã chọn: ${selected.letter}. ${selected.label}`)
    if (parts.length === 0 && typeof record.summary === 'string' && record.summary) parts.push(record.summary)
    return parts.length > 0 ? parts.join(' — ') : '(chưa có nội dung)'
  }
  return String(value)
}

export function ChoicePanel({ activeIssue, resolutionDiff, onResolve }: ChoicePanelProps) {
  const [selectedLetter, setSelectedLetter] = useState('')
  const [customChoice, setCustomChoice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    setSelectedLetter(activeIssue?.choices[0]?.letter ?? '')
    setCustomChoice('')
  }, [activeIssue])

  if (!activeIssue) {
    return (
      <div className="mini-panel choice-panel">
        <h2 className="mini-title blue-text">
          <UserCircle size={19} />
          Lựa chọn của người dùng
        </h2>
        <p className="claim-empty">Chưa có issue nào để xử lý.</p>
      </div>
    )
  }

  const isResolved = activeIssue.status === 'RESOLVED'
  const chosen = activeIssue.choices.find((option) => option.letter === selectedLetter)
  const isOther = chosen?.label === 'Other'
  const canConfirm = selectedLetter !== '' && (!isOther || customChoice.trim().length > 0)

  async function handleConfirm() {
    if (!activeIssue) return
    setSubmitting(true)
    try {
      await onResolve(activeIssue.id, selectedLetter, isOther ? customChoice.trim() : undefined)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mini-panel choice-panel">
      <h2 className="mini-title blue-text">
        <UserCircle size={19} />
        Lựa chọn của người dùng
      </h2>
      <p className="choice-active-note">
        Đang xử lý: <b className={`severity ${activeIssue.severity.toLowerCase()}`}>{activeIssue.severity}</b> {activeIssue.title}
      </p>

      {activeIssue.choices.length === 0 ? (
        <p className="claim-empty">Judge chưa đề xuất lựa chọn xử lý nào cho issue này.</p>
      ) : (
        activeIssue.choices.map((option) => (
          <button
            type="button"
            key={option.letter}
            className={selectedLetter === option.letter ? 'choice-row selected' : 'choice-row'}
            disabled={isResolved}
            onClick={() => setSelectedLetter(option.letter)}
          >
            <span>{option.letter}.</span>
            {option.label}
            {selectedLetter === option.letter && <CheckCircle2 size={18} />}
          </button>
        ))
      )}

      {isOther && (
        <input
          type="text"
          className="direction-other-input"
          placeholder="Mô tả hướng xử lý của bạn..."
          value={customChoice}
          disabled={isResolved}
          onChange={(e) => setCustomChoice(e.target.value)}
          aria-label="Lựa chọn tự nhập"
        />
      )}

      {chosen && !isResolved && (
        <div className="understanding-choice">
          <Brain size={20} />
          <strong>Cách hệ thống đang hiểu lựa chọn</strong>
          <p>{isOther ? customChoice || 'Nhập mô tả hướng xử lý để hệ thống diễn giải lại.' : chosen.understanding}</p>
        </div>
      )}

      {isResolved && resolutionDiff && (
        <div className="version-diff-list">
          <article className="version-diff-item">
            <h3>Nội dung đã được sửa lại</h3>
            <div className="version-diff-cols">
              <div className="version-diff-col old">
                <span className="tag">Trước khi sửa</span>
                {summarizeRevisionContent(resolutionDiff.before)}
              </div>
              <div className="version-diff-col new">
                <span className="tag">Sau khi sửa</span>
                {summarizeRevisionContent(resolutionDiff.after)}
              </div>
            </div>
          </article>
        </div>
      )}
      {isResolved && !resolutionDiff && SUPPORTED_REVISION_TYPES.includes(activeIssue.judgeType) && (
        <p className="version-detail-empty">
          Nội dung đã được sửa, nhưng bản xem trước này chỉ tồn tại trong phiên làm việc lúc bạn vừa xác nhận — đã mất do
          bạn tải lại trang hoặc quay lại sau. Xem lại nội dung thật (lưu vĩnh viễn) ở trang{' '}
          <Link href="/history">Lịch sử phiên bản</Link>.
        </p>
      )}
      {isResolved && !resolutionDiff && !SUPPORTED_REVISION_TYPES.includes(activeIssue.judgeType) && (
        <p className="version-detail-empty">
          Loại vấn đề này chưa được hệ thống tự động sửa nội dung — lựa chọn của bạn chỉ được ghi nhận lại.
        </p>
      )}

      <button type="button" className="choice-confirm-action" disabled={!canConfirm || isResolved || submitting} onClick={handleConfirm}>
        {submitting ? <Loader2 className="spin-icon" size={15} /> : <Check size={15} />}
        {isResolved ? 'Đã xác nhận xử lý' : submitting ? 'Đang xử lý...' : 'Xác nhận xử lý issue này'}
      </button>
    </div>
  )
}
