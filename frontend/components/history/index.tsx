'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ChevronLeft, ChevronRight, Clock3, FileText, Loader2 } from 'lucide-react'
import { Header } from '@/components/research-loop/header'
import { apiGet } from '@/lib/api'
import { getProjectId } from '@/lib/project'
import { buildSectionDiffs, diffSections, type SpecVersion } from './data'

const PAGE_SIZE = 10

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default function HistoryPage() {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectChecked, setProjectChecked] = useState(false)

  const [specs, setSpecs] = useState<SpecVersion[]>([])
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [page, setPage] = useState(0)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setProjectId(getProjectId())
    setProjectChecked(true)
  }, [])

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    apiGet<{ project: { id: string; title: string }; specs: SpecVersion[] }>(`/projects/${projectId}/specs`)
      .then((res) => {
        setSpecs(res.specs)
        setSelectedIndex(res.specs.length > 0 ? res.specs.length - 1 : null)
        setPage(0) // newest version is always on page 0 (list is newest-first)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Không tải được lịch sử phiên bản.'))
      .finally(() => setLoading(false))
  }, [projectId])

  const reversedSpecs = [...specs].reverse() // newest first, to match how it's browsed
  const totalPages = Math.max(1, Math.ceil(reversedSpecs.length / PAGE_SIZE))
  const pagedSpecs = reversedSpecs.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)

  const selected = selectedIndex !== null ? specs[selectedIndex] : null
  const previous = selectedIndex !== null && selectedIndex > 0 ? specs[selectedIndex - 1] : null
  const changedSections = selected ? diffSections(selected.data, previous?.data ?? null) : []
  const sectionDiffs = selected ? buildSectionDiffs(selected.data, previous?.data ?? null) : []

  return (
    <div className="app-shell">
      <Header />
      <main className="content" id="history">
        <div className="page-heading">
          <span className="hero-icon">
            <Clock3 size={42} />
          </span>
          <div>
            <h1>Lịch sử phiên bản</h1>
            <p>Mỗi lần sửa đổi tạo ra 1 phiên bản spec mới — xem lại từng phiên bản và phần nào vừa thay đổi.</p>
          </div>
        </div>

        {projectChecked && !projectId && (
          <p className="lock-note">
            Chưa có dự án nào — quay lại{' '}
            <Link href="/" style={{ textDecoration: 'underline' }}>
              Bước 1
            </Link>{' '}
            để bắt đầu.
          </p>
        )}
        {projectId && loading && (
          <p className="lock-note">
            <Loader2 className="spin-icon" size={16} style={{ display: 'inline', marginRight: 6 }} />
            Đang tải lịch sử phiên bản...
          </p>
        )}
        {error && (
          <p className="lock-note">
            <AlertTriangle size={16} style={{ display: 'inline', marginRight: 4 }} />
            {error}
          </p>
        )}

        {projectId && !loading && specs.length === 0 && !error && (
          <p className="lock-note">Chưa có phiên bản spec nào — bắt đầu từ Bước 1 để tạo phiên bản đầu tiên.</p>
        )}

        {projectId && !loading && specs.length > 0 && (
          <div className="related-grid" style={{ gridTemplateColumns: '260px 1fr' }}>
            <section className="mini-panel">
              <h2 className="mini-title blue-text">
                <Clock3 size={19} />
                {specs.length} phiên bản
              </h2>
              <div className="spec-items">
                {pagedSpecs.map((spec) => {
                  const realIndex = specs.findIndex((s) => s.id === spec.id)
                  return (
                    <button
                      type="button"
                      key={spec.id}
                      className={realIndex === selectedIndex ? 'selected' : undefined}
                      onClick={() => setSelectedIndex(realIndex)}
                    >
                      <span>{spec.version}</span>
                      <strong>Phiên bản {spec.version}</strong>
                      <small>{formatDate(spec.createdAt)}</small>
                    </button>
                  )
                })}
              </div>

              {totalPages > 1 && (
                <div className="version-pager">
                  <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                    <ChevronLeft size={13} />
                    Trước
                  </button>
                  <span>
                    Trang {page + 1}/{totalPages}
                  </span>
                  <button type="button" disabled={page >= totalPages - 1} onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}>
                    Sau
                    <ChevronRight size={13} />
                  </button>
                </div>
              )}
            </section>

            <section className="mini-panel">
              <h2 className="mini-title purple-text">
                <FileText size={19} />
                Phiên bản {selected?.version}
              </h2>

              <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--muted)' }}>
                {previous ? `Thay đổi so với phiên bản ${previous.version}:` : 'Đây là phiên bản đầu tiên của dự án.'}
              </p>
              <div className="version-chips" style={{ marginBottom: 16 }}>
                {changedSections.map((section) => (
                  <span key={section} className="status-chip status-chip-confirmed">
                    {section}
                  </span>
                ))}
              </div>

              {sectionDiffs.length > 0 ? (
                <div className="version-diff-list">
                  {sectionDiffs.map((diff) => (
                    <article key={diff.key} className="version-diff-item">
                      <h3>{diff.label}</h3>
                      <div className="version-diff-cols">
                        <div className="version-diff-col old">
                          <span className="tag">{previous ? `Phiên bản ${previous.version} (cũ)` : 'Trước đó'}</span>
                          {diff.oldText}
                        </div>
                        <div className="version-diff-col new">
                          <span className="tag">Phiên bản {selected?.version} (mới)</span>
                          {diff.newText}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="version-detail-empty">Phiên bản này chưa có nội dung nào ngoài các thẻ ý tưởng (Bước 2).</p>
              )}
            </section>
          </div>
        )}

        <Link href="/" className="back-link">
          ← Về trang chủ
        </Link>
      </main>
    </div>
  )
}
