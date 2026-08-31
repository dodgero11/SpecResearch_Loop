'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, Lightbulb, Loader2, Pencil } from 'lucide-react'
import type { ClarifyQuestion, QuestionAnswer } from './types'

const OTHER_LABEL = 'Other'

type QuestionsPanelProps = {
  unlocked: boolean
  confirmed: boolean
  questions: ClarifyQuestion[]
  onSubmitAnswers: (answers: QuestionAnswer[]) => Promise<void>
  onReopen: () => void
}

export function QuestionsPanel({ unlocked, confirmed, questions, onSubmitAnswers, onReopen }: QuestionsPanelProps) {
  const [answers, setAnswers] = useState<number[]>([])
  const [customAnswers, setCustomAnswers] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setAnswers(questions.map((q) => q.selectedIndex ?? -1))
    setCustomAnswers(questions.map((q) => q.customAnswer ?? ''))
  }, [questions])

  function selectOption(index: number, optionIndex: number) {
    setAnswers((prev) => prev.map((value, i) => (i === index ? optionIndex : value)))
  }

  function updateCustomAnswer(index: number, value: string) {
    setCustomAnswers((prev) => prev.map((v, i) => (i === index ? value : v)))
  }

  const allAnswered =
    questions.length > 0 &&
    answers.every((value, i) => {
      if (value === -1) return false
      const isOther = questions[i].options[value] === OTHER_LABEL
      return !isOther || customAnswers[i].trim().length > 0
    })

  async function handleSubmit() {
    setSubmitting(true)
    setError(null)
    try {
      const payload: QuestionAnswer[] = questions.map((question, i) => ({
        questionId: question.id,
        selectedIndex: answers[i],
        customAnswer: question.options[answers[i]] === OTHER_LABEL ? customAnswers[i].trim() : undefined,
      }))
      await onSubmitAnswers(payload)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gửi câu trả lời thất bại, thử lại.')
    } finally {
      setSubmitting(false)
    }
  }

  const loadingQuestions = unlocked && !confirmed && questions.length === 0

  return (
    <section className={`panel questions-panel ${unlocked ? '' : 'is-locked'}`}>
      <h2 className="panel-title purple">
        <span className="question-icon">?</span>
        Câu hỏi cần xác nhận
      </h2>

      {loadingQuestions && (
        <p className="lock-note">
          <Loader2 className="spin-icon" size={16} style={{ display: 'inline', marginRight: 6 }} />
          Đang tạo câu hỏi...
        </p>
      )}

      {questions.map((question, index) => {
        const selected = answers[index]
        const isOtherSelected = selected !== -1 && question.options[selected] === OTHER_LABEL
        return (
          <div className="question-card" key={question.id}>
            <div className="question-heading">
              <span className="number">{index + 1}</span>
              <strong>{question.title}</strong>
            </div>
            <div className="options">
              {question.options.map((option, optionIndex) => (
                <button
                  key={option}
                  type="button"
                  className={`option ${selected === optionIndex ? 'selected' : ''}`}
                  disabled={confirmed}
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
                disabled={confirmed}
                onChange={(e) => updateCustomAnswer(index, e.target.value)}
                aria-label={`Câu trả lời tự nhập cho câu hỏi ${index + 1}`}
              />
            )}
            {question.example && (
              <p className="example">
                <Lightbulb size={18} />
                {question.example}
              </p>
            )}
          </div>
        )
      })}

      {!unlocked && <p className="lock-note">Hoàn thành xác nhận cách hiểu ở trên trước khi trả lời câu hỏi.</p>}

      {error && (
        <div className="lock-note" role="alert">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {unlocked && !confirmed && questions.length > 0 && (
        <button type="button" className="confirm-action full" disabled={!allAnswered || submitting} onClick={handleSubmit}>
          <Check size={18} />
          {submitting ? 'Đang gửi...' : 'Xác nhận & tiếp tục'}
        </button>
      )}

      {unlocked && confirmed && (
        <div className="confirm-row">
          <div className="analysis-done-banner" role="status">
            <Check size={18} />
            Đã xác nhận câu trả lời.
          </div>
          <button type="button" className="edit-action" onClick={onReopen}>
            <Pencil size={16} />
            Chỉnh sửa lại
          </button>
        </div>
      )}
    </section>
  )
}
