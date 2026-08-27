'use client'

import { useState } from 'react'
import { Brain, Check, Pencil, RefreshCw, ShieldCheck, Target } from 'lucide-react'
import { ALTERNATE_UNDERSTANDINGS, DEFAULT_UNDERSTANDING } from './data'

const UNDERSTANDING_VARIANTS = [DEFAULT_UNDERSTANDING, ...ALTERNATE_UNDERSTANDINGS]

type UnderstandingPanelProps = {
  unlocked: boolean
  confirmed: boolean
  onConfirmedChange: (confirmed: boolean) => void
}

export function UnderstandingPanel({ unlocked, confirmed, onConfirmedChange }: UnderstandingPanelProps) {
  const [text, setText] = useState(DEFAULT_UNDERSTANDING)
  const [editing, setEditing] = useState(false)
  const [variantIndex, setVariantIndex] = useState(0)
  const [loadingExample, setLoadingExample] = useState(false)

  function requestAnotherExample() {
    setLoadingExample(true)
    setTimeout(() => {
      setVariantIndex((prev) => {
        const next = (prev + 1) % UNDERSTANDING_VARIANTS.length
        setText(UNDERSTANDING_VARIANTS[next])
        return next
      })
      setLoadingExample(false)
    }, 900)
  }

  function startOwnUnderstanding() {
    setText('')
    setEditing(true)
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
        <div className="understanding-copy">{text}</div>
      )}

      <div className="problem-box">
        <h3>
          <Target size={23} />
          Vấn đề chính
        </h3>
        <ul>
          <li>Prompt thủ công có thể không ổn định</li>
          <li>LLM dễ tạo unsupported claims</li>
          <li>Cần cách kiểm tra claim–evidence rõ ràng</li>
        </ul>
      </div>

      <div className="confidence">
        <ShieldCheck size={23} />
        <strong>Mức chắc chắn:</strong>
        <span>Trung bình</span>
      </div>

      {!unlocked && <p className="lock-note">Hoàn thành phân tích ý tưởng ở trên trước để xác nhận mục này.</p>}

      {unlocked && !confirmed && (
        <div className="confirm-row wrap">
          <button
            type="button"
            className="confirm-action"
            onClick={() => {
              setEditing(false)
              onConfirmedChange(true)
            }}
          >
            <Check size={18} />
            Đúng rồi, tiếp tục
          </button>
          <button type="button" className="edit-action" onClick={() => setEditing((value) => !value)}>
            <Pencil size={16} />
            {editing ? 'Xong' : 'Chỉnh sửa'}
          </button>
          <button type="button" className="edit-action" disabled={loadingExample} onClick={requestAnotherExample}>
            <RefreshCw size={16} className={loadingExample ? 'spin-icon' : ''} />
            {loadingExample ? 'Đang tạo...' : 'Yêu cầu ví dụ khác'}
          </button>
          <button type="button" className="edit-action" onClick={startOwnUnderstanding}>
            <Pencil size={16} />
            Nhập cách hiểu riêng
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
              onConfirmedChange(false)
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
