import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button.tsx'

describe('Button', () => {
  it('é type="button" por padrão para não enviar formulários sem querer', () => {
    render(<Button>Salvar</Button>)
    expect(screen.getByRole('button', { name: 'Salvar' })).toHaveAttribute('type', 'button')
  })

  it('chama onClick quando clicado', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Salvar</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('em carregamento fica ocupado, desabilitado e mantém o texto', () => {
    const onClick = vi.fn()
    render(
      <Button loading onClick={onClick}>
        Salvando
      </Button>,
    )
    const button = screen.getByRole('button', { name: 'Salvando' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})
