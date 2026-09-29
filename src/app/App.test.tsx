import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../infrastructure/supabase/client', () => ({
  supabase: { auth: {} },
}))

import App from './App'

describe('App', () => {
  it('renders the Control Vault shell', () => {
    expect(renderToStaticMarkup(createElement(App))).toContain('<h1>Control Vault</h1>')
  })
})
