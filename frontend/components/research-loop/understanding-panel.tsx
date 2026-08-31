'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Brain, Check, Pencil, RefreshCw, ShieldCheck, Target } from 'lucide-react'
import type { Understanding } from './types'

type UnderstandingPanelProps = {
  unlocked: boolean
  confirmed: boolean
  understanding: Understanding | null
  onRegenerate: (feedback: string) => Promise<Understanding>
  onConfirm: (finalText: string) => Promise<void>
  onUnconfirm: () => void
}

/** ai_service returns confidence as a 0-1 fraction; show it as a rounded percent. */
function formatConfidence(confidence: number | null): string {
  if (confidence === null) return '—'
  return `${Math.round(confidence * 100)}%`
}

export function UnderstandingPanel({
  unlocked,
  confirmed,
  understanding,
  onRegenerate,
  onConfirm,
  onUnconfirm,
}: UnderstandingPanelProps) {
  const [text, setText] = useState('')
  const [editing, setEditing] = useState(false)
  const [loadingExample, setLoadingExample] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (understanding) setText(understanding.clarifiedIdea)
  }, [understanding])

  async function requestAnotherExample() {
    setLoadingExample(true)
    setError(null)
    try {
      await onRegenerate('Diễn giải lại theo một cách hiểu khác.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không tạo được ví dụ khác, thử lại.')
    } finally {
      setLoadingExample(false)
    }
  }

  async function handleConfirm() {
    setConfirming(true)
    setError(null)
    try {
      setEditing(false)
      await onConfirm(text)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xác nhận thất bại, thử lại.')
    } finally {
      setConfirming(false)
    }
  }

  return (
    <section className={`panel understanding-panel ${unlocked ? '' : 'is-locked'}`}>
      <h2 className="panel-title green">
        <span className="icon-box green-soft">
          <Brain size={25} />
        </span>
        Cách hệ thống đang hiểu ý tưởng
      </h2>

      {editing ? (
        <textarea
          className="understanding-edit"
          aria-label="Chỉnh sửa nội dung hệ thống hiểu"
          placeholder="Nhập cách hiểu của riêng bạn..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
      ) : (
        <div className="understanding-copy">{text || 'Chưa có nội dung — hãy phân tích ý tưởng ở trên trước.'}</div>
      )}

      <div className="problem-box">
        <h3>
          <Target size={23} />
          Vấn đề chính
        </h3>
        <ul>
          {(understanding?.keyIssues ?? []).map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      </div>

      <div className="confidence">
        <ShieldCheck size={23} />
        <strong>Mức chắc chắn:</strong>
        <span>{formatConfidence(understanding?.confidence ?? null)}</span>
      </div>

      {!unlocked && <p className="lock-note">Hoàn thành phân tích ý tưởng ở trên trước để xác nhận mục này.</p>}

      {error && (
        <div className="lock-note" role="alert">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {unlocked && !confirmed && (
        <div className="confirm-row wrap">
          <button type="button" className="confirm-action" disabled={confirming} onClick={handleConfirm}>
            <Check size={18} />
            {confirming ? 'Đang xác nhận...' : 'Đúng rồi, tiếp tục'}
          </button>
          <button type="button" className="edit-action" onClick={() => setEditing((value) => !value)}>
            <Pencil size={16} />
            {editing ? 'Xong' : 'Chỉnh sửa'}
          </button>
          <button type="button" className="edit-action" disabled={loadingExample} onClick={requestAnotherExample}>
            <RefreshCw size={16} className={loadingExample ? 'spin-icon' : ''} />
            {loadingExample ? 'Đang tạo...' : 'Yêu cầu ví dụ khác'}
          </button>
        </div>
      )}

      {unlocked && confirmed && (
        <div className="confirm-row">
          <div className="analysis-done-banner" role="status">
            <Check size={18} />
            Đã xác nhận cách hiểu này.
          </div>
          <button
            type="button"
            className="edit-action"
            onClick={() => {
              setEditing(true)
              onUnconfirm()
            }}
          >
            <Pencil size={16} />
            Chỉnh sửa lại
          </button>
        </div>
      )}
    </section>
  )
}
