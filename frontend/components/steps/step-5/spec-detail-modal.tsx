'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { SpecItem } from './data'

type SpecDetailModalProps = {
  items: SpecItem[]
  onClose: () => void
}

export function SpecDetailModal({ items, onClose }: SpecDetailModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>Spec tạm thời — chi tiết đầy đủ</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </div>
        <div className="modal-body">
          {items.map((item, index) => (
            <section className="modal-spec-section" key={item.title}>
              <h3>
                <span>{index + 1}</span>
                {item.title}
              </h3>
              {/* [FE-fix] key by index, not content — two entries can legitimately
                  render the same text (e.g. two claim-evidence pairs missing the
                  same fields), and a duplicate content-string key breaks React's
                  identity tracking (the "two children with the same key" warning). */}
              {item.fullContent.map((paragraph, paragraphIndex) => (
                <p key={paragraphIndex}>{paragraph}</p>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
