import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import BrandMark, { BRAND_PATHS } from './BrandMark'
import Icon, { ICON_PATHS, type IconName } from './Icon'

function fnv1a(value: string) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

describe('Credit Monitor source geometry', () => {
  it.each<[IconName, string]>([
    ['refresh', 'dd1a47b1'],
    ['cog', '18351053'],
    ['layer', '753120e8'],
    ['check', 'f75e9090'],
    ['time', '4280e7b5'],
  ])('keeps the exact %s icon path markup', (name, expectedHash) => {
    expect(fnv1a(ICON_PATHS[name])).toBe(expectedHash)

    const markup = renderToStaticMarkup(<Icon name={name} />)
    expect(markup).toContain('viewBox="0 0 24 24"')
    expect(markup).toContain('aria-hidden="true"')
    expect(markup).toContain('focusable="false"')
  })

  it('keeps the exact three-path brand geometry', () => {
    expect(fnv1a(BRAND_PATHS.main)).toBe('3fd4112d')
    expect(fnv1a(BRAND_PATHS.secondary)).toBe('b26ff074')
    expect(fnv1a(BRAND_PATHS.needle)).toBe('3755a7a8')

    const markup = renderToStaticMarkup(<BrandMark />)
    expect(markup).toContain('viewBox="0 0 750 600"')
    expect(markup.match(/<path/g)).toHaveLength(3)
  })
})
