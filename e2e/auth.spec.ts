import { expect, test } from '@playwright/test'
import { expectAccessibleLayout } from './support/checks.ts'
import { mockSupabase } from './support/supabase-mock.ts'

test.beforeEach(async ({ page }) => {
  await mockSupabase(page)
})

test('tela de login renderiza acessível', async ({ page }) => {
  await page.goto('/entrar')
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  await expectAccessibleLayout(page)
})

test('senha errada mostra mensagem clara', async ({ page }) => {
  await page.goto('/entrar')
  await page.getByLabel('E-mail').fill('dono@exemplo.test')
  await page.getByLabel(/Senha/).fill('senha-errada')
  await page.getByRole('button', { name: 'Entrar' }).click()
  await expect(page.getByRole('alert')).toHaveText('E-mail ou senha incorretos.')
  await expectAccessibleLayout(page)
})

test('painel sem sessão manda para o login', async ({ page }) => {
  await page.goto('/painel/servicos')
  await expect(page).toHaveURL(/\/entrar$/)
  await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible()
  await expectAccessibleLayout(page)
})
