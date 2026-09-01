'use client'

import { useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { PRIORITY_SOURCES, type SourceType } from './data'

export type NewWorkInput = {
  name: string
  year: string
  whatItDid: string
  feedbackType: string
  missingGap: string
  url: string
  sourceType: SourceType
}

type AddWorkFormProps = {
  onSubmit: (work: NewWorkInput) => Promise<void>
  onCancel: () => void
}

export function AddWorkForm({ onSubmit, onCancel }: AddWorkFormProps) {
  const [name, setName] = useState('')
  const [year, setYear] = useState('')
  const [whatItDid, setWhatItDid] = useState('')
  const [feedbackType, setFeedbackType] = useState('')
  const [missingGap, setMissingGap] = useState('')
  const [url, setUrl] = useState('')
  const [sourceType, setSourceType] = useState<SourceType>(PRIORITY_SOURCES[0].key)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!name.trim() || !whatItDid.trim()) return
    const trimmedUrl = url.trim()
    if (trimmedUrl && !/^https?:\/\/.+/i.test(trimmedUrl)) {
      setFormError('Link nguồn phải bắt đầu bằng http:// hoặc https:// (hoặc để trống nếu chưa có).')
      return
    }
    setFormError(null)
    setSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        year: year.trim(),
        whatItDid: whatItDid.trim(),
        feedbackType: feedbackType.trim(),
        missingGap: missingGap.trim(),
        url: url.trim(),
        sourceType,
      })
    } catch {
      // failed — keep the form's current input so the user doesn't lose what they typed
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="add-work-form">
      <div className="add-work-row">
        <input placeholder="Tên nghiên cứu" value={name} onChange={(e) => setName(e.target.value)} />
        <input
          placeholder="Năm"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="add-work-year"
        />
      </div>
      <textarea placeholder="Đã làm gì?" value={whatItDid} onChange={(e) => setWhatItDid(e.target.value)} />
      <div className="add-work-row">
        <input
          placeholder="Loại feedback"
          value={feedbackType}
          onChange={(e) => setFeedbackType(e.target.value)}
        />
        <select value={sourceType} onChange={(e) => setSourceType(e.target.value as SourceType)}>
          {PRIORITY_SOURCES.map((source) => (
            <option value={source.key} key={source.key}>
              {source.label}
            </option>
          ))}
        </select>
      </div>
      <input placeholder="Điểm còn thiếu" value={missingGap} onChange={(e) => setMissingGap(e.target.value)} />
      <input placeholder="Link nguồn (https://...)" value={url} onChange={(e) => setUrl(e.target.value)} />
      {formError && <p className="lock-note">{formError}</p>}
      <div className="add-work-actions">
        <button type="button" className="confirm-action" disabled={submitting} onClick={handleSubmit}>
          {submitting ? <Loader2 className="spin-icon" size={14} /> : <Check size={14} />}
          {submitting ? 'Đang thêm...' : 'Thêm'}
        </button>
        <button type="button" className="edit-action" disabled={submitting} onClick={onCancel}>
          <X size={14} />
          Hủy
        </button>
      </div>
    </div>
  )
}
