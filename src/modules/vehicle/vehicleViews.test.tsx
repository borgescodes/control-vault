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
const storeStub = vi.hoisted(() => ({
  getVehicleState: vi.fn(),
  listFuelEntries: vi.fn(),
  listOdometerReadings: vi.fn(),
}))

vi.mock('./vehicleActions', () => actionStub)
vi.mock('../../infrastructure/local/store', () => storeStub)

import FuelView from './FuelView'
import HistoryView from './HistoryView'
import HomeView from './HomeView'
import OdometerView from './OdometerView'
import SetupView from './SetupView'
import VehicleModule from './VehicleModule'
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

async function waitForSelector(container: HTMLElement, selector: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (container.querySelector(selector)) return
    await act(async () => new Promise((resolve) => setTimeout(resolve, 0)))
  }
  throw new Error(`Timed out waiting for ${selector}`)
}

function dashboard(
  overrides: Partial<VehicleDashboard> = {},
): VehicleDashboard {
  return {
    odometerKm: 1_240,
    monthSpendCents: 8_000,
    monthFuelEntryCount: 2,
    monthAverageRefuelCents: 4_000,
    monthDistanceKm: 240,
    monthDistanceState: 'complete',
    consumptionKmPerLiter: null,
    calibrationState: 'calibrating',
    remainingLiters: null,
    fuelPercent: null,
    rangeKm: null,
    recentDailyDistanceKm: null,
    rangeDays: null,
    rangeState: 'calibrating',
    ...overrides,
  }
}

