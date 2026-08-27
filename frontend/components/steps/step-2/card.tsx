'use client'

import { useState } from 'react'
import { Check, CircleDot, Link2, Pencil, Trash2, X } from 'lucide-react'
import { CARD_STATUSES, type CardStatus, type DecompositionCard } from './data'

type IdeaCardProps = {
  card: DecompositionCard
  allCards: DecompositionCard[]
  onStatusChange: (status: CardStatus) => void
  onDelete: () => void
  onEditContent: (content: string) => void
  onToggleLink: (targetId: string) => void
  onReasonChange: (reason: string) => void
}

export function IdeaCard({
  card,
  allCards,
  onStatusChange,
  onDelete,
  onEditContent,
  onToggleLink,
  onReasonChange,
}: IdeaCardProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(card.content)
  const [showLinkMenu, setShowLinkMenu] = useState(false)

  function handleSave() {
    const trimmed = draft.trim()
    if (trimmed) onEditContent(trimmed)
    setEditing(false)
  }

  function handleCancel() {
    setDraft(card.content)
    setEditing(false)
  }

  const isClaim = card.type === 'Claim'
  const needsReason = card.status === 'AMBIGUOUS' || card.status === 'CONFLICT'
  const evidenceCandidates = allCards.filter((item) => item.type === 'Evidence' && item.id !== card.id)
  const linkedCards = card.linkedIds
    .map((id) => allCards.find((item) => item.id === id))
    .filter((item): item is DecompositionCard => Boolean(item))

  return (
    <article className={`decomposition-card status-${card.status.toLowerCase()}`}>
      <div className="card-top">
        <span className="type-pill">
          <CircleDot size={14} />
          {card.type}
        </span>
        <select
          className="status-pill"
          value={card.status}
          aria-label={`Trạng thái thẻ ${card.type}`}
          onChange={(e) => onStatusChange(e.target.value as CardStatus)}
        >
          {CARD_STATUSES.map((status) => (
            <option value={status} key={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {editing ? (
        <textarea
          className="card-edit"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label={`Chỉnh sửa nội dung thẻ ${card.type}`}
          autoFocus
        />
      ) : (
        <p>{card.content}</p>
      )}

      {!editing && needsReason && (
        <div className="reason-box">
          <label htmlFor={`reason-${card.id}`}>
            {card.status === 'AMBIGUOUS' ? 'Vì sao mơ hồ?' : 'Vì sao mâu thuẫn?'}
          </label>
          <textarea
            id={`reason-${card.id}`}
            className="reason-input"
            placeholder="Giải thích ngắn gọn lý do..."
            value={card.reason}
            onChange={(e) => onReasonChange(e.target.value)}
          />
        </div>
      )}

      {!editing && linkedCards.length > 0 && (
        <div className="linked-tags">
          {linkedCards.map((linked) => (
            <span className="linked-tag" key={linked.id}>
              <Link2 size={12} />
              {linked.type}
              <button
                type="button"
                onClick={() => onToggleLink(linked.id)}
                aria-label={`Bỏ liên kết với ${linked.type}`}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="card-footer">
        {editing ? (
          <div className="card-edit-actions">
            <button type="button" className="link-card" onClick={handleSave}>
              <Check size={15} />
              Lưu
            </button>
            <button type="button" className="reset-card" onClick={handleCancel}>
              <X size={15} />
              Hủy
            </button>
          </div>
        ) : (
          <>
            {isClaim && (
              <button type="button" className="link-card" onClick={() => setShowLinkMenu((value) => !value)}>
                <Link2 size={15} />
                Liên kết evidence
              </button>
            )}
            <div className="card-icon-actions">
              <button
                type="button"
                className="reset-card"
                aria-label="Chỉnh sửa nội dung"
                onClick={() => setEditing(true)}
              >
                <Pencil size={15} />
              </button>
              {card.isSeed ? (
                <button
                  type="button"
                  className="delete-card is-disabled"
                  disabled
                  title="Thẻ mẫu không thể xóa — nếu không dùng, hãy đổi trạng thái thành MISSING"
                >
                  <Trash2 size={15} />
                </button>
              ) : (
                <button type="button" className="delete-card" aria-label="Xóa thẻ" onClick={onDelete}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {isClaim && showLinkMenu && !editing && (
        <div className="link-menu">
          <p className="link-menu-title">Chọn Evidence để liên kết:</p>
          {evidenceCandidates.length === 0 ? (
            <p className="link-menu-empty">Không có thẻ Evidence nào khác để liên kết.</p>
          ) : (
            <ul className="link-menu-list">
              {evidenceCandidates.map((candidate) => (
                <li key={candidate.id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={card.linkedIds.includes(candidate.id)}
                      onChange={() => onToggleLink(candidate.id)}
                    />
                    {candidate.content}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  )
}
