import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthScreen } from './AuthScreen.tsx'

const auth = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
}))

vi.mock('../../lib/supabase.ts', () => ({ supabase: { auth } }))

function fill(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

describe('AuthScreen', () => {
  beforeEach(() => {
    auth.signInWithPassword.mockReset()
    auth.signUp.mockReset()
  })

  it('valida os campos antes de chamar o servidor', async () => {
    render(<AuthScreen />)
    fill(/E-mail/, 'nao-e-email')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByText('Informe um e-mail válido.')).toBeInTheDocument()
    expect(screen.getByText('Informe a senha.')).toBeInTheDocument()
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('mostra mensagem clara quando a senha está errada', async () => {
    auth.signInWithPassword.mockResolvedValue({
      data: {},
      error: { code: 'invalid_credentials', status: 400 },
    })
    render(<AuthScreen />)
    fill(/E-mail/, 'dono@exemplo.test')
    fill(/Senha/, 'senha-errada')
    fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'dono@exemplo.test',
      password: 'senha-errada',
    })
  })

  it('no cadastro exige senha de 8 caracteres e pede confirmação por e-mail', async () => {
    auth.signUp.mockResolvedValue({ data: { session: null, user: {} }, error: null })
    render(<AuthScreen />)
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))

    fill(/E-mail/, 'novo@exemplo.test')
    fill(/Senha/, 'curta')
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(
      await screen.findByText('A senha precisa ter pelo menos 8 caracteres.'),
    ).toBeInTheDocument()
    expect(auth.signUp).not.toHaveBeenCalled()

    fill(/Senha/, 'senha-forte-123')
    fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByRole('heading', { name: 'Confira seu e-mail' })).toBeInTheDocument()
    expect(screen.getByText('novo@exemplo.test')).toBeInTheDocument()
  })
})
