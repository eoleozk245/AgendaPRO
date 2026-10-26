import { useCallback, useEffect, useState } from 'react'
import type { Organization } from '../../lib/database.types.ts'
import { fetchMyOrganization } from './api.ts'

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; organization: Organization | null }

export function useMyOrganization(userId: string) {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    fetchMyOrganization()
      .then((organization) => active && setState({ status: 'ready', organization }))
      .catch(() => active && setState({ status: 'error' }))
    return () => {
      active = false
    }
  }, [userId, attempt])

  const reload = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  const setOrganization = useCallback((organization: Organization) => {
    setState({ status: 'ready', organization })
  }, [])

  return { state, reload, setOrganization }
}
