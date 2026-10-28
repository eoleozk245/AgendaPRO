import { expect, test, type Page } from '@playwright/test'
import { expectAccessibleLayout } from './support/checks.ts'
import { MANAGE_TOKEN, mockSupabase } from './support/supabase-mock.ts'

const MANAGE_PATH = `/barbearia-exemplo/meu-agendamento#${MANAGE_TOKEN}`

async function openManagePage(page: Page) {
  await page.goto(MANAGE_PATH)
  await expect(page.getByRole('heading', { level: 1, name: 'Seu agendamento' })).toBeVisible()
  await expect(page.getByText('Aguardando confirmação')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await mockSupabase(page)
})

test('a confirmação da reserva leva ao link do agendamento', async ({ page }) => {
  await page.goto('/barbearia-exemplo')
  await page.locator('label', { hasText: 'Corte de cabelo' }).click()
  await page
    .locator('label')
    .filter({ has: page.locator('input[name="date"]') })
    .nth(1)
    .click()
  await page.locator('label', { hasText: /^09:00$/ }).click()
  await page.getByLabel(/Seu nome/).fill('Cliente Exemplo')
  await page.getByLabel(/Telefone/).fill('11987654321')
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click()

  await expect(page.getByRole('heading', { name: 'Seu link do agendamento' })).toBeVisible()
  await expect(page.getByLabel('Link', { exact: true })).toHaveValue(
    new RegExp(`#${MANAGE_TOKEN}$`),
  )
  await expectAccessibleLayout(page)

  await page.getByRole('link', { name: 'Abrir meu agendamento' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Seu agendamento' })).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/barbearia-exemplo/meu-agendamento#${MANAGE_TOKEN}$`))
})

test('remarca pelo link', async ({ page }) => {
  await openManagePage(page)
  await expectAccessibleLayout(page)
  await page.getByRole('button', { name: 'Remarcar' }).click()
  await expect(page.getByRole('heading', { name: 'Escolha o novo horário' })).toBeFocused()
  await page
    .locator('label')
    .filter({ has: page.locator('input[name="date"]') })
    .nth(1)
    .click()
  await page.locator('label', { hasText: /^09:15$/ }).click()
  await expectAccessibleLayout(page)
  await page.getByRole('button', { name: 'Confirmar novo horário' }).click()
  await expect(page.getByText(/^Horário alterado para .* às 09:15\.$/)).toBeVisible()
})

test('cancela pelo link', async ({ page }) => {
  await openManagePage(page)
  await page.getByRole('button', { name: 'Cancelar agendamento' }).click()
  const dialog = page.getByRole('dialog', { name: 'Cancelar agendamento' })
  await expect(dialog).toBeVisible()
  await expectAccessibleLayout(page)
  await dialog.getByRole('button', { name: 'Sim, cancelar' }).click()
  await expect(dialog).toBeHidden()
  await expect(page.getByText(/^Agendamento cancelado\./)).toBeVisible()
})

test('link sem código ou com código errado avisa que é inválido', async ({ page }) => {
  await page.goto('/barbearia-exemplo/meu-agendamento')
  await expect(page.getByRole('heading', { level: 1, name: 'Link inválido' })).toBeVisible()
  await expectAccessibleLayout(page)
  await page.goto(`/barbearia-exemplo/meu-agendamento#${'x'.repeat(43)}`)
  await expect(page.getByRole('heading', { level: 1, name: 'Link inválido' })).toBeVisible()
})

test.describe('no celular, tema escuro', () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })

  test('a página do link cabe na tela', async ({ page }) => {
    await openManagePage(page)
    await expectAccessibleLayout(page)
    await page.getByRole('button', { name: 'Remarcar' }).click()
    await expectAccessibleLayout(page)
  })
})