describe('vehicle views', () => {
  beforeEach(() => {
    actionStub.initializeVehicle.mockClear()
    actionStub.recordOdometer.mockClear()
    actionStub.recordFuel.mockClear()
    storeStub.getVehicleState.mockReset()
    storeStub.listFuelEntries.mockReset()
    storeStub.listOdometerReadings.mockReset()
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('submits setup with the implicit odometer decimal and optional full tank', async () => {
    const onComplete = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<SetupView onComplete={onComplete} />)
    })

    const odometer = container.querySelector(
      'input[name="odometer"]',
    ) as HTMLInputElement
    const checkbox = container.querySelector(
      'input[type="checkbox"]',
    ) as HTMLInputElement
    const form = container.querySelector('form') as HTMLFormElement

    expect(checkbox.checked).toBe(false)
    expect(checkbox.required).toBe(false)

    await act(async () => {
      setInputValue(odometer, '124830')
      await Promise.resolve()
    })
    expect(odometer.value).toBe('12483.0')

    await act(async () => {
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
      await Promise.resolve()
    })

    expect(actionStub.initializeVehicle).toHaveBeenCalledWith(
      12_483,
      false,
      expect.any(String),
    )
    expect(onComplete).toHaveBeenCalledOnce()

    await act(async () => root.unmount())
  })

  it('uses shifted cents for fuel amount and keeps liters out of the form', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<FuelView onBack={() => undefined} onSaved={() => undefined} />)
    })

    const odometer = container.querySelector(
      'input[name="odometer"]',
    ) as HTMLInputElement
    const amount = container.querySelector(
      'input[name="amount"]',
    ) as HTMLInputElement
    const form = container.querySelector('form') as HTMLFormElement

    await act(async () => {
      setInputValue(odometer, '124830')
      setInputValue(amount, '2572')
      await Promise.resolve()
    })

    expect(odometer.value).toBe('12483.0')
    expect(amount.value).toBe('R$ 25,72')
    expect(container.textContent).not.toContain('Litros')

    await act(async () => {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })

    expect(actionStub.recordFuel).toHaveBeenCalledWith(
      expect.objectContaining({
        odometerKm: 12_483,
        amountCents: 2_572,
      }),
      false,
    )

    await act(async () => root.unmount())
  })

  it('formats suspicious odometer confirmation without raw floats', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <OdometerView onBack={() => undefined} onSaved={() => undefined} />,
      )
    })

    const input = container.querySelector(
      'input[name="odometer"]',
    ) as HTMLInputElement
    const form = container.querySelector('form') as HTMLFormElement

    await act(async () => {
      setInputValue(input, '16000')
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })

    expect(container.querySelector('.vehicle-confirmation')).not.toBeNull()
    expect(container.textContent).toContain('600.0 km')
    expect(container.textContent).toContain('Corrigir')
    expect(container.textContent).toContain('Confirmar mesmo assim')

    await act(async () => root.unmount())
  })

  it('consolidates history and omits fuel-generated odometer events', () => {
    const markup = renderToStaticMarkup(
      <HistoryView
        fuelEntries={[
          {
            id: 'fuel-1',
            odometerKm: 1_200,
            amountCents: 2_572,
            estimatedLiters: 2.8,
            referencePricePerLiter: null,
            referenceWeekStart: null,
            referenceWeekEnd: null,
            fullTank: true,
            fueledAt: '2026-09-29T12:00:00.000Z',
            createdAt: '2026-09-29T12:00:00.000Z',
            updatedAt: '2026-09-29T12:00:00.000Z',
          },
        ]}
        odometerReadings={[
          {
            id: 'fuel-reading',
            readingKm: 1_200,
            recordedAt: '2026-09-29T12:00:00.000Z',
            source: 'fuel_entry',
            createdAt: '2026-09-29T12:00:00.000Z',
            updatedAt: '2026-09-29T12:00:00.000Z',
          },
          {
            id: 'manual-reading',
            readingKm: 1_240,
            recordedAt: '2026-09-30T12:00:00.000Z',
            source: 'manual',
            createdAt: '2026-09-30T12:00:00.000Z',
            updatedAt: '2026-09-30T12:00:00.000Z',
          },
        ]}
      />,
    )

    expect(markup.match(/Hodômetro atualizado/g)).toHaveLength(1)
    expect(markup).toContain('1200.0 km')
    expect(markup).toContain('1240.0 km')
    expect(markup).toContain('R$ 25,72')
    expect(markup).toContain('tanque cheio')
    expect(markup).not.toContain('data-icon=')
  })

  it('renders the short history empty state', () => {
    const markup = renderToStaticMarkup(
      <HistoryView fuelEntries={[]} odometerReadings={[]} />,
    )

    expect(markup).toContain('Nenhum registro ainda.')
  })

  it('keeps loading and errors simple and accessible', async () => {
    const pending = new Promise(() => undefined)
    storeStub.getVehicleState.mockReturnValue(pending)
    storeStub.listFuelEntries.mockReturnValue(pending)
    storeStub.listOdometerReadings.mockReturnValue(pending)

    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(<VehicleModule />))
    expect(container.querySelector('[aria-busy="true"]')?.textContent).toContain(
      'Carregando',
    )

    await act(async () => root.unmount())

    const errorContainer = document.createElement('div')
    document.body.append(errorContainer)
    const errorRoot = createRoot(errorContainer)
    storeStub.getVehicleState.mockRejectedValue(new Error('offline'))
    storeStub.listFuelEntries.mockResolvedValue([])
    storeStub.listOdometerReadings.mockResolvedValue([])

    await act(async () => errorRoot.render(<VehicleModule />))
    await waitForSelector(errorContainer, '.vehicle-error')
    expect(errorContainer.querySelector('[role="alert"]')?.textContent).toBe(
      'Falha ao carregar',
    )

    await act(async () => errorRoot.unmount())
  })

  it('uses a shared text navigation for home and history', async () => {
    storeStub.getVehicleState.mockResolvedValue({
      nominalTankCapacityLiters: 3,
      initialOdometerKm: 1_000,
      initialFullTankAt: null,
      createdAt: '2026-09-29T10:00:00.000Z',
      updatedAt: '2026-09-29T10:00:00.000Z',
    })
    storeStub.listFuelEntries.mockResolvedValue([])
    storeStub.listOdometerReadings.mockResolvedValue([])

    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => root.render(<VehicleModule />))
    await waitForSelector(container, '.home')

    const nav = container.querySelector('.vehicle-navigation')
    expect(nav?.querySelector('[aria-current="page"]')?.textContent).toBe('Início')
    expect(nav?.querySelector('[data-icon]')).toBeNull()

    const historyButton = Array.from(nav?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent === 'Histórico',
    )
    await act(async () => historyButton?.click())
    expect(container.querySelector('.history')).not.toBeNull()
    expect(
      container.querySelector('.vehicle-navigation [aria-current="page"]')
        ?.textContent,
    ).toBe('Histórico')

    await act(async () => root.unmount())
  })

  it('shows awaiting full tank as guidance, not as a hero value', () => {
    const markup = renderToStaticMarkup(
      <HomeView
        dashboard={dashboard({ rangeState: 'awaiting_full_tank' })}
        onFuel={() => undefined}
        onOdometer={() => undefined}
      />,
    )

    expect(markup).toContain('>—</p>')
    expect(markup).toContain('Complete um tanque para iniciar a estimativa')
    expect(markup).not.toContain('Aguardando tanque cheio')
    expect(markup).not.toContain('role="progressbar"')
  })

  it('shows calibration as supporting copy', () => {
    const markup = renderToStaticMarkup(
      <HomeView
        dashboard={dashboard({ rangeState: 'calibrating' })}
        onFuel={() => undefined}
        onOdometer={() => undefined}
      />,
    )

    expect(markup).toContain('Calibrando consumo')
    expect(markup).not.toContain('data-status=')
  })

  it('renders ready autonomy, fuel and monthly context without decorative icons', () => {
    const markup = renderToStaticMarkup(
      <HomeView
        dashboard={dashboard({
          rangeState: 'ready',
          rangeKm: 72,
          rangeDays: 3.2,
          remainingLiters: 2,
          fuelPercent: 200 / 3,
          consumptionKmPerLiter: 40,
          calibrationState: 'estimated',
          monthFuelEntryCount: 3,
          monthAverageRefuelCents: 2_667,
          monthDistanceKm: 238,
        })}
        onFuel={() => undefined}
        onOdometer={() => undefined}
      />,
    )

    expect(markup).toContain('≈ 72 km')
    expect(markup).toContain('≈ 3 dias')
    expect(markup).toContain('≈ 2,0 L')
    expect(markup).toContain('aria-valuenow="67"')
    expect(markup).toContain('R$ 80,00')
    expect(markup).toContain('238 km')
    expect(markup).toContain('3</dd>')
    expect(markup).toContain('1240.0 km')
    expect(markup).not.toContain('data-icon=')
  })
})
