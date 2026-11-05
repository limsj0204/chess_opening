import { useEffect, useState } from 'react'

const PREFIX = 'opening-trainer:'

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // 저장 공간을 쓸 수 없는 환경(사생활 보호 모드 등)에서는 조용히 넘어갑니다.
  }
}

/** localStorage에 자동으로 저장되는 useState */
export function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => loadJson(key, fallback))
  useEffect(() => saveJson(key, value), [key, value])
  return [value, setValue] as const
}
