'use client'

import { useState } from 'react'
import { Check, Pencil, Plus, Target, X } from 'lucide-react'
import type { ContributionItem } from './data'

type ContributionPanelProps = {
  contributions: ContributionItem[]
  selectedIds: string[]
  onToggle: (id: string) => void
  onEditLabel: (id: string, label: string) => void
  onAdd: (label: string) => void
}

export function ContributionPanel({ contributions, selectedIds, onToggle, onEditLabel, onAdd }: ContributionPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')

  function startEdit(item: ContributionItem) {
    setEditingId(item.id)
    setDraft(item.label)
  }

  function saveEdit(id: string) {
    const trimmed = draft.trim()
    if (trimmed) onEditLabel(id, trimmed)
    setEditingId(null)
  }

  function submitAdd() {
    const trimmed = newLabel.trim()
    if (!trimmed) return
    onAdd(trimmed)
    setNewLabel('')
    setShowAddForm(false)
  }

  return (
    <div className="mini-panel contribution-panel">
      <h2 className="mini-title blue-text">
        <Target size={19} />
        Contribution đề xuất
      </h2>
      <p className="contribution-hint">Bỏ chọn contribution nào bạn không muốn giữ lại trong spec.</p>
      <div className="contribution-list">
        {contributions.map((item, index) => {
          const checked = selectedIds.includes(item.id)
          const isEditing = editingId === item.id
          return (
            <div className={checked ? 'contribution-row' : 'contribution-row is-off'} key={item.id}>
              <input type="checkbox" checked={checked} onChange={() => onToggle(item.id)} />
              <span className="contribution-number">{index + 1}</span>
              {isEditing ? (
                <textarea
                  className="contribution-edit-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  autoFocus
                  rows={1}
                  aria-label={`Sửa nội dung contribution ${index + 1}`}
                />
              ) : (
                <span className="contribution-label">{item.label}</span>
              )}
              {isEditing ? (
                <div className="contribution-row-actions">
                  <button type="button" className="link-card" onClick={() => saveEdit(item.id)} aria-label="Lưu">
                    <Check size={14} />
                  </button>
                  <button
                    type="button"
                    className="reset-card"
                    onClick={() => setEditingId(null)}
                    aria-label="Hủy"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="contribution-row-edit"
                  onClick={() => startEdit(item)}
                  aria-label={`Sửa contribution ${index + 1}`}
                >
                  <Pencil size={13} />
                </button>
              )}
            </div>
          )
        })}
      </div>

      {showAddForm ? (
        <div className="contribution-add-form">
          <textarea
            placeholder="Nhập contribution mới..."
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            autoFocus
            rows={2}
          />
          <div className="contribution-add-actions">
            <button type="button" className="confirm-action" onClick={submitAdd}>
              <Check size={15} />
              Thêm
            </button>
            <button
              type="button"
              className="edit-action"
              onClick={() => {
                setShowAddForm(false)
                setNewLabel('')
              }}
            >
              Hủy
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="contribution-add-toggle" onClick={() => setShowAddForm(true)}>
          <Plus size={15} />
          Thêm contribution
        </button>
      )}
    </div>
  )
}
