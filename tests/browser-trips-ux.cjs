// Run after npm run build with Vite preview on http://127.0.0.1:5176.
// PLAYWRIGHT_MODULE may point to the bundled Playwright installation.
// Browser + IndexedDB + service worker are real. Remote Auth/Data API are controlled
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


rows.odometer_readings[0].reading_km = 1120
rows.vehicle_state[0].initial_full_tank_at = '2026-09-29T10:00:00Z'
rows.fuel_entries.push({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', user_id: owner, odometer_km: 1120, amount_cents: 2100, estimated_liters: 3, reference_price_per_liter: 7, reference_week_start: '2026-09-21', reference_week_end: '2026-09-27', full_tank: true, fueled_at: '2026-09-30T10:00:00Z', created_at: now, updated_at: now })
const widths = [320, 360, 375, 390, 412, 430]
async function layout(page, width, view) {
  await page.waitForTimeout(250)
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${view}: horizontal overflow at ${width}`)
  const problems = await page.locator('.trip-row__route, .trip-row__route span, .trip-row__summary span, #trip-detail-title, .trip-detail__metrics dd, .trip-detail__references dd, .trip-detail__references dt, .trip-distance-input span, .vehicle-navigation button').evaluateAll(elements => elements.flatMap(el => {
    const style = getComputedStyle(el), rect = el.getBoundingClientRect()
    if (style.whiteSpace !== 'nowrap') return [`${el.className || el.tagName}: wrap enabled`]
    if (rect.right > innerWidth + 1 || rect.left < -1) return [`${el.className}: outside viewport`]
    if (el.scrollWidth > el.clientWidth + 1 && style.textOverflow !== 'ellipsis' && !el.classList.contains('trip-row__route')) return [`${el.className}: clipped value`]
    return []
  }))
  assert.deepEqual(problems, [], `${view} at ${width}`)
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  const nav = await page.locator('.vehicle-navigation').boundingBox()
  const last = await page.locator(view === 'list' ? '.trip-row' : view === 'detail' ? '.trip-detail__danger' : '.vehicle-form__submit').last().boundingBox()
  if (nav && last) assert(last.y + last.height <= nav.y + 1, `${view}: content under navigation at ${width}`)
}
;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const output = path.join(process.cwd(), '.superpowers', 'trips-ux')
  fs.mkdirSync(output, { recursive: true })
  try {
    const fixture = await fixtureContext(browser, 'block'), page = await fixture.context.newPage()
    const errors = []
    page.on('pageerror', error => { errors.push(error.message); console.log('PAGE ERROR', error.message) })
    await login(page)
    for (const name of ['Percursos', 'Histórico', 'Início', 'Percursos']) {
      await page.getByRole('button', { name, exact: true }).click()
      assert.equal(await page.locator('.vehicle-navigation [aria-current=page]').getAttribute('aria-label'), name)
      assert.equal((await page.locator('.vehicle-navigation').textContent()).trim(), '')
    }
    assert.equal(await page.locator('.trips button').count(), 1)
    await page.getByRole('button', { name: 'Novo', exact: true }).click()
    await page.locator('input[name=trip-origin]').fill('Casa')
    await page.locator('input[name=trip-destination]').fill('Juparanã')
    const outbound = page.locator('input[name=trip-outbound-distance]')
    for (const [digits, expected] of [['1', '0,1'], ['14', '1,4'], ['140', '14,0'], ['145', '14,5']]) {
      await outbound.fill(digits)
      assert.equal(await outbound.inputValue(), expected)
    }
    await outbound.fill('')
    await outbound.pressSequentially('145')
    assert.equal(await outbound.inputValue(), '14,5')
    await outbound.press('Backspace')
    assert.equal(await outbound.inputValue(), '1,4')
    await outbound.fill('9999990')
    assert.equal(await outbound.inputValue(), '999999,0')
    await outbound.press('End'); await outbound.press('9')
    assert.equal(await outbound.inputValue(), '999999,0')
    await outbound.fill('140')
    await page.locator('input[type=checkbox]').check()
    await page.locator('input[name=trip-return-distance]').fill('160')
    await page.locator('h2').click()
    await page.getByRole('button', { name: 'Salvar percurso', exact: true }).click()
    await page.locator('.trip-detail').waitFor()
    await page.getByRole('button', { name: 'Percursos', exact: true }).click()
    await page.getByRole('button', { name: 'Casa para Juparanã' }).waitFor()
    assert.match(await page.locator('.trip-row').textContent(), /30 km/)
    // Price fixture is 7.053; 30 / 40 * 7.053 rounds to R$ 5,29.
    assert.match(await page.locator('.trip-row').textContent(), /5,29/)
    const local = await page.evaluate(async () => {
      const db = await new Promise((resolve, reject) => { const r = indexedDB.open('control-vault'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
      return new Promise((resolve, reject) => { const r = db.transaction('saved_trips').objectStore('saved_trips').getAll(); r.onsuccess = () => { db.close(); resolve(r.result) }; r.onerror = () => reject(r.error) })
    })
    assert.equal(local[0].outboundDistanceKm, 14)
    assert.equal(local[0].returnDistanceKm, 16)
    // Long labels exercise real ellipsis without synthetic backend writes.
    await page.getByRole('button', { name: 'Novo', exact: true }).click()
    await page.locator('input[name=trip-origin]').fill('Origem com um nome muito longo '.repeat(2))
    await page.locator('input[name=trip-destination]').fill('Destino com um nome muito longo '.repeat(2))
    await page.locator('input[name=trip-outbound-distance]').fill('145')
    await page.locator('h2').click()
    await page.getByRole('button', { name: 'Salvar percurso', exact: true }).click()
    await page.locator('.trip-detail').waitFor()
    for (const width of widths) {
      await page.setViewportSize({ width, height: 844 })
      await page.getByRole('button', { name: 'Percursos', exact: true }).click()
      await layout(page, width, 'list')
      const route = page.locator('.trip-row__route').first()
      assert(await route.locator('span').first().evaluate(el => el.scrollWidth > el.clientWidth), `Long origin should truncate at ${width}`)
      for (const button of await page.locator('.vehicle-navigation button').all()) {
        const rect = await button.boundingBox(); assert(rect.width >= 44 && rect.height >= 44)
      }
      await page.screenshot({ path: path.join(output, `list-${width}.png`), fullPage: true })
      await page.getByRole('button', { name: 'Casa para Juparanã', exact: true }).click()
      await layout(page, width, 'detail')
      for (const label of ['Ida', 'Volta', 'Total']) assert.equal(await page.getByRole('region', { name: label, exact: true }).count(), 1)
      await page.screenshot({ path: path.join(output, `round-trip-${width}.png`), fullPage: true })
      await page.getByRole('button', { name: 'Percursos', exact: true }).click()
      await page.locator('.trip-row').first().click()
      await layout(page, width, 'detail')
      await page.screenshot({ path: path.join(output, `detail-${width}.png`), fullPage: true })
      await page.getByRole('button', { name: 'Excluir', exact: true }).click()
      await page.getByRole('button', { name: 'Cancelar', exact: true }).click()
      await page.getByRole('button', { name: 'Editar', exact: true }).click()
      await page.locator('input[name=trip-outbound-distance]').waitFor()
      assert.equal(await page.locator('input[name=trip-outbound-distance]').inputValue(), '14,5')
      await page.locator('input[type=checkbox]').check()
      await page.locator('input[name=trip-return-distance]').fill('160')
      await page.locator('input[type=checkbox]').focus()
      assert.equal(await page.locator('.vehicle-navigation').isVisible(), true, 'Checkbox must not hide navigation')
      await page.evaluate(() => document.activeElement.blur())
      await layout(page, width, 'form')
      await page.screenshot({ path: path.join(output, `form-${width}.png`), fullPage: true })
      await page.getByRole('button', { name: 'Percursos', exact: true }).click()
    }
    await page.getByRole('button', { name: 'Novo', exact: true }).click()
    await page.locator('input[name=trip-origin]').fill('Limite')
    await page.locator('input[name=trip-destination]').fill('Máximo')
    await page.locator('input[name=trip-outbound-distance]').fill('9999990')
    await page.locator('input[type=checkbox]').check()
    await page.locator('input[name=trip-return-distance]').fill('9999990')
    await page.locator('h2').click()
    await page.getByRole('button', { name: 'Salvar percurso', exact: true }).click()
    await page.locator('.trip-detail').waitFor()
    for (const width of widths) {
      await page.setViewportSize({ width, height: 844 })
      await layout(page, width, 'detail')
      await page.getByRole('button', { name: 'Percursos', exact: true }).click()
      await layout(page, width, 'list')
      await page.getByRole('button', { name: 'Limite para Máximo', exact: true }).click()
    }
    await page.getByRole('button', { name: 'Excluir', exact: true }).click()
    await page.getByRole('button', { name: 'Confirmar', exact: true }).click()
    await page.locator('.trips').waitFor()
    assert.equal(await page.getByRole('button', { name: 'Limite para Máximo', exact: true }).count(), 0)
    // A separate browser starts without consumption; costs must stay unavailable.
    rows.fuel_entries = []
    const uncalibrated = await fixtureContext(browser, 'block'), calibrationPage = await uncalibrated.context.newPage()
    await login(calibrationPage)
    await calibrationPage.getByRole('button', { name: 'Percursos', exact: true }).click()
    assert.match(await calibrationPage.locator('.trip-list').textContent(), /Calibrando/)
    assert.doesNotMatch(await calibrationPage.locator('.trip-list').textContent(), /R\$/)
    for (const width of widths) {
      await calibrationPage.setViewportSize({ width, height: 844 })
      await layout(calibrationPage, width, 'list')
    }
    assert.deepEqual(errors, [])
    const result = { passed: true, widths, pageErrors: errors, storage: 'real IndexedDB, controlled remote fixtures', screenshots: output }
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result))
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
