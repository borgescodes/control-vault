import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import ConnectionIndicator from './ConnectionIndicator'

describe('ConnectionIndicator', () => {
  it.each([
    ['online', 'Online', 'ON'],
    ['offline', 'Offline', 'OFF'],
    ['syncing', 'Sincronizando', 'SYNC'],
  ] as const)('renders %s as an accessible textual signal', (state, label, text) => {
    const markup = renderToStaticMarkup(<ConnectionIndicator state={state} />)

    expect(markup).toContain(`data-state="${state}"`)
    expect(markup).toContain(`aria-label="${label}"`)
    expect(markup).toContain(`>${text}<`)
  })
})
