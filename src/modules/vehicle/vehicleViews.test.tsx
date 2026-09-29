// @vitest-environment jsdom

import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const actionStub = vi.hoisted(() => ({
  initializeVehicle: vi.fn().mockResolvedValue(undefined),
  recordOdometer: vi.fn().mockResolvedValue({
    kind: 'requires_confirmation',
    deltaKm: 600,
  }),
  recordFuel: vi.fn().mockResolvedValue({ kind: 'saved' }),
}))

vi.mock('./vehicleActions', () => actionStub)

import FuelView from './FuelView'
import HomeView from './HomeView'
import OdometerView from './OdometerView'
import SetupView from './SetupView'
import type { VehicleDashboard } from './selectors'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value',
  )?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
}

function dashboard(
  overrides: Partial<VehicleDashboard> = {},
): VehicleDashboard {
  return {
    odometerKm: 1_240,
    monthSpendCents: 8_000,
    consumptionKmPerLiter: null,
    calibrationState: 'calibrating',
    fuelPercent: null,
    rangeKm: null,
    rangeState: 'calibrating',
    ...overrides,
  }
}

describe('vehicle v2 views', () => {
  beforeEach(() => {
    actionStub.initializeVehicle.mockClear()
    actionStub.recordOdometer.mockClear()
    actionStub.recordFuel.mockClear()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('submits setup successfully without checking full tank', async () => {
    const onComplete = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<SetupView onComplete={onComplete} />)
    })

    const odometer = container.querySelector(
      'input[type="number"]',
    ) as HTMLInputElement
    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement
    const form = container.querySelector('form') as HTMLFormElement

    expect(checkbox.checked).toBe(false)
    expect(checkbox.required).toBe(false)

    await act(async () => {
      setInputValue(odometer, '1000')
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
      await Promise.resolve()
    })

    expect(actionStub.initializeVehicle).toHaveBeenCalledOnce()
    expect(actionStub.initializeVehicle).toHaveBeenCalledWith(
      1000,
      false,
      expect.any(String),
    )
    expect(onComplete).toHaveBeenCalledOnce()

    await act(async () => root.unmount())
  })

  it('labels the optional setup checkbox as Tanque cheio agora', () => {
    const markup = renderToStaticMarkup(
      <SetupView onComplete={() => undefined} />,
    )

    expect(markup).toContain('Tanque cheio agora')
    expect(markup).not.toContain('Confirme o tanque cheio')
    expect(markup).toContain('class="vehicle-panel vehicle-panel--setup"')
    expect(markup).toContain('data-icon="cog"')
    expect(markup).toContain('<h2 id="setup-title">Começar</h2>')
    expect(markup).toContain('class="vehicle-form"')
    expect(markup).toContain('class="button-primary"')
  })

  it('removes manual liters and uses Completei o tanque in fuel form', () => {
    const markup = renderToStaticMarkup(
      <FuelView onBack={() => undefined} onSaved={() => undefined} />,
    )

    expect(markup).not.toContain('Litros')
    expect(markup).toContain('Completei o tanque')
    expect(markup).toContain('Hodômetro')
    expect(markup).toContain('Valor')
    expect(markup).toContain('class="vehicle-panel vehicle-panel--fuel"')
    expect(markup).toContain('data-icon="check"')
    expect(markup).toContain('class="vehicle-form"')
    expect(markup).toContain('class="button-secondary')
  })

  it('uses the shared action and confirmation instrument for odometer updates', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <OdometerView onBack={() => undefined} onSaved={() => undefined} />,
      )
    })

    expect(container.querySelector('.vehicle-panel--odometer')).not.toBeNull()
    expect(container.querySelector('[data-icon="refresh"]')).not.toBeNull()
    expect(container.querySelector('.vehicle-form')).not.toBeNull()

    const input = container.querySelector('input') as HTMLInputElement
    const form = container.querySelector('form') as HTMLFormElement
    await act(async () => {
      setInputValue(input, '1600')
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })

    expect(container.querySelector('.vehicle-confirmation')).not.toBeNull()
    expect(container.textContent).toContain('Confirmar salto de 600 km?')

    await act(async () => root.unmount())
  })

  it('shows awaiting full tank distinctly from calibration', () => {
    const markup = renderToStaticMarkup(
      <HomeView
        dashboard={dashboard({ rangeState: 'awaiting_full_tank' })}
        now={new Date(2026, 8, 29, 12)}
        onFuel={() => undefined}
        onHistory={() => undefined}
        onHome={() => undefined}
        onOdometer={() => undefined}
      />,
    )

    expect(markup).toContain('Aguardando tanque cheio')
    expect(markup).not.toContain('>Calibrando</p>')
    expect(markup).toContain('data-status="unavailable"')
    expect(markup).not.toContain('role="progressbar"')
  })

  it('shows calibrating when a full-tank anchor exists but range is unavailable', () => {
    const markup = renderToStaticMarkup(
      <HomeView
        dashboard={dashboard({ rangeState: 'calibrating' })}
        now={new Date(2026, 8, 29, 12)}
        onFuel={() => undefined}
        onHistory={() => undefined}
        onHome={() => undefined}
        onOdometer={() => undefined}
      />,
    )

    expect(markup).toContain('Calibrando')
    expect(markup).not.toContain('Aguardando tanque cheio')
    expect(markup).toContain('data-status="calibrating"')
    expect(markup).not.toContain('role="progressbar"')
  })

  it('renders ready range and learned consumption as approximate', () => {
    const markup = renderToStaticMarkup(
      <HomeView
        dashboard={dashboard({
          rangeState: 'ready',
          rangeKm: 72,
          fuelPercent: 200 / 3,
          consumptionKmPerLiter: 40,
          calibrationState: 'estimated',
        })}
        now={new Date(2026, 8, 29, 12)}
        onFuel={() => undefined}
        onHistory={() => undefined}
        onHome={() => undefined}
        onOdometer={() => undefined}
      />,
    )

    expect(markup).toContain('≈ 72 km')
    expect(markup).toContain('≈ 40 km/L')
    expect(markup).toContain('class="home__instrument"')
    expect(markup).toContain('role="progressbar"')
    expect(markup).toContain('aria-valuenow="67"')
    expect(markup).toContain('data-status="estimated"')
    expect(markup).toContain('data-icon="layer"')
    expect(markup).toContain('data-icon="time"')
  })
})
