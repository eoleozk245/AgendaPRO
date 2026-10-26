import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import { AuthProvider } from './features/auth/AuthProvider.tsx'
import { THEME_STORAGE_KEY } from './lib/theme.ts'

const mocks = vi.hoisted(() => ({
  session: null as null | { user: { id: string } },
  fetchMyOrganization: vi.fn(),
}))

vi.mock('./lib/supabase.ts', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (callback: (event: string, session: unknown) => void) => {
        callback('INITIAL_SESSION', mocks.session)
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
      signOut: vi.fn(),
    },
  },
}))

vi.mock('./features/organization/api.ts', () => ({
  fetchMyOrganization: mocks.fetchMyOrganization,
  createOrganization: vi.fn(),
}))

function renderApp() {
  return render(
    <AuthProvider>
      <App />
    </AuthProvider>,
  )
}

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  mocks.session = null
  mocks.fetchMyOrganization.mockReset()
})

describe('App', () => {
  it('sem sessão mostra o login', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
  })

  it('logado e sem estabelecimento pede o cadastro do estabelecimento', async () => {
    mocks.session = { user: { id: 'user-1' } }
    mocks.fetchMyOrganization.mockResolvedValue(null)
    renderApp()
    expect(
      await screen.findByRole('heading', { name: 'Cadastre seu estabelecimento' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
  })

  it('logado com estabelecimento mostra o painel', async () => {
    mocks.session = { user: { id: 'user-1' } }
    mocks.fetchMyOrganization.mockResolvedValue({ name: 'Salão Exemplo', slug: 'salao-exemplo' })
    renderApp()
    expect(await screen.findByRole('heading', { name: 'Salão Exemplo' })).toBeInTheDocument()
  })

  it('mostra erro com opção de tentar de novo quando o carregamento falha', async () => {
    mocks.session = { user: { id: 'user-1' } }
    mocks.fetchMyOrganization.mockRejectedValueOnce(new Error('rede')).mockResolvedValue(null)
    renderApp()
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }))
    expect(
      await screen.findByRole('heading', { name: 'Cadastre seu estabelecimento' }),
    ).toBeInTheDocument()
  })

  it('troca o tema manualmente e salva a preferência', () => {
    renderApp()
    fireEvent.click(screen.getByRole('radio', { name: 'Escuro' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    fireEvent.click(screen.getByRole('radio', { name: 'Sistema' }))
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('começa com a preferência de tema salva', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    renderApp()
    expect(screen.getByRole('radio', { name: 'Escuro' })).toBeChecked()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
