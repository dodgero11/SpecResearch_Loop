import { CircleDot } from 'lucide-react'
import { formatCardType } from '@/lib/spec-card-format'
import type { DecompositionCard } from './data'

const WIDTH = 760
const HEIGHT = 460
const RADIUS = 180
const CENTER_X = WIDTH / 2
const CENTER_Y = HEIGHT / 2

function nodePosition(index: number, total: number) {
  const angle = (index / total) * Math.PI * 2 - Math.PI / 2
  return {
    x: CENTER_X + RADIUS * Math.cos(angle),
    y: CENTER_Y + RADIUS * Math.sin(angle),
  }
}

type GraphViewProps = {
  cards: DecompositionCard[]
}

export function GraphView({ cards }: GraphViewProps) {
  const positions = new Map(cards.map((card, index) => [card.id, nodePosition(index, cards.length)]))

  const seenPairs = new Set<string>()
  const edges: { from: string; to: string }[] = []
  cards.forEach((card) => {
    card.linkedIds.forEach((targetId) => {
      if (!positions.has(targetId)) return
      const key = [card.id, targetId].sort().join('|')
      if (seenPairs.has(key)) return
      seenPairs.add(key)
      edges.push({ from: card.id, to: targetId })
    })
  })

  return (
    <div className="graph-canvas">
      <div className="graph-canvas-inner">
        <svg width={WIDTH} height={HEIGHT} className="graph-edges">
          {edges.map((edge) => {
            const from = positions.get(edge.from)!
            const to = positions.get(edge.to)!
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke="#6940df"
                strokeWidth={2}
                strokeDasharray="6 4"
              />
            )
          })}
        </svg>
        {cards.map((card) => {
          const pos = positions.get(card.id)!
          return (
            <div
              key={card.id}
              className={`graph-node status-${card.status.toLowerCase()}`}
              style={{ left: pos.x, top: pos.y }}
              title={card.content}
            >
              <CircleDot size={12} />
              <span>{formatCardType(card.type)}</span>
            </div>
          )
        })}
        {edges.length === 0 && <p className="graph-empty">Chưa có liên kết Claim–Evidence nào để hiển thị.</p>}
      </div>
    </div>
  )
}
