import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from './App.tsx'
import { THEME_STORAGE_KEY } from './lib/theme.ts'

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
})

describe('App', () => {
  it('mostra a marca e o seletor de tema', () => {
    render(<App />)
    expect(screen.getByText('AgendaPRO')).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Tema' })).toBeInTheDocument()
  })

  it('troca o tema manualmente e salva a preferência', () => {
    render(<App />)
    fireEvent.click(screen.getByRole('radio', { name: 'Escuro' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    fireEvent.click(screen.getByRole('radio', { name: 'Sistema' }))
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('começa com a preferência salva', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    render(<App />)
    expect(screen.getByRole('radio', { name: 'Escuro' })).toBeChecked()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
