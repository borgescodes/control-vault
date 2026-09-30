import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import VehicleIcon from './VehicleIcon'

describe('VehicleIcon', () => {
  it.each([
    ['gauge', 'm5.08,20h13.85'],
    ['fuel', 'm16.62,3.22'],
    ['home', 'M3 13h1v7'],
    ['history', 'M5 2H4v2'],
  ] as const)('renders the requested filled Boxicon for %s', (name, pathStart) => {
    const markup = renderToStaticMarkup(<VehicleIcon name={name} />)

    expect(markup).toContain(`data-icon="${name}"`)
    expect(markup).toContain('fill="currentColor"')
    expect(markup).toContain(pathStart)
  })

  it('keeps back as the only outline navigation icon', () => {
    const markup = renderToStaticMarkup(<VehicleIcon name="back" />)

    expect(markup).toContain('fill="none"')
    expect(markup).toContain('stroke="currentColor"')
  })
})
