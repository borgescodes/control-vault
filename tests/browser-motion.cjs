// Run after npm run build with Vite preview on http://127.0.0.1:5176.
// PLAYWRIGHT_MODULE may point to the bundled Playwright installation.
// Browser, CSS animations and IndexedDB are real. Remote Auth/Data API are controlled
// fixtures; this deliberately never writes synthetic records to the personal backend.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')

const base = 'http://127.0.0.1:5176'
const owner = '11111111-1111-4111-8111-111111111111'
const now = new Date().toISOString()
const user = { id: owner, email: 'fixture@example.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: now }
const token = `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: owner, role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fixture`
const rows = {
  vehicle_state: [{ user_id: owner, tank_capacity_liters: 3, initial_odometer_km: 1000, initial_full_tank_at: now, created_at: now, updated_at: now }],
  odometer_readings: [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', user_id: owner, reading_km: 1000, recorded_at: now, source: 'manual', created_at: now, updated_at: now }],
  fuel_entries: [],
  saved_trips: [],
}

async function fixtureContext(browser, serviceWorkers = 'allow') {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers })
  const state = { offline: false, failWrites: false }
  await context.route('https://*.supabase.co/**', async (route) => {
    if (state.offline) return route.abort('internetdisconnected')
    const request = route.request(), url = new URL(request.url())
    if (url.pathname.includes('/auth/v1/token')) return route.fulfill({ json: { access_token: token, refresh_token: 'fixture-refresh', token_type: 'bearer', expires_in: 3600, user } })
    if (url.pathname.includes('/auth/v1/user')) return route.fulfill({ json: user })
    if (url.pathname.includes('/auth/v1/logout')) return route.fulfill({ status: 204 })
    const table = url.pathname.split('/').at(-1)
    if (!rows[table]) throw new Error(`Unexpected fixture API path: ${url.pathname}`)
    if (request.method() === 'GET') {
      const offset = Number(url.searchParams.get('offset') || 0), limit = Number(url.searchParams.get('limit') || 1000)
      return route.fulfill({ json: rows[table].slice(offset, offset + limit) })
    }
    if (state.failWrites) return route.fulfill({ status: 503, json: { code: 'fixture_unavailable', message: 'Fixture unavailable' } })
    const payload = request.postDataJSON(), key = table === 'vehicle_state' ? 'user_id' : 'id'
    const index = rows[table].findIndex((row) => row[key] === payload[key])
    if (index < 0) rows[table].push(payload)
    else if (!request.headers().prefer?.includes('ignore-duplicates')) rows[table][index] = payload
    return route.fulfill({ status: 201, body: '', contentType: 'application/json' })
  })
  await context.route('**/v1/precos?**', (route) => route.fulfill({ json: {
    uf: 'PA', municipio: 'PARAGOMINAS', produto: 'GASOLINA COMUM', semanaInicio: '2026-09-21', semanaFim: '2026-09-27', precoMedio: 7.053, precoMinimo: 6.79, precoMaximo: 7.22, postosPesquisados: 7,
  } }))
  return { context, state }
}

async function login(page) {
  await page.goto(base)
  await page.locator('input[name=email]').fill('fixture@example.test')
  await page.locator('input[name=password]').fill('fixture-password')
  await page.getByRole('button', { name: 'Entrar', exact: true }).click()
  await page.locator('.home').waitFor()
  await page.waitForFunction(() => document.querySelector('.app__connection')?.textContent.trim() === 'ON')
}

async function refuel(page, amount, odometer) {
  await page.getByRole('button', { name: 'Abastecer', exact: true }).click()
  await page.locator('input[name=amount]').fill(amount)
  if (odometer) await page.locator('input[name=odometer]').fill(odometer)
  await page.getByRole('button', { name: 'Salvar abastecimento', exact: true }).click()
  await page.locator('.home').waitFor()
}



