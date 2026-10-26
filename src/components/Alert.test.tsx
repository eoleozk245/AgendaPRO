import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Alert } from './Alert.tsx'

describe('Alert', () => {
  it('erros usam role="alert" para o leitor de tela anunciar na hora', () => {
    render(<Alert tone="error" title="Horário indisponível" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Horário indisponível')
  })

  it('sucesso e informação usam role="status"', () => {
    render(<Alert tone="success" title="Salvo" />)
    expect(screen.getByRole('status')).toHaveTextContent('Salvo')
  })
})
