import { expect, test, type Page } from '@playwright/test'

const TOKEN_LABEL = '登陆密钥'

async function openLogin(page: Page, reducedMotion = false) {
  await page.addInitScript(() => {
    localStorage.removeItem('elysia-webui.panel-token')
    localStorage.setItem('elysia-webui.theme', 'light')
  })
  if (reducedMotion) await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/#/login')
  await expect(page.locator('.login-page')).toHaveAttribute('data-phase', 'ready', { timeout: 15000 })
}

async function mockHealth(
  page: Page,
  handler: (count: number) => { status?: number; body?: string; json?: unknown } = () => ({ json: { ok: true, data: {} } }),
) {
  let count = 0
  await page.route('**/api/admin/health', async (route) => {
    count += 1
    const response = handler(count)
    await route.fulfill({ status: response.status ?? 200, body: response.body, json: response.json })
  })
  return () => count
}

async function mockAdminDependencies(page: Page) {
  await page.route('**/api/admin/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/health')) {
      await route.fallback()
      return
    }
    await route.fulfill({ json: { ok: true, data: path.endsWith('/seq') ? { seq: 1 } : {} } })
  })
}

async function submitToken(page: Page, token: string) {
  const input = page.getByLabel(TOKEN_LABEL)
  await input.fill(token)
  await input.press('Enter')
}

test('login page keeps the reference signet terminal structure and keyboard flow', async ({ page }) => {
  await openLogin(page)

  await expect(page.locator('.morning-garden')).toBeAttached()
  await expect(page.locator('.mist-bank')).toHaveCount(3)
  await expect(page.locator('.background-clearance')).toBeAttached()
  await expect(page.locator('.signet-art')).toBeAttached()
  await expect(page.locator('.signet-idle-glow')).toBeAttached()
  await expect(page.locator('.frame-upper')).toBeAttached()
  await expect(page.locator('.frame-lower')).toBeAttached()
  await expect(page.locator('.signature-wordmark')).toBeAttached()

  const input = page.getByLabel(TOKEN_LABEL)
  await expect(input).toBeEnabled()
  await expect(page.getByRole('button', { name: '切换到深色模式' })).toBeVisible()
  await expect(page.getByRole('button', { name: /播放动态效果|显示令牌|立即登录/ })).toHaveCount(0)

  await input.fill('keyboard-token')
  await input.press('Shift+Tab')
  await expect(page.getByRole('button', { name: '切换到深色模式' })).toBeFocused()
})

