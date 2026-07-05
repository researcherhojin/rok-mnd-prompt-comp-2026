import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from './api'
import type { Problem, SubmitResult } from './types'

interface Store {
  problem: Problem | null
  problemError: string | null
  lastSubmit: SubmitResult | null
  setLastSubmit: (s: SubmitResult) => void
  participants: number | null
  refreshParticipants: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [problem, setProblem] = useState<Problem | null>(null)
  const [problemError, setProblemError] = useState<string | null>(null)
  const [lastSubmit, setLastSubmit] = useState<SubmitResult | null>(null)
  const [participants, setParticipants] = useState<number | null>(null)

  const refreshParticipants = () => {
    api
      .leaderboard()
      .then((l) => setParticipants(l.count))
      .catch(() => {})
  }

  useEffect(() => {
    api
      .problem()
      .then(setProblem)
      .catch((e) => setProblemError(e instanceof Error ? e.message : String(e)))
    refreshParticipants()
  }, [])

  return (
    <Ctx.Provider
      value={{ problem, problemError, lastSubmit, setLastSubmit, participants, refreshParticipants }}
    >
      {children}
    </Ctx.Provider>
  )
}

export function useStore(): Store {
  const c = useContext(Ctx)
  if (!c) throw new Error('useStore must be used within StoreProvider')
  return c
}
