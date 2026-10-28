import { describe, expect, it } from 'vitest'
import en from './en/common.json'
import fr from './fr/common.json'

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

describe('traductions', () => {
  it('FR et EN ont exactement les mêmes clés', () => {
    expect(keys(en).sort()).toEqual(keys(fr).sort())
  })
})
