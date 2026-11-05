import { describe, expect, it } from 'vitest'
import { mergeProgress } from './cloud'

describe('기록 합치기', () => {
  it('라인마다 더 최근 기록을 남긴다', () => {
    const old = { box: 1, due: 1, reps: 1, lapses: 0, last: 100 }
    const fresh = { box: 2, due: 2, reps: 2, lapses: 0, last: 200 }
    expect(mergeProgress({ a: old, b: fresh }, { a: fresh, b: old, c: old })).toEqual({ a: fresh, b: fresh, c: old })
  })
})
