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
const priceStub = vi.hoisted(() => ({
  getFuelPriceReference: vi.fn(),
}))
const priceReference = {
  uf: 'PA',
  municipio: 'PARAGOMINAS',
  produto: 'GASOLINA COMUM',
  semanaInicio: '2026-09-27',
  semanaFim: '2026-10-03',
  precoMedio: 7.05,
  precoMinimo: 6.79,
  precoMaximo: 7.22,
  postosPesquisados: 37,
}

vi.mock('./vehicleActions', () => actionStub)
vi.mock('../../infrastructure/local/store', () => storeStub)
vi.mock('../../infrastructure/fuelPrice/fuelPrice', () => priceStub)

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
    priceStub.getFuelPriceReference.mockReset()
    priceStub.getFuelPriceReference.mockResolvedValue(priceReference)
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
      root.render(<FuelView currentOdometerKm={12_000} onBack={() => undefined} onSaved={() => undefined} />)
    })

    const odometer = container.querySelector(
      'input[name="odometer"]',
    ) as HTMLInputElement
    const amount = container.querySelector(
      'input[name="amount"]',
    ) as HTMLInputElement
    const form = container.querySelector('form') as HTMLFormElement

    expect(amount.getAttribute('aria-describedby')).toBe('fuel-amount-hint')

    await act(async () => {
      setInputValue(odometer, '124830')
      setInputValue(amount, '2570')
      await Promise.resolve()
    })

    expect(odometer.value).toBe('12483.0')
    expect(amount.value).toBe('R$ 25,70')

    await act(async () => {
      amount.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }),
      )
      await Promise.resolve()
    })
    expect(amount.value).toBe('R$ 2,57')

    await act(async () => {
      setInputValue(amount, `${amount.value}2`)
      await Promise.resolve()
    })

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

    expect(container.textContent).toContain('R$ 7,05/L')
    expect(container.textContent).toContain('R$ 28,20')

    const submit = container.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement

    await act(async () => {
      setInputValue(amount, '2820')
      await Promise.resolve()
    })
    expect(amount.value).toBe('R$ 28,20')
    expect(submit.disabled).toBe(false)

    await act(async () => {
      setInputValue(amount, '2821')
      await Promise.resolve()
    })
    expect(amount.value).toBe('R$ 28,21')
    expect(submit.disabled).toBe(true)

    await act(async () => {
      setInputValue(amount, '4545')
      await Promise.resolve()
    })
    expect(amount.value).toBe('R$ 45,45')
    expect(submit.disabled).toBe(true)

    await act(async () => {
      setInputValue(amount, '9999')
      await Promise.resolve()
    })
    expect(amount.value).toBe('R$ 99,99')
    expect(submit.disabled).toBe(true)

    await act(async () => {
      setInputValue(amount, '99990')
      await Promise.resolve()
    })
    expect(amount.value).toBe('R$ 99,99')

    await act(async () => root.unmount())
  })

  it('keeps the R$ 99,99 mask and allows saving without a price reference', async () => {
    priceStub.getFuelPriceReference.mockResolvedValueOnce(null)
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <FuelView
          currentOdometerKm={12_000}
          onBack={() => undefined}
          onSaved={() => undefined}
        />,
      )
    })

    const amount = container.querySelector(
      'input[name="amount"]',
    ) as HTMLInputElement
    const submit = container.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement
    const form = container.querySelector('form') as HTMLFormElement

    await act(async () => {
      setInputValue(amount, '9999')
      await Promise.resolve()
    })
    expect(amount.value).toBe('R$ 99,99')
    expect(submit.disabled).toBe(false)

    await act(async () => {
      setInputValue(amount, '99990')
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
      await Promise.resolve()
    })

    expect(amount.value).toBe('R$ 99,99')
    expect(actionStub.recordFuel).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 9_999 }),
      false,
    )

    await act(async () => root.unmount())
  })

  it.each([
    {
      refreshedPrice: 7,
      amountDigits: '2801',
      expectedMaximum: 'R$ 28,00',
      saveDisabled: true,
    },
    {
      refreshedPrice: 7.1,
      amountDigits: '2821',
      expectedMaximum: 'R$ 28,40',
      saveDisabled: false,
    },
  ])(
    'updates the open form after a background refresh to R$ $refreshedPrice/L',
    async ({
      refreshedPrice,
      amountDigits,
      expectedMaximum,
      saveDisabled,
    }) => {
      let publishRefresh:
        | ((reference: typeof priceReference) => void)
        | undefined
      priceStub.getFuelPriceReference.mockImplementationOnce(
        async (
          _now: Date,
          onRefresh?: (reference: typeof priceReference) => void,
        ) => {
          publishRefresh = onRefresh
          return priceReference
        },
      )
      const container = document.createElement('div')
      document.body.append(container)
      const root = createRoot(container)

      await act(async () => {
        root.render(
          <FuelView
            currentOdometerKm={12_000}
            onBack={() => undefined}
            onSaved={() => undefined}
          />,
        )
      })

      const amount = container.querySelector(
        'input[name="amount"]',
      ) as HTMLInputElement
      const submit = container.querySelector(
        'button[type="submit"]',
      ) as HTMLButtonElement

      await act(async () => {
        setInputValue(amount, amountDigits)
        publishRefresh?.({ ...priceReference, precoMedio: refreshedPrice })
        await Promise.resolve()
      })

      expect(container.textContent).toContain(expectedMaximum)
      expect(submit.disabled).toBe(saveDisabled)

      await act(async () => root.unmount())
    },
  )

  it('enforces the current and technical odometer bounds in the form', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <OdometerView
          currentOdometerKm={12_345.6}
          onBack={() => undefined}
          onSaved={() => undefined}
        />,
      )
    })

    const input = container.querySelector(
      'input[name="odometer"]',
    ) as HTMLInputElement
    const submit = container.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement

    expect(input.value).toBe('12345.6')
    expect(submit.disabled).toBe(false)
    expect(input.getAttribute('aria-describedby')).toBe('odometer-hint')

    await act(async () => {
      setInputValue(input, '123455')
      await Promise.resolve()
    })

    expect(input.value).toBe('12345.5')
    expect(submit.disabled).toBe(true)
    expect(container.textContent).toContain('Não pode ser menor que 12345.6 km')

    await act(async () => {
      setInputValue(input, '123456')
      await Promise.resolve()
    })
    expect(input.value).toBe('12345.6')
    expect(submit.disabled).toBe(false)

    await act(async () => {
      setInputValue(input, '123457')
      await Promise.resolve()
    })
    expect(input.value).toBe('12345.7')
    expect(submit.disabled).toBe(false)

    await act(async () => {
      setInputValue(input, '9999990')
      setInputValue(input, '9999991')
      await Promise.resolve()
    })
    expect(input.value).toBe('999999.0')
    expect(submit.disabled).toBe(false)

    await act(async () => root.unmount())
  })

  it('formats suspicious odometer confirmation without raw floats', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <OdometerView currentOdometerKm={1_000} onBack={() => undefined} onSaved={() => undefined} />,
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
    expect(container.textContent).toContain('Confirmar')

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

    expect(markup).not.toContain('Hodômetro atualizado')
    expect(markup).not.toContain('Abastecimento')
    expect(markup).toContain('1200.0 km')
    expect(markup).toContain('1240.0 km')
    expect(markup).toContain('R$ 25,72')
    expect(markup).toContain('tanque cheio')
    expect(markup).not.toContain('data-icon=')
    expect(markup).toContain('history-row--fuel')
    expect(markup).toContain('history-row__value')
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
    expect(document.activeElement).toBe(
      container.querySelector('[data-view-root="true"]'),
    )

    const nav = container.querySelector('.vehicle-navigation')
    expect(nav?.querySelector('[aria-current="page"]')?.textContent).toBe('Início')
    expect(nav?.querySelector('[data-icon="home"]')).not.toBeNull()
    expect(nav?.querySelector('[data-icon="history"]')).not.toBeNull()

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

    expect(markup).toContain('Sem estimativa')
    expect(markup).toContain('Complete um tanque para iniciar a estimativa')
    expect(markup).not.toContain('—')
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

    expect(markup).toContain('Calibrando')
    expect(markup).not.toContain('A autonomia aparece após um ciclo completo')
    expect(markup).not.toContain('—')
    expect(markup).not.toContain('data-status=')
  })

  it('renders ready autonomy with requested filled action icons', () => {
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

    const rendered = document.createElement('div')
    rendered.innerHTML = markup
    expect(rendered.textContent).toContain('≈ 72 km')
    expect(rendered.textContent).toContain('≈ 3 dias')
    expect(rendered.textContent).toContain('≈ 2,0 L')
    expect(markup).toContain('aria-valuenow="67"')
    expect(markup).toContain('R$ 80,00')
    expect(markup).toContain('238 km')
    expect(markup).toContain('3</dd>')
    expect(markup).toContain('1240.0 km')
    expect(markup).toContain('data-icon="gauge"')
    expect(markup).toContain('data-icon="fuel"')
    expect(markup).not.toContain('—')
    expect(markup).toContain('home__instrument')
    expect(markup).toContain('home__monthly-primary')
    expect(markup).toContain('home__monthly-secondary')
    expect(markup).toContain('home__action--primary')
  })

  it('announces a saved fuel entry after returning home', async () => {
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
    const fuelButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.includes('Abastecer'),
    )

    await act(async () => fuelButton?.click())
    await waitForSelector(container, 'input[name="amount"]')
    const amount = container.querySelector(
      'input[name="amount"]',
    ) as HTMLInputElement
    await act(async () => {
      setInputValue(amount, '2500')
      container.querySelector('form')?.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      )
      await Promise.resolve()
    })
    await waitForSelector(container, '.home')

    expect(container.querySelector('[role="status"]')?.textContent).toContain(
      'Abastecimento salvo',
    )
    await act(async () => root.unmount())
  })
})
