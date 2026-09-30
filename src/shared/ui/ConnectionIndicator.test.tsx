import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import ConnectionIndicator from './ConnectionIndicator'

describe('ConnectionIndicator', () => {
  it.each([
    ['online', 'Online'],
    ['offline', 'Offline'],
    ['syncing', 'Sincronizando'],
  ] as const)('renders %s as a non-verbal accessible signal', (state, label) => {
    const markup = renderToStaticMarkup(<ConnectionIndicator state={state} />)

    expect(markup).toContain(`data-state="${state}"`)
    expect(markup).toContain(`aria-label="${label}"`)
    expect(markup).not.toContain(`>${label}<`)
  })
})
