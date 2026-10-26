import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TextField } from './TextField.tsx'

describe('TextField', () => {
  it('liga o rótulo ao campo', () => {
    render(<TextField label="Nome do cliente" />)
    expect(screen.getByLabelText('Nome do cliente')).toBeInstanceOf(HTMLInputElement)
  })

  it('descreve o campo com a dica', () => {
    render(<TextField label="Telefone" hint="Opcional." />)
    expect(screen.getByLabelText('Telefone')).toHaveAccessibleDescription('Opcional.')
    expect(screen.getByLabelText('Telefone')).not.toHaveAttribute('aria-invalid')
  })

  it('marca como inválido e anuncia a mensagem de erro', () => {
    render(<TextField label="Nome" hint="Como aparece na agenda." error="Informe o nome." />)
    const input = screen.getByLabelText('Nome')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Como aparece na agenda. Informe o nome.')
  })

  it('repassa required para o campo nativo', () => {
    render(<TextField label="Nome" required />)
    expect(screen.getByLabelText(/Nome/)).toBeRequired()
  })
})
