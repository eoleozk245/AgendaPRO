import { expect, test } from '@playwright/test'
import { expectAccessibleLayout } from './support/checks.ts'
import { mockSupabase, signIn } from './support/supabase-mock.ts'

test.beforeEach(async ({ page }) => {
  await mockSupabase(page)
  await signIn(page)
})

test('agenda do dia mostra os estados e os cancelados à parte', async ({ page }) => {
  await page.goto('/painel')
  await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible()
  await expect(
    page.getByRole('button', {
      name: '10:00–11:00 Cliente Exemplo Dois · Corte de cabelo Confirmado',
    }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /09:00–09:30 Cliente Exemplo Um/ })).toBeVisible()
  await expect(page.getByRole('button', { name: /14:00–14:30 Cliente removido/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Cancelados neste dia' })).toBeVisible()
  await expectAccessibleLayout(page)
})

test('agenda da semana lista os 7 dias', async ({ page }) => {
  await page.goto('/painel')
  await page.getByRole('button', { name: 'Semana', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Semana', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('button', { name: /^Ver dia/ })).toHaveCount(7)
  await expectAccessibleLayout(page)
})

test('abrir um agendamento mostra os dados e as ações', async ({ page }) => {
  await page.goto('/painel')
  await page.getByRole('button', { name: /10:00–11:00 Cliente Exemplo Dois/ }).click()
  const dialog = page.getByRole('dialog', { name: 'Editar agendamento' })
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Cancelar agendamento' })).toBeVisible()
  await expectAccessibleLayout(page)
})

test('serviços: lista e modal de novo serviço fecha com Esc', async ({ page }) => {
  await page.goto('/painel/servicos')
  const row = page.getByRole('row', { name: /Corte de cabelo/ })
  await expect(row).toContainText('30 min')
  await expect(row).toContainText('R$ 45,00')
  await expect(row).toContainText('Ativo')
  await expect(page.getByRole('row', { name: /Barba/ })).toContainText('Inativo')
  await expectAccessibleLayout(page)

  await page.getByRole('button', { name: 'Novo serviço' }).click()
  const dialog = page.getByRole('dialog', { name: 'Novo serviço' })
  await expect(dialog).toBeVisible()
  // O <dialog> nativo leva o foco para dentro dele ao abrir.
  await expect(dialog.locator(':focus')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
})

test('equipe: lista profissionais e a agenda troca de profissional', async ({ page }) => {
  await page.goto('/painel/equipe')
  await expect(page.getByRole('heading', { level: 1, name: 'Equipe' })).toBeVisible()
  const row = page.getByRole('row', { name: /^Profissional Exemplo Corte/ })
  await expect(row).toContainText('Corte de cabelo, Barba')
  await expect(row).toContainText('Ativo')
  await expect(page.getByRole('row', { name: /Profissional Exemplo Dois/ })).toContainText(
    'Inativo',
  )
  await expectAccessibleLayout(page)

  await page.getByRole('button', { name: 'Editar Profissional Exemplo Dois' }).click()
  const dialog = page.getByRole('dialog', { name: 'Editar profissional' })
  await expect(dialog.getByRole('group', { name: 'Serviços que faz' })).toBeVisible()
  await expectAccessibleLayout(page)
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()

  await page.getByRole('link', { name: 'Agenda' }).click()
  // Espera a agenda abrir: na Equipe, "Editar Profissional…" também casaria com o rótulo.
  await expect(page.getByRole('heading', { level: 1, name: 'Agenda' })).toBeVisible()
  const select = page.getByRole('combobox', { name: 'Profissional' })
  await expect(select).toHaveValue('p1')
  await expect(page.getByRole('button', { name: /10:00–11:00/ })).toBeVisible()
  await select.selectOption('p2')
  await expect(page.getByText('Nenhum agendamento neste dia.')).toBeVisible()
})

test.describe('no celular', () => {
  test.use({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })

  test('agenda, serviços e equipe cabem na tela', async ({ page }) => {
    await page.goto('/painel')
    await expect(page.getByRole('button', { name: /10:00–11:00/ })).toBeVisible()
    await expectAccessibleLayout(page)
    await page.getByRole('link', { name: 'Serviços' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Serviços' })).toBeVisible()
    await expectAccessibleLayout(page)
    await page.getByRole('link', { name: 'Equipe' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Equipe' })).toBeVisible()
    await expectAccessibleLayout(page)
  })
})
