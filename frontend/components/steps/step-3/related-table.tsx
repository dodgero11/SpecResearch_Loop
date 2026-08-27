'use client'

import { useState } from 'react'
import { FileText, Loader2, Plus } from 'lucide-react'
import type { RelatedWork } from './data'
import { AddWorkForm } from './add-work-form'

type RelatedTableProps = {
  results: RelatedWork[]
  searching: boolean
  hasSearched: boolean
  onAddWork: (work: RelatedWork) => void
}

export function RelatedTable({ results, searching, hasSearched, onAddWork }: RelatedTableProps) {
  const [showAddForm, setShowAddForm] = useState(false)

  function handleAdd(work: RelatedWork) {
    onAddWork(work)
    setShowAddForm(false)
  }

  return (
    <section className="related-table-panel">
      <div className="related-table-header">
        <h2 className="mini-title green-text">
          <FileText size={17} />
          Bảng đối sánh related work
        </h2>
        <button type="button" className="add-work-toggle" onClick={() => setShowAddForm((value) => !value)}>
          <Plus size={14} />
          Thêm nghiên cứu
        </button>
      </div>

      {showAddForm && <AddWorkForm onSubmit={handleAdd} onCancel={() => setShowAddForm(false)} />}

      {searching ? (
        <div className="table-loading">
          <Loader2 className="spin-icon" size={22} />
          <span>Đang tìm kiếm tài liệu liên quan...</span>
        </div>
      ) : results.length === 0 ? (
        <p className="table-empty">
          {hasSearched ? 'Không tìm thấy nghiên cứu nào khớp từ khóa.' : 'Nhập từ khóa và tìm kiếm để xem kết quả.'}
        </p>
      ) : (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nghiên cứu</th>
                <th>Đã làm gì?</th>
                <th>Loại feedback</th>
                <th>Điểm còn thiếu</th>
                <th>Nguồn</th>
              </tr>
            </thead>
            <tbody>
              {results.map((work) => (
                <tr key={work.name}>
                  <td>
                    <strong>{work.name}</strong>
                    <small>({work.year})</small>
                  </td>
                  <td>{work.whatItDid}</td>
                  <td>{work.feedbackType}</td>
                  <td>{work.missingGap}</td>
                  <td>
                    <a
                      href={work.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="source-button"
                      aria-label={`Mở nguồn ${work.name}`}
                    >
                      <FileText size={15} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
