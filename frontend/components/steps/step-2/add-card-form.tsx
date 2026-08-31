'use client'

import { useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { formatCardType } from '@/lib/spec-card-format'
import { SUGGESTED_CARD_TYPES, type DecompositionCard } from './data'

type AddCardFormProps = {
  onSubmit: (card: Pick<DecompositionCard, 'type' | 'content'>) => Promise<void>
  onCancel: () => void
}

export function AddCardForm({ onSubmit, onCancel }: AddCardFormProps) {
  const [selectedType, setSelectedType] = useState<string>(SUGGESTED_CARD_TYPES[0])
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    const trimmedContent = content.trim()
    if (!selectedType || !trimmedContent) return
    setSubmitting(true)
    try {
      await onSubmit({ type: selectedType, content: trimmedContent })
      setSelectedType(SUGGESTED_CARD_TYPES[0])
      setContent('')
    } catch {
      // failed — keep the form's current input so the user doesn't lose what they typed
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="add-card-form">
      <div className="add-card-field">
        <label htmlFor="new-card-type">Loại thẻ</label>
        <select id="new-card-type" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
          {SUGGESTED_CARD_TYPES.map((type) => (
            <option value={type} key={type}>
              {formatCardType(type)}
            </option>
          ))}
        </select>
      </div>

      <div className="add-card-field">
        <label htmlFor="new-card-content">Nội dung</label>
        <textarea
          id="new-card-content"
          placeholder="Mô tả ngắn gọn nội dung thẻ..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </div>
      <div className="add-card-actions">
        <button type="button" className="confirm-action" disabled={submitting} onClick={handleSubmit}>
          {submitting ? <Loader2 className="spin-icon" size={18} /> : <Check size={18} />}
          {submitting ? 'Đang thêm...' : 'Thêm thẻ'}
        </button>
        <button type="button" className="edit-action" disabled={submitting} onClick={onCancel}>
          <X size={16} />
          Hủy
        </button>
      </div>
    </section>
  )
}
