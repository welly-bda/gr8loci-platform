import { expect, test } from '@playwright/test'

test.describe('public pages render', () => {
  test('home loads with hero and latest posts', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /clear answers/i })).toBeVisible()
    await expect(page.getByText('Latest posts')).toBeVisible()
  })

  test('blog index loads', async ({ page }) => {
    await page.goto('/blog')
    await expect(page.getByRole('heading', { name: 'Blog', level: 1 })).toBeVisible()
  })

  test('single blog post loads', async ({ page }) => {
    await page.goto('/blog/welcome-to-gr8loci')
    await expect(page.getByRole('heading', { name: 'Welcome to GR8LOCI', level: 1 })).toBeVisible()
  })

  test('about page loads', async ({ page }) => {
    await page.goto('/about')
    await expect(page.getByRole('heading', { name: /about gr8loci/i })).toBeVisible()
  })
})

test.describe('admin route guard', () => {
  test('unauthenticated /admin redirects to /admin/login', async ({ page }) => {
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login$/)
    await expect(page.getByRole('heading', { name: /admin sign in/i })).toBeVisible()
  })
})
