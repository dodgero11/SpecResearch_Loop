const STORAGE_KEY = 'specresearch:projectId'

/** Reads the current project id from localStorage. Returns null on the server or if none is set yet. */
export function getProjectId(): string | null {
  if (typeof window === 'undefined') return null
  return window.localStorage.getItem(STORAGE_KEY)
}

export function setProjectId(id: string): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, id)
}

/** Forgets the current project id so the next visit to Bước 1 starts a brand-new project. */
export function clearProjectId(): void {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}
