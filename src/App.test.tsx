import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
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

const organization = {
  id: 'org-1',
  name: 'Salão Exemplo',
  slug: 'salao-exemplo',
  timezone: 'America/Sao_Paulo',
  booking_min_notice_minutes: 120,
  booking_max_days_ahead: 60,
  created_at: '',
  updated_at: '',
}

function renderApp(path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  )
}

afterEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  mocks.session = null
  mocks.fetchMyOrganization.mockReset()
})

describe('App', () => {
  it('sem sessão, o painel manda para o login', () => {
    renderApp('/painel/servicos')
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
  })

  it('logado e sem estabelecimento pede o cadastro do estabelecimento', async () => {
    mocks.session = { user: { id: 'user-1' } }
    mocks.fetchMyOrganization.mockResolvedValue(null)
    renderApp('/')
    expect(
      await screen.findByRole('heading', { name: 'Cadastre seu estabelecimento' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
  })

  it('logado com estabelecimento abre o painel com o menu', async () => {
    mocks.session = { user: { id: 'user-1' } }
    mocks.fetchMyOrganization.mockResolvedValue(organization)
    renderApp('/entrar')
    expect(await screen.findByRole('heading', { name: 'Agenda' })).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Painel' })
    expect(nav).toHaveTextContent('Serviços')
    expect(screen.getByRole('link', { name: 'Agenda' })).toHaveAttribute('aria-current', 'page')
  })

  it('mostra erro com opção de tentar de novo quando o carregamento falha', async () => {
    mocks.session = { user: { id: 'user-1' } }
    mocks.fetchMyOrganization.mockRejectedValueOnce(new Error('rede')).mockResolvedValue(null)
    renderApp('/painel')
    fireEvent.click(await screen.findByRole('button', { name: 'Tentar de novo' }))
    expect(
      await screen.findByRole('heading', { name: 'Cadastre seu estabelecimento' }),
    ).toBeInTheDocument()
  })

  it('endereço desconhecido mostra página não encontrada', () => {
    renderApp('/painel-que-nao-existe/x')
    expect(screen.getByText('Página não encontrada')).toBeInTheDocument()
  })

  it('troca o tema manualmente e salva a preferência', () => {
    renderApp('/entrar')
    fireEvent.click(screen.getByRole('radio', { name: 'Escuro' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')

    fireEvent.click(screen.getByRole('radio', { name: 'Sistema' }))
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull()
  })

  it('começa com a preferência de tema salva', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')
    renderApp('/entrar')
    expect(screen.getByRole('radio', { name: 'Escuro' })).toBeChecked()
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
