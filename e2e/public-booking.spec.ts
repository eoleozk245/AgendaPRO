import { expect, test, type Page } from '@playwright/test'
import { expectAccessibleLayout } from './support/checks.ts'
import { mockSupabase } from './support/supabase-mock.ts'

async function bookTomorrow(page: Page) {
  await page.goto('/barbearia-exemplo')
  await expect(page.getByRole('heading', { name: 'Agende seu horário' })).toBeVisible()

  // Os rádios ficam escondidos visualmente; quem clica de verdade clica no rótulo.
  await page.locator('label', { hasText: 'Corte de cabelo' }).click()
  await expect(page.getByRole('radio', { name: /Corte de cabelo/ })).toBeChecked()

  const dateLabels = page.locator('label').filter({ has: page.locator('input[name="date"]') })
  await dateLabels.nth(1).click()

  await page.locator('label', { hasText: /^09:00$/ }).click()
  await expect(page.getByRole('radio', { name: '09:00' })).toBeChecked()

  await page.getByLabel(/Seu nome/).fill('Cliente Exemplo')
  await page.getByLabel(/Telefone/).fill('11987654321')
  await expect(page.getByLabel(/Telefone/)).toHaveValue('(11) 98765-4321')
  await expectAccessibleLayout(page)

  await page.getByRole('button', { name: 'Confirmar agendamento' }).click()
  const heading = page.getByRole('heading', { name: 'Pedido de agendamento enviado' })
  await expect(heading).toBeVisible()
  await expect(heading).toBeFocused()
  await expect(page.getByText('Aguardando confirmação')).toBeVisible()
  await expectAccessibleLayout(page)
}

test.beforeEach(async ({ page }) => {
  await mockSupabase(page)
})

test('reserva pela página pública no computador', async ({ page }) => {
  await bookTomorrow(page)
})

test.describe('no celular, tema escuro', () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })

  test('reserva pela página pública', async ({ page }) => {
    await bookTomorrow(page)
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  })
})

test('validação aparece antes de enviar', async ({ page }) => {
  await page.goto('/barbearia-exemplo')
  await page.locator('label', { hasText: 'Corte de cabelo' }).click()
  await page
    .locator('label')
    .filter({ has: page.locator('input[name="date"]') })
    .nth(1)
    .click()
  await page.locator('label', { hasText: /^09:30$/ }).click()
  await page.getByRole('button', { name: 'Confirmar agendamento' }).click()
  await expect(page.getByText('Informe seu nome.')).toBeVisible()
  await expectAccessibleLayout(page)
})
