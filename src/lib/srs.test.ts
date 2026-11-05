import { describe, expect, it } from 'vitest'
import { INTERVAL_DAYS, isDue, schedule, startOfDay } from './srs'

const DAY = 86_400_000
const now = new Date(2026, 10, 5, 15, 30).getTime()

describe('간격 반복', () => {
  it('처음 맞히면 내일 복습', () => {
    const p = schedule(undefined, true, now)
    expect(p.box).toBe(1)
    expect(p.due).toBe(startOfDay(now) + DAY)
    expect(isDue(p, now)).toBe(false)
    expect(isDue(p, now + DAY)).toBe(true)
  })

  it('맞힐수록 간격이 늘고, 틀리면 1단계로 돌아간다', () => {
    let p = schedule(undefined, true, now)
    p = schedule(p, true, now)
    p = schedule(p, true, now)
    expect(p.box).toBe(3)
    expect(p.due).toBe(startOfDay(now) + INTERVAL_DAYS[3] * DAY)
    p = schedule(p, false, now)
    expect(p.box).toBe(1)
    expect(p.lapses).toBe(1)
    expect(p.reps).toBe(4)
  })
})

describe('배우기 기록', () => {
  it('배운 라인은 바로 기록되고 오늘 복습에 들어간다', async () => {
    const { markLearned } = await import('./srs')
    const p = markLearned(undefined, now)
    expect(p.box).toBe(0)
    expect(isDue(p, now)).toBe(true)
    expect(schedule(p, true, now).box).toBe(1)
    const existing = schedule(undefined, true, now)
    expect(markLearned(existing, now)).toBe(existing)
  })
})
