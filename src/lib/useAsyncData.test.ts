import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAsyncData } from './useAsyncData.ts'

describe('useAsyncData', () => {
  it('vai de carregando para pronto', async () => {
    const load = vi.fn().mockResolvedValue(['a'])
    const { result } = renderHook(() => useAsyncData(load))
    expect(result.current.state.status).toBe('loading')
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', data: ['a'] }))
  })

  it('mostra erro e recupera com retry', async () => {
    const load = vi.fn().mockRejectedValueOnce(new Error('rede')).mockResolvedValue(['ok'])
    const { result } = renderHook(() => useAsyncData(load))
    await waitFor(() => expect(result.current.state.status).toBe('error'))
    act(() => result.current.retry())
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', data: ['ok'] }))
  })

  it('ao trocar a fonte (outro dia), não mostra dados antigos', async () => {
    const day1 = vi.fn().mockResolvedValue(['dia 1'])
    const day2 = vi.fn(() => new Promise<string[]>(() => {}))
    const { result, rerender } = renderHook(({ load }) => useAsyncData(load), {
      initialProps: { load: day1 as () => Promise<string[]> },
    })
    await waitFor(() => expect(result.current.state.status).toBe('ready'))
    rerender({ load: day2 })
    expect(result.current.state.status).toBe('loading')
  })

  it('reload mantém os dados na tela enquanto busca de novo', async () => {
    let resolveSecond: (value: string[]) => void = () => {}
    const load = vi
      .fn()
      .mockResolvedValueOnce(['v1'])
      .mockImplementationOnce(() => new Promise<string[]>((resolve) => (resolveSecond = resolve)))
    const { result } = renderHook(() => useAsyncData(load))
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', data: ['v1'] }))
    act(() => result.current.reload())
    expect(result.current.state).toEqual({ status: 'ready', data: ['v1'] })
    act(() => resolveSecond(['v2']))
    await waitFor(() => expect(result.current.state).toEqual({ status: 'ready', data: ['v2'] }))
  })
})
