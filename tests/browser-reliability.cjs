// Run against a fresh production build served on http://127.0.0.1:5176.
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

;(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' })
  const output = path.join(process.cwd(), '.superpowers', 'reliability-browser')
  fs.mkdirSync(output, { recursive: true })
  try {
    const a = await fixtureContext(browser), b = await fixtureContext(browser, 'block')
    const mobile = await a.context.newPage(), desktop = await b.context.newPage()
    const errors = []
    mobile.on('pageerror', (error) => errors.push(error.message))
    desktop.on('pageerror', (error) => errors.push(error.message))
    await login(mobile); await login(desktop)
    await mobile.waitForFunction(() => navigator.serviceWorker.controller !== null)
    await refuel(mobile, '1200', '10100')
    await mobile.waitForFunction(() => document.querySelector('.app__connection')?.textContent.trim() === 'ON')
    assert.equal(rows.fuel_entries.length, 1)
    await desktop.evaluate(() => window.dispatchEvent(new Event('focus')))
    await desktop.waitForFunction(() => document.querySelector('.home')?.textContent.includes('12,00'))
    await desktop.reload()
    await desktop.locator('.home').waitFor()
    await desktop.waitForFunction(() => document.querySelector('.home')?.textContent.includes('12,00'))
    assert.match(await desktop.locator('.home').textContent(), /12,00/)

    a.state.offline = true; await a.context.setOffline(true)
    await refuel(mobile, '2500', '10200')
    assert.equal(await mobile.locator('.app__connection').textContent(), 'OFF')
    assert.match(await mobile.locator('.home').textContent(), /sincronização pendente/)
    await mobile.reload()
    await mobile.locator('.home').waitFor()
    await mobile.waitForFunction(() => document.querySelector('.home')?.textContent.includes('37,00'))
    assert.match(await mobile.locator('.home').textContent(), /37,00/)
    a.state.offline = false; await a.context.setOffline(false)
    await mobile.waitForFunction(() => document.querySelector('.app__connection')?.textContent.trim() === 'ON')
    assert.equal(rows.fuel_entries.length, 2)
    await desktop.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
    await desktop.waitForFunction(() => document.querySelector('.home')?.textContent.includes('37,00'))

    a.state.failWrites = true
    await refuel(mobile, '1000', '10300')
    await mobile.getByText('Sincronização não concluída', { exact: true }).waitFor()
    assert.equal(await mobile.locator('.app__connection').textContent(), 'SYNC')
    a.state.failWrites = false
    await mobile.getByRole('button', { name: 'Tentar novamente' }).click()
    await mobile.waitForFunction(() => document.querySelector('.app__connection')?.textContent.trim() === 'ON')
    assert.equal(rows.fuel_entries.length, 3)
    await mobile.evaluate(() => window.dispatchEvent(new Event('focus')))
    await mobile.waitForTimeout(200)
    assert.equal(rows.fuel_entries.length, 3)

    const privateBrowser = await fixtureContext(browser, 'block'), privatePage = await privateBrowser.context.newPage()
    await login(privatePage)
    await privatePage.waitForFunction(() => document.querySelector('.home')?.textContent.includes('47,00'))
    assert.match(await privatePage.locator('.home').textContent(), /47,00/)

    for (let index = 0; index < 30; index++) rows.odometer_readings.push({ ...rows.odometer_readings[0], id: `history-${index}`, recorded_at: new Date(Date.now() - (index + 1) * 86400000).toISOString() })
    await mobile.evaluate(() => window.dispatchEvent(new Event('focus')))
    await mobile.waitForFunction(() => document.querySelector('.app__connection')?.textContent.trim() === 'ON')
    await mobile.waitForTimeout(150)

    const dimensions = []
    for (const width of [320, 360, 375, 390, 412, 430, 1440]) {
      await mobile.setViewportSize({ width, height: width > 700 ? 1000 : 844 })
      await mobile.getByRole('button', { name: 'Histórico', exact: true }).click()
      await mobile.locator('.history').waitFor()
      const before = await mobile.locator('.vehicle-navigation').boundingBox()
      await mobile.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      const after = await mobile.locator('.vehicle-navigation').boundingBox()
      assert(Math.abs(before.y - after.y) < 1, `Navigation moved at ${width}px`)
      assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Overflow at ${width}px`)
      assert.equal(await mobile.locator('.vehicle-navigation').evaluate((nav) => getComputedStyle(nav).backgroundColor), 'rgb(0, 0, 0)')
      assert((await mobile.locator('.history-row').last().boundingBox()).y + (await mobile.locator('.history-row').last().boundingBox()).height <= after.y, `Last record hidden at ${width}px`)
      dimensions.push({ width, navigationY: after.y, overflow: false })
      await mobile.getByRole('button', { name: 'Início', exact: true }).click()
      await mobile.getByRole('button', { name: 'Abastecer', exact: true }).click()
      await mobile.getByText(/Preço de referência:/).waitFor()
      assert.equal(await mobile.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Form overflow at ${width}px`)
      await mobile.locator('input[name=amount]').focus()
      assert.equal(await mobile.locator('.vehicle-navigation').isVisible(), false)
      await mobile.goBack(); await mobile.locator('.home').waitFor()
    }
    await mobile.setViewportSize({ width: 390, height: 844 })
    await mobile.waitForTimeout(1000)
    await mobile.screenshot({ path: path.join(output, 'home-390.png'), fullPage: true })
    await mobile.getByRole('button', { name: 'Abastecer', exact: true }).click()
    await mobile.waitForTimeout(300)
    await mobile.screenshot({ path: path.join(output, 'fuel-390.png'), fullPage: true })
    await mobile.locator('input[name=amount]').fill('1000')
    await mobile.locator('input[name=odometer]').fill('20000')
    await mobile.getByRole('button', { name: 'Salvar abastecimento', exact: true }).click()
    await mobile.getByRole('alertdialog', { name: 'Confirmar salto de hodômetro' }).waitFor()
    const backdrop = await mobile.locator('.vehicle-confirmation-backdrop').boundingBox()
    assert.deepEqual({ x: backdrop.x, y: backdrop.y, width: backdrop.width, height: backdrop.height }, { x: 0, y: 0, width: 390, height: 844 }, 'Confirmation must cover the viewport')
    await mobile.getByRole('button', { name: 'Corrigir', exact: true }).click()
    await mobile.goto(`${base}/hodometro`)
    await mobile.getByRole('button', { name: 'Voltar', exact: true }).click()
    await mobile.waitForURL(`${base}/`)

    // A new worker must wait for an explicit update action, retaining typed input.
    await mobile.getByRole('button', { name: 'Abastecer', exact: true }).click()
    await mobile.locator('input[name=amount]').fill('1234')
    const swPath = path.join(process.cwd(), 'dist', 'sw.js'), originalWorker = fs.readFileSync(swPath, 'utf8')
    try {
      fs.writeFileSync(swPath, `${originalWorker}\n// browser verification second worker version\n`)
      await mobile.evaluate(() => window.dispatchEvent(new Event('focus')))
      await mobile.getByRole('button', { name: 'Atualizar app', exact: true }).waitFor()
      assert.match(await mobile.locator('input[name=amount]').inputValue(), /12,34/)
      assert.equal(await mobile.locator('.app__connection').textContent(), 'SYNC')
      await Promise.all([
        mobile.waitForEvent('load'), mobile.getByRole('button', { name: 'Atualizar app', exact: true }).click(),
      ])
      await mobile.locator('input[name=amount]').waitFor()
      assert.equal(await mobile.getByRole('button', { name: 'Atualizar app', exact: true }).count(), 0)
    } finally { fs.writeFileSync(swPath, originalWorker) }
    assert.deepEqual(errors, [])
    const result = { passed: true, backend: 'controlled fixture, real browser/IndexedDB/SW', remoteFuelRecords: rows.fuel_entries.length, controlledWorkerUpdate: true, dimensions, pageErrors: errors }
    fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(result, null, 2))
    console.log(JSON.stringify(result))
  } finally { await browser.close() }
})().catch((error) => { console.error(error); process.exitCode = 1 })
