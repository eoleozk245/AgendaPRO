import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/** axe-core sem nenhuma violação e sem rolagem horizontal na página. */
export async function expectAccessibleLayout(page: Page) {
  const results = await new AxeBuilder({ page }).analyze()
  const violations = results.violations.map(
    (violation) =>
      `${violation.id}: ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
  )
  expect(violations).toEqual([])

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  )
  expect(overflow, 'a página não pode rolar para os lados').toBe(false)
}
