'use client'

import { useState } from 'react'
import { AlertTriangle, ArrowRight, Check, ChevronDown, ChevronUp } from 'lucide-react'
import type { JudgeIssue } from './data'

type IssuePanelProps = {
  issues: JudgeIssue[]
  activeIssueId: string | null
  onSelectIssue: (id: string) => void
}

export function IssuePanel({ issues, activeIssueId, onSelectIssue }: IssuePanelProps) {
  const [expandedIds, setExpandedIds] = useState<string[]>([])

  function toggle(id: string) {
    setExpandedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]))
  }

  return (
    <div className="mini-panel issue-panel">
      <h2 className="mini-title purple-text">
        <AlertTriangle size={18} />
        Tổng hợp issue <span className="issue-count">{issues.length} issue</span>
      </h2>
      {issues.length === 0 && <p className="claim-empty">Chưa có issue nào — chạy đánh giá Judge ở khung bên trên trước.</p>}
      {issues.map((issue) => {
        const expanded = expandedIds.includes(issue.id)
        const isActive = issue.id === activeIssueId
        const isResolved = issue.status === 'RESOLVED'
        return (
          <div className={isActive ? 'issue-row is-active' : 'issue-row'} key={issue.id}>
            <div className="issue-row-main">
              <b className={`severity ${issue.severity.toLowerCase()}`}>{issue.severity}</b>
              <strong>{issue.title}</strong>
              <span>{issue.description}</span>
              <em>{issue.flaggedBy}</em>
            </div>
            <div className="issue-row-footer">
              <button type="button" className="issue-suggestion-toggle" onClick={() => toggle(issue.id)}>
                {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                {expanded ? 'Thu gọn' : 'Xem đề xuất'}
              </button>
              <div className="issue-row-actions">
                {isResolved && (
                  <span className="issue-resolved-badge">
                    <Check size={12} />
                    Đã xử lý
                  </span>
                )}
                {isActive && !isResolved ? (
                  <span className="issue-active-badge">Đang xử lý</span>
                ) : (
                  <button type="button" className="issue-select-btn" onClick={() => onSelectIssue(issue.id)}>
                    {isResolved ? 'Xem lại' : 'Xử lý issue này'}
                    <ArrowRight size={12} />
                  </button>
                )}
              </div>
            </div>
            {expanded && (
              <p className="issue-suggestion">
                <strong>Đề xuất:</strong> {issue.suggestion}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
