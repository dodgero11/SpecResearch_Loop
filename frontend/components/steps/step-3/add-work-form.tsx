'use client'

import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { PRIORITY_SOURCES, type RelatedWork, type SourceType } from './data'

type AddWorkFormProps = {
  onSubmit: (work: RelatedWork) => void
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

  function handleSubmit() {
    if (!name.trim() || !whatItDid.trim()) return
    onSubmit({
      name: name.trim(),
      year: year.trim() || '—',
      whatItDid: whatItDid.trim(),
      feedbackType: feedbackType.trim() || '—',
      missingGap: missingGap.trim() || '—',
      url: url.trim() || '#',
      sourceType,
    })
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
      <input placeholder="Link nguồn (URL)" value={url} onChange={(e) => setUrl(e.target.value)} />
      <div className="add-work-actions">
        <button type="button" className="confirm-action" onClick={handleSubmit}>
          <Check size={14} />
          Thêm
        </button>
        <button type="button" className="edit-action" onClick={onCancel}>
          <X size={14} />
          Hủy
        </button>
      </div>
    </div>
  )
}
