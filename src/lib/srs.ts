/** 간격 반복(라이트너 상자 방식). 상자가 올라갈수록 복습 간격이 길어집니다. */
export const INTERVAL_DAYS = [0, 1, 3, 7, 14, 30, 60, 120]
export const MAX_BOX = INTERVAL_DAYS.length - 1
const DAY = 24 * 60 * 60 * 1000

export interface LineProgress {
  box: number
  due: number
  reps: number
  lapses: number
  last: number
}

export type ProgressMap = Record<string, LineProgress>

export function startOfDay(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** 한 번 풀어 본 결과를 반영해 다음 복습 날짜를 정합니다. */
export function schedule(prev: LineProgress | undefined, success: boolean, now: number): LineProgress {
  const prevBox = prev?.box ?? 0
  const box = success ? Math.min(prevBox + 1, MAX_BOX) : 1
  return {
    box,
    due: startOfDay(now) + INTERVAL_DAYS[box] * DAY,
    reps: (prev?.reps ?? 0) + 1,
    lapses: (prev?.lapses ?? 0) + (success ? 0 : 1),
    last: now,
  }
}

export function isDue(p: LineProgress | undefined, now: number): boolean {
  return !!p && p.due <= now
}

/** 상자 3(1주 간격) 이상이면 '익힘'으로 봅니다. */
export function isMastered(p: LineProgress | undefined): boolean {
  return !!p && p.box >= 3
}

export function describeDue(p: LineProgress | undefined, now: number): string {
  if (!p) return '새 라인'
  if (p.due <= now) return '오늘 복습'
  const days = Math.round((p.due - startOfDay(now)) / DAY)
  return days <= 1 ? '내일 복습' : `${days}일 뒤 복습`
}
