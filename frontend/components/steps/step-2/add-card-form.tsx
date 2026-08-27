'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { SUGGESTED_CARD_TYPES, type DecompositionCard } from './data'

const OTHER_VALUE = '__other__'

type AddCardFormProps = {
  onSubmit: (card: Pick<DecompositionCard, 'type' | 'content'>) => void
  onCancel: () => void
}

export function AddCardForm({ onSubmit, onCancel }: AddCardFormProps) {
  const [selectedType, setSelectedType] = useState<string>(SUGGESTED_CARD_TYPES[0])
  const [customType, setCustomType] = useState('')
  const [content, setContent] = useState('')

  const isOther = selectedType === OTHER_VALUE

  function handleSubmit() {
    const finalType = (isOther ? customType : selectedType).trim()
    const trimmedContent = content.trim()
    if (!finalType || !trimmedContent) return
    onSubmit({ type: finalType, content: trimmedContent })
    setSelectedType(SUGGESTED_CARD_TYPES[0])
    setCustomType('')
    setContent('')
  }

  return (
    <section className="add-card-form">
      <div className="add-card-field">
        <label htmlFor="new-card-type">Loại thẻ</label>
        <select id="new-card-type" value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
          {SUGGESTED_CARD_TYPES.map((type) => (
            <option value={type} key={type}>
              {type}
            </option>
          ))}
          <option value={OTHER_VALUE}>Other (tự nhập loại thẻ)</option>
        </select>
      </div>

      {isOther && (
        <div className="add-card-field">
          <label htmlFor="new-card-custom-type">Tên loại thẻ tự đặt</label>
          <input
            id="new-card-custom-type"
            placeholder="Vd: Ethical constraint, Threat model..."
            value={customType}
            onChange={(e) => setCustomType(e.target.value)}
          />
        </div>
      )}

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
        <button type="button" className="confirm-action" onClick={handleSubmit}>
          <Check size={18} />
          Thêm thẻ
        </button>
        <button type="button" className="edit-action" onClick={onCancel}>
          <X size={16} />
          Hủy
        </button>
      </div>
    </section>
  )
}
