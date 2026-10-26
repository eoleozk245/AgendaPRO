import { useCallback, useEffect, useState } from 'react'

export type AsyncState<T> =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T }

/**
 * Carrega dados com estados de carregamento e erro. `load` precisa ser estável
 * (useCallback). Ao recarregar, os dados atuais continuam na tela até chegar a resposta.
 */
export function useAsyncData<T>(load: () => Promise<T>) {
  const [state, setState] = useState<AsyncState<T>>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    load()
      .then((data) => active && setState({ status: 'ready', data }))
      .catch(() => active && setState({ status: 'error' }))
    return () => {
      active = false
    }
  }, [load, attempt])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])
  const retry = useCallback(() => {
    setState({ status: 'loading' })
    setAttempt((value) => value + 1)
  }, [])

  return { state, reload, retry }
}
