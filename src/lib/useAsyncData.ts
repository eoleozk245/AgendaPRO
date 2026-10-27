import { useCallback, useEffect, useState } from 'react'

export type AsyncState<T> =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: T }

type Result<T> = { load: () => Promise<T>; state: AsyncState<T> }

/**
 * Carrega dados com estados de carregamento e erro. `load` precisa ser estável
 * (useCallback): quando ele muda (ex.: outro dia na agenda), volta a "carregando".
 * Já `reload()` mantém os dados atuais na tela até a nova resposta chegar.
 */
export function useAsyncData<T>(load: () => Promise<T>) {
  const [result, setResult] = useState<Result<T> | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    load()
      .then((data) => active && setResult({ load, state: { status: 'ready', data } }))
      .catch(() => active && setResult({ load, state: { status: 'error' } }))
    return () => {
      active = false
    }
  }, [load, attempt])

  const reload = useCallback(() => setAttempt((value) => value + 1), [])
  const retry = useCallback(() => {
    setResult(null)
    setAttempt((value) => value + 1)
  }, [])

  const state: AsyncState<T> = result && result.load === load ? result.state : { status: 'loading' }
  return { state, reload, retry }
}
