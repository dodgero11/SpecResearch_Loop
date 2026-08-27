'use client'

import { useState } from 'react'
import { GitBranch } from 'lucide-react'
import { Header } from '@/components/research-loop/header'
import { Toolbar } from './toolbar'
import { IdeaCard } from './card'
import { AddCardForm } from './add-card-form'
import { CreativePanel } from './creative-panel'
import { GraphView } from './graph-view'
import { ProgressSummary } from './progress-summary'
import { initialCards, type CardStatus, type DecompositionCard } from './data'

export default function StepTwo() {
  const [cards, setCards] = useState(initialCards)
  const [graphMode, setGraphMode] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)

  function changeStatus(id: string, status: CardStatus) {
    setCards((items) => items.map((item) => (item.id === id ? { ...item, status } : item)))
  }

  function editCardContent(id: string, content: string) {
    setCards((items) => items.map((item) => (item.id === id ? { ...item, content } : item)))
  }

  function editReason(id: string, reason: string) {
    setCards((items) => items.map((item) => (item.id === id ? { ...item, reason } : item)))
  }

  function deleteCard(id: string) {
    setCards((items) => items.filter((item) => item.id !== id))
  }

  function toggleLink(cardId: string, targetId: string) {
    setCards((items) =>
      items.map((item) => {
        if (item.id === cardId) {
          const linked = item.linkedIds.includes(targetId)
          return {
            ...item,
            linkedIds: linked ? item.linkedIds.filter((id) => id !== targetId) : [...item.linkedIds, targetId],
          }
        }
        if (item.id === targetId) {
          const linked = item.linkedIds.includes(cardId)
          return {
            ...item,
            linkedIds: linked ? item.linkedIds.filter((id) => id !== cardId) : [...item.linkedIds, cardId],
          }
        }
        return item
      }),
    )
  }

  function addCard(newCard: Pick<DecompositionCard, 'type' | 'content'>) {
    setCards((items) => {
      const created: DecompositionCard = {
        id: crypto.randomUUID(),
        type: newCard.type,
        content: newCard.content,
        status: 'PROPOSED',
        isSeed: false,
        linkedIds: [],
        reason: '',
      }
      const lastSameTypeIndex = items.reduce(
        (lastIndex, item, index) => (item.type === newCard.type ? index : lastIndex),
        -1,
      )
      if (lastSameTypeIndex === -1) return [...items, created]
      const next = [...items]
      next.splice(lastSameTypeIndex + 1, 0, created)
      return next
    })
    setShowAddForm(false)
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
      </main>
    </div>
  )
}
