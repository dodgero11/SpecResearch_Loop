'use client'

import { useState } from 'react'
import { Check, Lightbulb, Pencil } from 'lucide-react'
import { questions } from './data'

type QuestionsPanelProps = {
  unlocked: boolean
  confirmed: boolean
  onConfirmedChange: (confirmed: boolean) => void
}

export function QuestionsPanel({ unlocked, confirmed, onConfirmedChange }: QuestionsPanelProps) {
  const [answers, setAnswers] = useState(questions.map((q) => q.selected))
  const [customAnswers, setCustomAnswers] = useState(questions.map(() => ''))

  function selectOption(index: number, optionIndex: number) {
    setAnswers((prev) => prev.map((value, i) => (i === index ? optionIndex : value)))
    if (confirmed) onConfirmedChange(false)
  }

  function updateCustomAnswer(index: number, value: string) {
    setCustomAnswers((prev) => prev.map((v, i) => (i === index ? value : v)))
    if (confirmed) onConfirmedChange(false)
  }

  return (
    <section className={`panel questions-panel ${unlocked ? '' : 'is-locked'}`}>
      <h2 className="panel-title purple">
        <span className="question-icon">?</span>
        Câu hỏi cần xác nhận
      </h2>
      {questions.map((question, index) => {
        const isOtherSelected = question.options[answers[index]] === 'Other'
        return (
          <div className="question-card" key={question.title}>
            <div className="question-heading">
              <span className="number">{index + 1}</span>
              <strong>{question.title}</strong>
            </div>
            <div className="options">
              {question.options.map((option, optionIndex) => (
                <button
                  key={option}
                  type="button"
                  className={`option ${answers[index] === optionIndex ? 'selected' : ''}`}
                  onClick={() => selectOption(index, optionIndex)}
                >
                  {option}
                </button>
              ))}
            </div>
            {isOtherSelected && (
              <input
                type="text"
                className="other-answer-input"
                placeholder="Nhập câu trả lời của bạn..."
                value={customAnswers[index]}
                onChange={(e) => updateCustomAnswer(index, e.target.value)}
                aria-label={`Câu trả lời tự nhập cho câu hỏi ${index + 1}`}
              />
            )}
            <p className="example">
              <Lightbulb size={18} />
              {question.example}
            </p>
          </div>
        )
      })}

      {!unlocked && <p className="lock-note">Hoàn thành xác nhận cách hiểu ở trên trước khi trả lời câu hỏi.</p>}

      {unlocked && !confirmed && (
        <button type="button" className="confirm-action full" onClick={() => onConfirmedChange(true)}>
          <Check size={18} />
          Xác nhận &amp; tiếp tục
        </button>
      )}

      {unlocked && confirmed && (
        <div className="confirm-row">
          <div className="analysis-done-banner" role="status">
            <Check size={18} />
            Đã xác nhận câu trả lời.
          </div>
          <button type="button" className="edit-action" onClick={() => onConfirmedChange(false)}>
            <Pencil size={16} />
            Chỉnh sửa lại
          </button>
        </div>
      )}
    </section>
  )
}
