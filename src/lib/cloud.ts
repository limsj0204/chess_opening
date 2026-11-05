import type { CustomData } from './repertoire'
import type { ProgressMap } from './srs'

/** claude.ai 링크 페이지에서만 존재하는 런타임. 일반 웹(GitHub Pages)에서는 없습니다. */
interface ClaudeRuntime {
  use(name: string): Promise<unknown>
}

interface DocSnap {
  exists: boolean
  data(): Record<string, unknown> | undefined
}

interface DocRef {
  get(): Promise<DocSnap>
  set(data: Record<string, unknown>): Promise<void>
}

interface DbLike {
  doc(path: string): DocRef
}

interface UserLike {
  id(): Promise<string | null>
}

export interface SavedState {
  progress: ProgressMap
  custom: CustomData
  disabled: string[]
  settings: unknown
  updatedAt: number
}

export interface CloudDoc {
  load(): Promise<SavedState | null>
  save(state: SavedState): Promise<void>
}

function runtime(): ClaudeRuntime | null {
  const c = (window as unknown as { claude?: ClaudeRuntime }).claude
  return c && typeof c.use === 'function' ? c : null
}

async function waitForRuntime(tries = 6, delayMs = 400): Promise<ClaudeRuntime | null> {
  for (let i = 0; i < tries; i++) {
    const r = runtime()
    if (r) return r
    await new Promise((res) => setTimeout(res, delayMs))
  }
  return null
}

/**
 * claude.ai에서 열렸다면, 이 사람만 볼 수 있는 저장 공간(data/users/<id>/)에 연결합니다.
 * 연결할 수 없으면 null — 그때는 브라우저 저장만 씁니다.
 */
export async function connectCloud(): Promise<CloudDoc | null> {
  const r = await waitForRuntime()
  if (!r) return null
  try {
    const [user, db] = (await Promise.all([r.use('user'), r.use('db')])) as [UserLike | null, DbLike | null]
    if (!user || !db) return null
    const id = await user.id()
    if (!id) return null
    const ref = db.doc(`data/users/${id}/trainer`)
    let chain: Promise<void> = Promise.resolve()
    return {
      async load() {
        const snap = await ref.get()
        return snap.exists ? (snap.data() as unknown as SavedState) : null
      },
      save(state) {
        // 같은 문서에는 한 번에 하나씩만 씁니다.
        chain = chain.catch(() => {}).then(() => ref.set(state as unknown as Record<string, unknown>))
        return chain
      },
    }
  } catch {
    return null
  }
}

/** 두 기기(또는 브라우저 저장과 계정 저장)의 복습 기록을 합칩니다. 라인마다 더 최근 기록을 씁니다. */
export function mergeProgress(a: ProgressMap, b: ProgressMap): ProgressMap {
  const out: ProgressMap = { ...a }
  for (const [id, p] of Object.entries(b)) {
    const mine = out[id]
    if (!mine || (p.last ?? 0) > (mine.last ?? 0)) out[id] = p
  }
  return out
}
