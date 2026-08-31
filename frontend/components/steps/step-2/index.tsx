'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { GitBranch, Loader2 } from 'lucide-react'
import { Header } from '@/components/research-loop/header'
import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api'
import { getProjectId } from '@/lib/project'
import { Toolbar } from './toolbar'
import { IdeaCard } from './card'
import { AddCardForm } from './add-card-form'
import { CreativePanel } from './creative-panel'
import { GraphView } from './graph-view'
import { ProgressSummary } from './progress-summary'
import { type CardStatus, type DecompositionCard, type SpecCardLink } from './data'

type CardsResponse = {
  cards: Array<{ id: string; type: string; content: string; status: CardStatus; isSeed: boolean; reason: string | null }>
  links: SpecCardLink[]
}

/** Turns the raw {cards, links} the backend returns into the DecompositionCard shape the UI renders. */
function toDecompositionCards(data: CardsResponse): DecompositionCard[] {
  return data.cards.map((card) => {
    const linkedIds = data.links
      .filter((link) => link.sourceCardId === card.id || link.targetCardId === card.id)
      .map((link) => (link.sourceCardId === card.id ? link.targetCardId : link.sourceCardId))
    return {
      id: card.id,
      type: card.type,
      content: card.content,
      status: card.status,
      isSeed: card.isSeed,
      reason: card.reason ?? '',
      linkedIds,
    }
  })
}

export default function StepTwo() {
  const [projectId, setProjectId] = useState<string | null>(null)
  const [projectChecked, setProjectChecked] = useState(false)
  const [cards, setCards] = useState<DecompositionCard[]>([])
  const [links, setLinks] = useState<SpecCardLink[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [graphMode, setGraphMode] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    setProjectId(getProjectId())
    setProjectChecked(true)
  }, [])

  async function refetch(pid: string) {
    const data = await apiGet<CardsResponse>(`/projects/${pid}/cards`)
    setLinks(data.links)
    setCards(toDecompositionCards(data))
  }

  useEffect(() => {
    if (!projectId) return
    setLoading(true)
    setError(null)
    refetch(projectId)
      .catch((err) => setError(err instanceof Error ? err.message : 'Không tải được danh sách thẻ.'))
      .finally(() => setLoading(false))
  }, [projectId])

  async function withRefetch(action: () => Promise<unknown>) {
    if (!projectId) return
    setError(null)
    try {
      await action()
      await refetch(projectId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại, thử lại.')
    }
  }

  function changeStatus(id: string, status: CardStatus) {
    void withRefetch(() => apiPut(`/projects/${projectId}/cards/${id}`, { status }))
  }

  function editCardContent(id: string, content: string) {
    void withRefetch(() => apiPut(`/projects/${projectId}/cards/${id}`, { content }))
  }

  function editReason(id: string, reason: string) {
    void withRefetch(() => apiPut(`/projects/${projectId}/cards/${id}`, { reason }))
  }

  function deleteCard(id: string) {
    void withRefetch(() => apiDelete(`/projects/${projectId}/cards/${id}`))
  }

  function toggleLink(cardId: string, targetId: string) {
    const existing = links.find(
      (link) =>
        (link.sourceCardId === cardId && link.targetCardId === targetId) ||
        (link.sourceCardId === targetId && link.targetCardId === cardId),
    )
    if (existing) {
      void withRefetch(() => apiDelete(`/projects/${projectId}/card-links/${existing.id}`))
    } else {
      void withRefetch(() =>
        apiPost(`/projects/${projectId}/card-links`, { sourceCardId: cardId, targetCardId: targetId, type: 'CLAIM_EVIDENCE' }),
      )
    }
  }

  async function addCard(newCard: Pick<DecompositionCard, 'type' | 'content'>) {
    if (!projectId) return
    setError(null)
    try {
      await apiPost(`/projects/${projectId}/cards`, { type: newCard.type, content: newCard.content })
      await refetch(projectId)
      setShowAddForm(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thêm thẻ thất bại, thử lại.')
      throw err // let AddCardForm know not to clear what the user typed
    }
  }

  return (
    <div className="app-shell">
      <Header />
      <main className="content" id="decomposition">
        <div className="page-heading">
          <span className="hero-icon">
            <GitBranch size={42} />
          </span>
          <div>
            <h1>
              <span>2.</span> Phân rã ý tưởng
            </h1>
            <p>Hệ thống tách ý tưởng thành các thẻ nhỏ để kiểm tra, liên kết và hoàn thiện đặc tả.</p>
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
            Đang tải thẻ...
          </p>
        )}
        {error && <p className="lock-note">{error}</p>}

        {projectId && !loading && (
          <>
            <Toolbar
              cardCount={cards.length}
              graphMode={graphMode}
              onToggleGraph={() => setGraphMode((value) => !value)}
              onAddCardClick={() => setShowAddForm((value) => !value)}
            />

            {showAddForm && <AddCardForm onSubmit={addCard} onCancel={() => setShowAddForm(false)} />}

            {graphMode ? (
              <GraphView cards={cards} />
            ) : (
              <section className="cards-grid">
                {cards.map((card) => (
                  <IdeaCard
                    card={card}
                    allCards={cards}
                    key={card.id}
                    onStatusChange={(status) => changeStatus(card.id, status)}
                    onDelete={() => deleteCard(card.id)}
                    onEditContent={(content) => editCardContent(card.id, content)}
                    onToggleLink={(targetId) => toggleLink(card.id, targetId)}
                    onReasonChange={(reason) => editReason(card.id, reason)}
                  />
                ))}
              </section>
            )}

            <CreativePanel />

            <ProgressSummary cards={cards} />
          </>
        )}
      </main>
    </div>
  )
}
