'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Loader2, Search } from 'lucide-react'
import { Header } from '@/components/research-loop/header'
import { apiDelete, apiGet, apiPost } from '@/lib/api'
import { getProjectId } from '@/lib/project'
import { KeywordPanel } from './keyword-panel'
import { SourcesPanel } from './sources-panel'
import { RelatedTable } from './related-table'
import { GapPanel } from './gap-panel'
import { ConflictPanel } from './conflict-panel'
import { ProgressSummary } from './progress-summary'
import { PRIORITY_SOURCES, type Conflict, type GapAnalysisResult, type RelatedWork, type SourceType } from './data'

type RawRelatedWork = {
  id?: string
  paper_title?: string
  authors?: string
  year?: number | string
  what_they_did?: string
  feedback?: string
  missing_points?: string
  source_url?: string
  source_type?: string
}

function toRelatedWork(raw: RawRelatedWork, index: number): RelatedWork {
  return {
    // Prefer BE's real id once it assigns one; fall back to a synthesized key for older data that predates it.
    id: raw.id ?? raw.source_url ?? `${raw.paper_title ?? 'work'}-${index}`,
    name: raw.paper_title ?? '(chưa có tên)',
    year: String(raw.year ?? ''),
    whatItDid: raw.what_they_did ?? '',
    feedbackType: raw.feedback ?? '',
    missingGap: raw.missing_points ?? '',
    url: raw.source_url ?? '#',
    sourceType: raw.source_type ?? '',
  }
}

