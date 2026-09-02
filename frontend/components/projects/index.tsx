'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Folder, FolderOpen, FolderPlus, Loader2 } from 'lucide-react'
import { Header } from '@/components/research-loop/header'
import { apiGet, apiPost } from '@/lib/api'
import { getProjectId, setProjectId } from '@/lib/project'
import { formatDate, type ProjectSummary } from './data'

export default function ProjectsPage() {
  const router = useRouter()
  const [currentId, setCurrentId] = useState<string | null>(null)

  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  function load() {
    setLoading(true)
    setError(null)
    apiGet<ProjectSummary[]>('/projects')
      .then(setProjects)
      .catch((err) => setError(err instanceof Error ? err.message : 'Không tải được danh sách dự án.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setCurrentId(getProjectId())
    load()
  }, [])

  async function handleSwitch(projectId: string) {
    if (projectId === currentId) return
    setSwitchingId(projectId)
    try {
      setProjectId(projectId)
      router.push('/')
    } finally {
      setSwitchingId(null)
    }
  }

  async function handleCreateNew() {
    setCreating(true)
    setError(null)
    try {
      const project = await apiPost<{ id: string; title: string }>('/projects', { title: 'Untitled research' })
      setProjectId(project.id)
      router.push('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tạo dự án mới thất bại, thử lại.')
      setCreating(false)
    }
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="content" id="projects">
        <div className="page-heading">
          <span className="hero-icon">
            <Folder size={42} />
          </span>
          <div>
            <h1>Dự án</h1>
            <p>Chuyển đổi giữa nhiều dự án nghiên cứu — dữ liệu và lịch sử phiên bản của mỗi dự án được giữ nguyên riêng biệt.</p>
          </div>
        </div>

        <button type="button" className="confirm-action" style={{ marginBottom: 16, width: 'auto', padding: '10px 18px' }} disabled={creating} onClick={handleCreateNew}>
          {creating ? <Loader2 className="spin-icon" size={16} /> : <FolderPlus size={16} />}
          {creating ? 'Đang tạo...' : 'Tạo dự án mới'}
        </button>

        {loading && (
          <p className="lock-note">
            <Loader2 className="spin-icon" size={16} style={{ display: 'inline', marginRight: 6 }} />
            Đang tải danh sách dự án...
          </p>
        )}
        {error && (
          <p className="lock-note">
            <AlertTriangle size={16} style={{ display: 'inline', marginRight: 4 }} />
            {error}
          </p>
        )}

        {!loading && projects.length === 0 && !error && (
          <p className="lock-note">Chưa có dự án nào — bấm "Tạo dự án mới" ở trên để bắt đầu.</p>
        )}

        {!loading && projects.length > 0 && (
          <section className="mini-panel">
            <h2 className="mini-title blue-text">
              <FolderOpen size={19} />
              {projects.length} dự án
            </h2>
            <div className="spec-items">
              {projects.map((project) => {
                const isCurrent = project.id === currentId
                return (
                  <button
                    type="button"
                    key={project.id}
                    className={isCurrent ? 'selected' : undefined}
                    disabled={switchingId !== null}
                    onClick={() => handleSwitch(project.id)}
                  >
                    <span>{switchingId === project.id ? <Loader2 className="spin-icon" size={13} /> : <Folder size={13} />}</span>
                    <strong>
                      {project.title || 'Untitled research'}
                      {isCurrent ? ' (đang dùng)' : ''}
                    </strong>
                    <small>
                      Cập nhật {formatDate(project.updatedAt)}
                      {project.latestSpec ? ` · Phiên bản ${project.latestSpec.version}` : ' · Chưa có phiên bản nào'}
                    </small>
                  </button>
                )
              })}
            </div>
          </section>
        )}

        <Link href="/" className="back-link">
          ← Về trang chủ
        </Link>
      </main>
    </div>
  )
}