test('successful login persists the token only after the terminal handoff', async ({ page }) => {
  await openLogin(page)
  const requestCount = await mockHealth(page)
  await mockAdminDependencies(page)
  const input = page.getByLabel(TOKEN_LABEL)
  await input.fill('valid-test-token')
  await input.press('Enter')

  await expect.poll(requestCount).toBe(1)
  await expect(page.locator('.login-page')).toHaveAttribute('data-phase', 'welcoming')
  expect(await page.evaluate(() => localStorage.getItem('elysia-webui.panel-token'))).toBeNull()
  expect((await page.context().cookies()).find((cookie) => cookie.name === 'elysia_panel_token')).toBeUndefined()
  await expect(page).toHaveURL(/#\/overview/, { timeout: 15000 })
  await expect.poll(() => page.evaluate(() => localStorage.getItem('elysia-webui.panel-token'))).toBe('valid-test-token')
})

test('401 responses fracture the signet and lock after five failures', async ({ page }) => {
  await openLogin(page)
  const requestCount = await mockHealth(page, () => ({
    status: 401,
    json: { ok: false, error: { code: 'unauthorized', message: 'unauthorized' } },
  }))
  const input = page.getByLabel(TOKEN_LABEL)

  for (let attempt = 1; attempt <= 5; attempt += 1) {
    await submitToken(page, `invalid-${attempt}`)
    await expect(page.locator('.failure-meter')).toHaveAttribute('aria-valuenow', String(attempt), { timeout: 5000 })
    if (attempt < 5) await expect(page.locator('.login-page')).toHaveAttribute('data-phase', 'ready')
  }

  await expect(page.locator('.login-page')).toHaveAttribute('data-phase', 'exhausted')
  await expect(input).toBeDisabled()
  await expect(page.getByText('错误次数过多，请稍后刷新重试')).toBeVisible()
  await expect.poll(requestCount).toBe(5)
})

test('service failures preserve the token and do not increase the failure meter', async ({ page }) => {
  await openLogin(page)
  await mockHealth(page, () => ({ status: 503, body: 'service unavailable' }))
  await submitToken(page, 'keep-me')

  await expect(page.locator('.terminal-status')).toHaveText('后端服务异常（HTTP 503），请检查服务状态后重试')
  await expect(page.getByLabel(TOKEN_LABEL)).toHaveValue('keep-me')
  await expect(page.locator('.failure-meter')).toHaveAttribute('aria-valuenow', '0')
  await expect(page.locator('.login-page')).toHaveAttribute('data-phase', 'ready')
})

test('repeated Enter while verification is pending sends one request', async ({ page }) => {
  await openLogin(page)
  let release: (() => void) | undefined
  const pending = new Promise<void>((resolve) => { release = resolve })
  let count = 0
  await page.route('**/api/admin/health', async (route) => {
    count += 1
    await pending
    await route.fulfill({ json: { ok: true, data: {} } })
  })
  await mockAdminDependencies(page)

  const input = page.getByLabel(TOKEN_LABEL)
  await input.fill('single-flight')
  await page.locator('form[aria-label="密钥登录"]').evaluate((form) => {
    form.requestSubmit()
    form.requestSubmit()
    form.requestSubmit()
  })
  await expect.poll(() => count).toBe(1)
  await expect(input).toHaveAttribute('readonly', '')
  await expect(page.locator('form[aria-label="密钥登录"]')).toHaveAttribute('aria-busy', 'true')

  release?.()
  await expect(page).toHaveURL(/#\/overview/, { timeout: 15000 })
})

test('theme changes keep the token and login state', async ({ page }) => {
  await openLogin(page)
  const input = page.getByLabel(TOKEN_LABEL)
  await input.fill('keep-state')
  await page.getByRole('button', { name: '切换到深色模式' }).click()
  await expect(page.locator('.login-page')).toHaveAttribute('data-theme', 'dark')
  await expect(input).toHaveValue('keep-state')
  await expect(page.getByRole('button', { name: '切换到浅色模式' })).toBeVisible()
})

test('reduced motion still authenticates and skips nonessential animation waiting', async ({ page }) => {
  await openLogin(page, true)
  await mockHealth(page)
  await mockAdminDependencies(page)
  await submitToken(page, 'reduced-token')
  await expect(page).toHaveURL(/#\/overview/, { timeout: 5000 })
  await expect.poll(() => page.evaluate(() => localStorage.getItem('elysia-webui.panel-token'))).toBe('reduced-token')
})


test('timeout keeps the input and does not consume an authentication attempt', async ({ page }) => {
  await openLogin(page, true)
  await page.route('**/api/admin/health', () => {})
  await submitToken(page, 'timeout-token')
  await expect(page.locator('.terminal-status')).toHaveText('连接后端超时，请检查网络与服务状态', { timeout: 18000 })
  await expect(page.getByLabel(TOKEN_LABEL)).toHaveValue('timeout-token')
  await expect(page.getByLabel(TOKEN_LABEL)).toBeEditable()
  await expect(page.locator('.failure-meter')).toHaveAttribute('aria-valuenow', '0')
})

test('page restoration cancels pending authentication and reinitializes the signet', async ({ page }) => {
  await openLogin(page, true)
  let requestStarted = false
  await page.route('**/api/admin/health', () => { requestStarted = true })
  await submitToken(page, 'cancelled-token')
  await expect.poll(() => requestStarted).toBe(true)
  await page.evaluate(() => {
    window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }))
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }))
  })
  await expect(page.locator('.login-page')).toHaveAttribute('data-phase', 'ready')
  await expect(page.getByLabel(TOKEN_LABEL)).toHaveValue('')
  await expect(page.getByLabel(TOKEN_LABEL)).toBeEditable()
  await expect.poll(() => page.locator('.signet-art').evaluate((canvas: HTMLCanvasElement) => canvas.width)).toBe(640)
  expect(await page.evaluate(() => localStorage.getItem('elysia-webui.panel-token'))).toBeNull()
})

test('hidden lighting pauses and changing reduced motion completes the handoff', async ({ page }) => {
  await openLogin(page)
  await mockHealth(page)
  await mockAdminDependencies(page)
  await submitToken(page, 'motion-token')
  await expect(page.locator('.login-page')).toHaveAttribute('data-phase', 'lighting', { timeout: 10000 })
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page.locator('.login-page')).toHaveAttribute('data-background-paused', '')
  const pixels = await page.locator('.signet-art').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())
  await page.waitForTimeout(300)
  expect(await page.locator('.signet-art').evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL())).toBe(pixels)
  expect(await page.evaluate(() => localStorage.getItem('elysia-webui.panel-token'))).toBeNull()
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(() => {
    Reflect.deleteProperty(document, 'hidden')
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await expect(page).toHaveURL(/#\/overview/, { timeout: 5000 })
})

test('an unavailable decorative image leaves authentication usable', async ({ page }) => {
  await page.route('**/assets/signet/elysia-signet-solid.png', (route) => route.abort())
  await openLogin(page, true)
  await expect(page.locator('.terminal-status')).toHaveText('页面资源加载失败，请刷新重试')
  await mockHealth(page)
  await mockAdminDependencies(page)
  await submitToken(page, 'without-image')
  await expect(page).toHaveURL(/#\/overview/, { timeout: 5000 })
})
