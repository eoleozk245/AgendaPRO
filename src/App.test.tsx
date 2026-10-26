import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App.tsx'

describe('App', () => {
  it('mostra o nome do produto como título principal', () => {
    render(<App />)
    expect(screen.getByRole('heading', { level: 1, name: 'AgendaPRO' })).toBeInTheDocument()
  })
})
