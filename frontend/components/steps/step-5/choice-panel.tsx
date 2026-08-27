'use client'

import { useEffect, useState } from 'react'
import { Brain, Check, CheckCircle2, UserCircle } from 'lucide-react'
import { JUDGE_ISSUES } from './data'

type ChoicePanelProps = {
  activeIssueTitle: string
  resolvedTitles: string[]
  onResolve: (title: string) => void
}

export function ChoicePanel({ activeIssueTitle, resolvedTitles, onResolve }: ChoicePanelProps) {
  const activeIssue = JUDGE_ISSUES.find((issue) => issue.title === activeIssueTitle) ?? JUDGE_ISSUES[0]
  const isResolved = resolvedTitles.includes(activeIssue.title)

  const [selectedLetter, setSelectedLetter] = useState(activeIssue.choices[0].letter)
  const [customChoice, setCustomChoice] = useState('')

  useEffect(() => {
    setSelectedLetter(activeIssue.choices[0].letter)
    setCustomChoice('')
  }, [activeIssue])

  const chosen = activeIssue.choices.find((option) => option.letter === selectedLetter)
  const isOther = selectedLetter === 'D'
  const canConfirm = selectedLetter !== '' && (!isOther || customChoice.trim().length > 0)

  return (
    <div className="mini-panel choice-panel">
      <h2 className="mini-title blue-text">
        <UserCircle size={19} />
        Lựa chọn của người dùng
      </h2>
      <p className="choice-active-note">
        Đang xử lý: <b className={`severity ${activeIssue.severity.toLowerCase()}`}>{activeIssue.severity}</b>{' '}
        {activeIssue.title}
      </p>
      {activeIssue.choices.map((option) => (
        <button
          type="button"
          key={option.letter}
          className={selectedLetter === option.letter ? 'choice-row selected' : 'choice-row'}
          onClick={() => setSelectedLetter(option.letter)}
        >
          <span>{option.letter}.</span>
          {option.label}
          {selectedLetter === option.letter && <CheckCircle2 size={18} />}
        </button>
      ))}

      {isOther && (
        <input
          type="text"
          className="direction-other-input"
          placeholder="Mô tả hướng xử lý của bạn..."
          value={customChoice}
          onChange={(e) => setCustomChoice(e.target.value)}
          aria-label="Lựa chọn tự nhập"
        />
      )}

      <div className="understanding-choice">
        <Brain size={20} />
        <strong>Cách hệ thống đang hiểu lựa chọn</strong>
        <p>{isOther ? (customChoice || 'Nhập mô tả hướng xử lý để hệ thống diễn giải lại.') : chosen?.understanding}</p>
      </div>

      <button
        type="button"
        className="choice-confirm-action"
        disabled={!canConfirm}
        onClick={() => onResolve(activeIssue.title)}
      >
        <Check size={15} />
        {isResolved ? 'Đã xác nhận xử lý' : 'Xác nhận xử lý issue này'}
      </button>
    </div>
  )
}
