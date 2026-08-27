'use client'

import { useState } from 'react'
import { AlertTriangle, ArrowRight, Check, ChevronDown, ChevronUp } from 'lucide-react'
import { JUDGE_ISSUES } from './data'

type IssuePanelProps = {
  activeIssueTitle: string
  resolvedTitles: string[]
  onSelectIssue: (title: string) => void
}

export function IssuePanel({ activeIssueTitle, resolvedTitles, onSelectIssue }: IssuePanelProps) {
  const [expandedTitles, setExpandedTitles] = useState<string[]>([])

  function toggle(title: string) {
    setExpandedTitles((prev) => (prev.includes(title) ? prev.filter((item) => item !== title) : [...prev, title]))
  }

  return (
    <div className="mini-panel issue-panel">
      <h2 className="mini-title purple-text">
        <AlertTriangle size={18} />
        Tổng hợp issue <span className="issue-count">{JUDGE_ISSUES.length} issue</span>
      </h2>
      {JUDGE_ISSUES.map((issue) => {
        const expanded = expandedTitles.includes(issue.title)
        const isActive = issue.title === activeIssueTitle
        const isResolved = resolvedTitles.includes(issue.title)
        return (
          <div className={isActive ? 'issue-row is-active' : 'issue-row'} key={issue.title}>
            <div className="issue-row-main">
              <b className={`severity ${issue.severity.toLowerCase()}`}>{issue.severity}</b>
              <strong>{issue.title}</strong>
              <span>{issue.description}</span>
              <em>{issue.flaggedBy}</em>
            </div>
            <div className="issue-row-footer">
              <button type="button" className="issue-suggestion-toggle" onClick={() => toggle(issue.title)}>
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
                  <button type="button" className="issue-select-btn" onClick={() => onSelectIssue(issue.title)}>
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