rows.odometer_readings[0].reading_km = 1160
rows.vehicle_state[0].initial_full_tank_at = '2026-09-29T10:00:00Z'
rows.fuel_entries.push({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', user_id: owner, odometer_km: 1120, amount_cents: 2100, estimated_liters: 3, reference_price_per_liter: 7, reference_week_start: '2026-09-21', reference_week_end: '2026-09-27', full_tank: true, fueled_at: '2026-09-30T10:00:00Z', created_at: now, updated_at: now })

;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const output = path.join(process.cwd(), '.superpowers', 'motion')
  fs.mkdirSync(output, { recursive: true })
  try {
    const fixture = await fixtureContext(browser, 'block'), page = await fixture.context.newPage()
    const errors = []; page.on('pageerror', error => errors.push(error.message))
    await login(page)
    await page.locator('.fuel-progress[data-motion=running]').waitFor()
    const progress = page.locator('.fuel-progress'), fill = page.locator('.fuel-progress__value')
    await page.waitForTimeout(1000)
    const state = await fill.evaluate(el => {
      const style = getComputedStyle(el, '::after')
      return { animation: style.animationName, iterations: style.animationIterationCount, playState: style.animationPlayState, transform: style.transform, percent: el.parentElement.getAttribute('aria-valuenow'), width: el.getBoundingClientRect().width }
    })
    assert.equal(state.animation, 'fuel-sweep')
    assert.equal(state.iterations, 'infinite')
    assert.equal(state.playState, 'running')
    await page.waitForTimeout(600)
    assert.notEqual(await fill.evaluate(el => getComputedStyle(el, '::after').transform), state.transform, 'Sweep must actually move')
    assert.equal(await progress.getAttribute('aria-valuenow'), state.percent)
    assert.equal(await fill.evaluate(el => el.getBoundingClientRect().width), state.width, 'Sweep must not change the real fuel level')
    await page.setViewportSize({ width: 390, height: 260 })
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.locator('.fuel-progress[data-motion=paused]').waitFor()
    assert.equal(await fill.evaluate(el => getComputedStyle(el, '::after').animationPlayState), 'paused')
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.locator('.fuel-progress[data-motion=running]').waitFor()
    // Real background visibility while a second tab is foregrounded.
    const foreground = await fixture.context.newPage()
    await foreground.goto(base)
    await foreground.bringToFront()
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.locator('.fuel-progress[data-motion=paused]').waitFor()
    await page.evaluate(() => {
      delete document.hidden
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await foreground.close(); await page.bringToFront()
    await page.locator('.fuel-progress[data-motion=running]').waitFor()
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.locator('.fuel-progress[data-motion=paused]').waitFor()
    const reduced = await fill.evaluate(el => ({ animation: getComputedStyle(el).animationName, transition: getComputedStyle(el).transitionDuration, sweep: getComputedStyle(el, '::after').animationName, content: getComputedStyle(el, '::after').content }))
    assert.equal(reduced.animation, 'none'); assert.equal(reduced.sweep, 'none')
    assert.equal(reduced.content, 'none'); assert.equal(reduced.transition, '0s')
    assert.equal(await progress.getAttribute('aria-valuenow'), state.percent)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.locator('.fuel-progress[data-motion=running]').waitFor()
    const dimensions = []
    for (const width of [320, 360, 375, 390, 412, 430, 1440]) {
      await page.setViewportSize({ width, height: width > 700 ? 1000 : 844 })
      await page.waitForTimeout(250)
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}`)
      assert.equal(await progress.getAttribute('aria-valuenow'), state.percent)
      await page.screenshot({ path: path.join(output, `home-${width}.png`), fullPage: true })
      await page.getByRole('button', { name: 'Histórico', exact: true }).click()
      const icon = page.locator('.vehicle-navigation [aria-current=page] .vehicle-icon')
      assert.equal(await icon.evaluate(el => getComputedStyle(el).animationName), 'navigation-in')
      await page.getByRole('button', { name: 'Início', exact: true }).click()
      await page.getByRole('button', { name: 'Abastecer', exact: true }).click()
      const checkbox = page.locator('input[type=checkbox]')
      await checkbox.check()
      assert.equal(await checkbox.evaluate(el => getComputedStyle(el, '::after').transitionDuration.includes('0.15s')), true)
      await page.getByRole('button', { name: 'Início', exact: true }).click()
      dimensions.push({ width, overflow: false })
    }
    // Capture different instants for visual inspection of the moving light.
    await page.setViewportSize({ width: 390, height: 844 })
    await page.waitForTimeout(1000)
    for (let index = 0; index < 4; index++) {
      await page.screenshot({ path: path.join(output, `sweep-${index}.png`) })
      await page.waitForTimeout(600)
    }
    assert.deepEqual(errors, [])
    const result = { passed: true, continuousSweep: true, stableFuelValue: state.percent, pausedOffscreen: true, controlledVisibilityEvent: true, dynamicReducedMotion: true, dimensions, pageErrors: errors }
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result))
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