export default function StepThree() {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectChecked, setProjectChecked] = useState(false)

  const [relatedWorks, setRelatedWorks] = useState<RelatedWork[]>([])
  const [cardContentById, setCardContentById] = useState<Record<string, string>>({})
  const [gapAnalysis, setGapAnalysis] = useState<GapAnalysisResult | null>(null)
  const [conflicts, setConflicts] = useState<Conflict[]>([])

  const [keywordFilter, setKeywordFilter] = useState<string[]>([])
  const [activeSources, setActiveSources] = useState<SourceType[]>(PRIORITY_SOURCES.map((s) => s.key))

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setProjectId(getProjectId())
    setProjectChecked(true)
  }, [])

  async function loadCards(pid: string) {
    const data = await apiGet<{ cards: Array<{ id: string; content: string }> }>(`/projects/${pid}/cards`)
    setCardContentById(Object.fromEntries(data.cards.map((c) => [c.id, c.content])))
  }

  /**
   * Fetches related work (cached server-side), then recomputes gap analysis + conflicts.
   * `forceRegenerateGap` should only be true right after the related-work list actually
   * changed (add/remove) — otherwise this re-reads the gap analysis already saved, so a
   * plain page revisit doesn't wipe out the direction you already selected (gap-analysis
   * always overwrites its `directions` fresh, losing the `selected` flag).
   */
  async function loadResearchData(pid: string, opts?: { forceRegenerateGap?: boolean }) {
    const relatedRes = await apiGet<{ results: RawRelatedWork[] }>(`/projects/${pid}/related-works`)
    setRelatedWorks(relatedRes.results.map(toRelatedWork))

    let gap: GapAnalysisResult | undefined
    if (!opts?.forceRegenerateGap) {
      const summary = await apiGet<{ latestSpec: { data: Record<string, unknown> } | null }>(`/projects/${pid}/summary`)
      const existing = summary.latestSpec?.data?.gapAnalysis as GapAnalysisResult | undefined
      if (existing && existing.directions?.length > 0) gap = existing
    }
    if (!gap) gap = await apiPost<GapAnalysisResult>(`/projects/${pid}/gap-analysis`)
    setGapAnalysis(gap)

    const conflictRes = await apiPost<{ conflicts: Conflict[] }>(`/projects/${pid}/conflicts/check`)
    setConflicts(conflictRes.conflicts)
  }

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    // Sequential, not parallel: every mutation clones cards to new ids, so cards
    // must be fetched AFTER conflicts/check settles — otherwise cardContentById
    // can hold stale ids that no longer match conflict.claimCardId/evidenceCardId.
    loadResearchData(projectId)
      .then(() => loadCards(projectId))
      .catch((err) => setError(err instanceof Error ? err.message : 'Không tải được dữ liệu nghiên cứu.'))
      .finally(() => setLoading(false))
  }, [projectId])

  function handleSearch(terms: string[]) {
    // Replaces the active filter entirely — searching again starts a fresh query
    // instead of stacking onto old keywords, which was confusing (old 1-letter
    // keywords kept matching almost everything, hiding what the new search found).
    setKeywordFilter(terms)
  }

  function handleRemoveKeyword(keyword: string) {
    setKeywordFilter((prev) => prev.filter((item) => item !== keyword))
  }

  function handleClearKeywords() {
    setKeywordFilter([])
  }

  function handleToggleSource(source: SourceType) {
    setActiveSources((prev) => (prev.includes(source) ? prev.filter((item) => item !== source) : [...prev, source]))
  }

  /** Manually adding a work saves it, then re-derives gap analysis + conflicts from the updated list. */
  async function handleAddWork(work: {
    name: string
    year: string
    whatItDid: string
    feedbackType: string
    missingGap: string
    url: string
    sourceType: string
  }) {
    if (!projectId) return
    setError(null)
    try {
      await apiPost(`/projects/${projectId}/related-works`, {
        title: work.name,
        sourceUrl: work.url || undefined,
        year: work.year || undefined,
        whatItDid: work.whatItDid || undefined,
        feedbackType: work.feedbackType || undefined,
        missingGap: work.missingGap || undefined,
        sourceType: work.sourceType || undefined,
      })
      await loadResearchData(projectId, { forceRegenerateGap: true })
      await loadCards(projectId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm nghiên cứu thất bại, thử lại.')
      throw err
    }
  }

  /** Removes a related work, then re-derives gap analysis + conflicts from the updated list. */
  async function handleRemoveWork(workId: string) {
    if (!projectId) return
    setError(null)
    try {
      await apiDelete(`/projects/${projectId}/related-works/${workId}`)
      await loadResearchData(projectId, { forceRegenerateGap: true })
      await loadCards(projectId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xóa nghiên cứu thất bại, thử lại.')
    }
  }

  async function handleSelectDirection(letter: string, customDirection?: string) {
    if (!projectId || !gapAnalysis) return
    const result = await apiPost<{ selected: string; directions: GapAnalysisResult['directions'] }>(
      `/projects/${projectId}/gap-analysis/select`,
      { letter, customDirection },
    )
    setGapAnalysis({ ...gapAnalysis, directions: result.directions })
  }

  async function handleResolveConflict(conflictId: string, choice: string, customResolution?: string) {
    if (!projectId) return
    await apiPost(`/projects/${projectId}/conflicts/${conflictId}/resolve`, { choice, customResolution })
    setConflicts((prev) => prev.filter((c) => c.id !== conflictId))
  }

  // Split each keyword phrase into individual words so "tối ưu bằng search" still
  // matches content containing just "search" or "bằng", not only that exact phrase.
  const filterWords = keywordFilter.flatMap((term) => term.toLowerCase().split(/\s+/)).filter(Boolean)
  const filteredByKeywords =
    filterWords.length === 0
      ? relatedWorks
      : relatedWorks.filter((work) => {
          const haystack = `${work.name} ${work.whatItDid} ${work.feedbackType} ${work.missingGap}`.toLowerCase()
          return filterWords.some((word) => haystack.includes(word))
        })
  const visibleResults = filteredByKeywords.filter((work) => activeSources.includes(work.sourceType))

  const hasDirection = Boolean(gapAnalysis?.directions.some((d) => d.selected))
  const hasConflictResolved = conflicts.length === 0

  return (
    <div className="app-shell">
      <Header />
      <main className="content" id="related-research">
        <div className="page-heading">
          <span className="hero-icon">
            <Search size={42} />
          </span>
          <div>
            <h1>
              <span>3.</span> Nghiên cứu liên quan &amp; tìm Research Gap
            </h1>
            <p>Đối sánh các công trình liên quan, rút ra khoảng trống nghiên cứu và các hướng khả thi.</p>
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
            Đang tìm nghiên cứu liên quan...
          </p>
        )}
        {error && <p className="lock-note">{error}</p>}

        {projectId && !loading && (
          <>
            <div className="related-grid">
              <section className="research-sidebar">
                <KeywordPanel
                  keywords={keywordFilter}
                  searching={false}
                  onSearch={handleSearch}
                  onRemoveKeyword={handleRemoveKeyword}
                  onClearAll={handleClearKeywords}
                />
                <SourcesPanel activeSources={activeSources} onToggle={handleToggleSource} />
              </section>
              <RelatedTable results={visibleResults} searching={false} hasSearched onAddWork={handleAddWork} onRemoveWork={handleRemoveWork} />
              <GapPanel gapAnalysis={gapAnalysis} onSelectDirection={handleSelectDirection} />
            </div>

            <ConflictPanel conflicts={conflicts} cardContentById={cardContentById} onResolve={handleResolveConflict} />

            <ProgressSummary hasResults={visibleResults.length > 0} hasDirection={hasDirection} hasConflictResolved={hasConflictResolved} />
          </>
        )}

        <Link href="/step-2" className="back-link">
          ← Quay lại bước 2
        </Link>
      </main>
    </div>
  )
}
