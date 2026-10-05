import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import VehicleIcon from './VehicleIcon'

describe('VehicleIcon', () => {
  it.each([
    ['gauge', 'm5.08,20h13.85'],
    ['fuel', 'm16.62,3.22'],
    ['home', 'M3 13h1v7'],
    ['history', 'M5 2H4v2'],
    ['route', 'm17.5,11H6.5'],
  ] as const)('renders the requested filled Boxicon for %s', (name, pathStart) => {
    const markup = renderToStaticMarkup(<VehicleIcon name={name} />)

    expect(markup).toContain(`data-icon="${name}"`)
    expect(markup).toContain('fill="currentColor"')
    expect(markup).toContain(pathStart)
  })

  it('uses the requested filled caret for back navigation', () => {
    const markup = renderToStaticMarkup(<VehicleIcon name="back" />)

    expect(markup).toContain('fill="currentColor"')
    expect(markup).not.toContain('stroke="currentColor"')
  })
})
