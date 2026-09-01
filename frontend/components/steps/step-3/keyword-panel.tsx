'use client'

import { useState, type FormEvent } from 'react'
import { Search } from 'lucide-react'

type KeywordPanelProps = {
  keywords: string[]
  searching: boolean
  onSearch: (keywords: string[]) => void
  onRemoveKeyword: (keyword: string) => void
  onClearAll: () => void
}

export function KeywordPanel({ keywords, searching, onSearch, onRemoveKeyword, onClearAll }: KeywordPanelProps) {
  const [query, setQuery] = useState('')

  function addToQuery(keyword: string) {
    setQuery((prev) => {
      const parts = prev
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
      if (parts.includes(keyword)) return prev
      return [...parts, keyword].join(', ')
    })
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const typed = query
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
    if (typed.length === 0) return
    onSearch(typed)
    setQuery('')
  }

  return (
    <div className="mini-panel">
      <h2 className="mini-title blue-text">
        <Search size={17} />
        Từ khóa &amp; kế hoạch tìm kiếm
      </h2>
      <form className="search-field" onSubmit={handleSubmit}>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nhập từ khóa hoặc truy vấn tìm kiếm..."
          aria-label="Từ khóa tìm kiếm"
        />
        <button type="submit" aria-label="Tìm kiếm" disabled={searching}>
          <Search size={16} />
        </button>
      </form>
      <div className="keyword-list">
        {keywords.map((keyword) => (
          <span className="keyword-chip" key={keyword}>
            <button type="button" className="keyword-label" onClick={() => addToQuery(keyword)}>
              {keyword}
            </button>
            <button
              type="button"
              className="keyword-remove"
              onClick={() => onRemoveKeyword(keyword)}
              aria-label={`Xóa từ khóa ${keyword}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      {keywords.length > 0 && (
        <button type="button" className="keyword-clear-all" onClick={onClearAll}>
          Xóa bộ lọc — xem tất cả
        </button>
      )}
    </div>
  )
}
