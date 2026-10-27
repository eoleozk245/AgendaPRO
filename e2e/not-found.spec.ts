import { expect, test } from '@playwright/test'
import { expectAccessibleLayout } from './support/checks.ts'
import { mockSupabase } from './support/supabase-mock.ts'

test('endereço público desconhecido mostra aviso', async ({ page }) => {
  await mockSupabase(page, { page: null })
  await page.goto('/nao-existe')
  await expect(page.getByText('Página de agendamento não encontrada')).toBeVisible()
  await expectAccessibleLayout(page)
})

test('rota interna desconhecida mostra página não encontrada', async ({ page }) => {
  await mockSupabase(page)
  await page.goto('/painel-antigo/qualquer-coisa')
  await expect(page.getByText('Página não encontrada')).toBeVisible()
  await expectAccessibleLayout(page)
})
