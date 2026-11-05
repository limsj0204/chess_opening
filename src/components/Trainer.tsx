import { useEffect, useMemo, useRef, useState } from 'react'
import { replay, sanFor, squaresFor } from '../lib/chess'
import { isUserPly, lookupComment, type Line } from '../lib/repertoire'
import { Board } from './Board'
import { MoveList } from './MoveList'

export type TrainMode = 'learn' | 'test' | 'review' | 'retry' | 'practice'

export interface QueueItem {
  lineId: string
  mode: TrainMode
}

interface Props {
  title: string
  initialQueue: QueueItem[]
  lines: Map<string, Line>
  comments: Map<string, string>
  /** 라인 하나를 끝냈을 때 간격 반복 일정에 반영합니다. */
  onRecord: (lineId: string, success: boolean) => void
  onExit: () => void
}

const MODE_LABEL: Record<TrainMode, string> = {
  learn: '배우기',
  test: '확인 테스트',
  review: '복습',
  retry: '다시 풀기',
  practice: '연습',
}

const OPPONENT_DELAY = 550

export function Trainer({ title, initialQueue, lines, comments, onRecord, onExit }: Props) {
  const [queue, setQueue] = useState(initialQueue)
  const [qi, setQi] = useState(0)
  const [ply, setPly] = useState(0)
  const [mistakes, setMistakes] = useState(0)
  /** 지금 수에서 틀린 횟수 (두 번째부터 정답 화살표를 보여 줍니다) */
  const [wrongHere, setWrongHere] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [message, setMessage] = useState<{ kind: 'wrong' | 'info'; text: string } | null>(null)
  const [flash, setFlash] = useState<'wrong' | null>(null)
  const [stats, setStats] = useState({ done: 0, perfect: 0 })
  const recorded = useRef(-1)

  const item = queue[qi] as QueueItem | undefined
  const line = item ? lines.get(item.lineId) : undefined
  const moves = line?.moves ?? []
  const color = line?.color ?? 'white'
  const finished = !!line && ply >= moves.length
  const userTurn = !!line && !finished && isUserPly(ply, color)

  const { fen, lastMove } = useMemo(() => replay(moves, ply), [moves, ply])
  const expected = userTurn ? moves[ply] : undefined
  const showArrow = !!expected && (item?.mode === 'learn' || revealed)
  const arrows = useMemo(() => {
    if (!expected || !showArrow) return []
    const { from, to } = squaresFor(fen, expected.san)
    return [{ startSquare: from, endSquare: to, color: 'rgba(0, 160, 90, 0.85)' }]
  }, [expected, showArrow, fen])

  // 상대 수는 자동으로 둡니다.
  useEffect(() => {
    if (!line || finished || userTurn) return
    const t = setTimeout(() => setPly((p) => p + 1), ply === 0 ? 350 : OPPONENT_DELAY)
    return () => clearTimeout(t)
  }, [line, finished, userTurn, ply])

  // 라인을 끝냈을 때 결과 반영
  useEffect(() => {
    if (!finished || !item || recorded.current === qi) return
    recorded.current = qi
    const perfect = mistakes === 0
    setStats((s) => ({ done: s.done + 1, perfect: s.perfect + (perfect ? 1 : 0) }))
    const again = (mode: TrainMode) => setQueue((q) => [...q, { lineId: item.lineId, mode }])
    switch (item.mode) {
      case 'learn':
        again('test')
        break
      case 'test':
        if (perfect) onRecord(item.lineId, true)
        else again('test')
        break
      case 'review':
        onRecord(item.lineId, perfect)
        if (!perfect) again('retry')
        break
      case 'retry':
      case 'practice':
        break
    }
  }, [finished, item, qi, mistakes, onRecord])

  function resetForLine() {
    setPly(0)
    setMistakes(0)
    setWrongHere(0)
    setRevealed(false)
    setMessage(null)
  }

  function next() {
    setQi((i) => i + 1)
    resetForLine()
  }

  function restartLine() {
    recorded.current = qi // 같은 라인을 다시 두는 것은 기록하지 않습니다.
    resetForLine()
  }

  function handleMove(from: string, to: string): boolean {
    if (!expected) return false
    const san = sanFor(fen, from, to)
    if (!san) return false
    if (san === expected.san) {
      setPly((p) => p + 1)
      setWrongHere(0)
      setRevealed(false)
      setMessage(null)
      return true
    }
    if (wrongHere === 0 && item?.mode !== 'learn') setMistakes((m) => m + 1)
    const count = wrongHere + 1
    setWrongHere(count)
    setFlash('wrong')
    setTimeout(() => setFlash(null), 450)
    if (count >= 2 || item?.mode === 'learn') {
      setRevealed(true)
      setMessage({ kind: 'wrong', text: `${san}이(가) 아니에요. 정답은 화살표의 ${expected.san}입니다.` })
    } else {
      setMessage({ kind: 'wrong', text: `${san}은(는) 레퍼토리 수가 아니에요. 한 번 더 생각해 보세요!` })
    }
    return false
  }

  function hint() {
    if (!expected || revealed) return
    if (wrongHere === 0) setMistakes((m) => m + 1)
    setWrongHere((w) => Math.max(w, 1))
    setRevealed(true)
    setMessage({ kind: 'info', text: `정답은 ${expected.san}입니다.` })
  }

  // ── 세션 끝 ──
  if (!item || !line) {
    return (
      <section className="panel center">
        <h2>세션 완료! 🎉</h2>
        <p className="big-stat">
          {stats.perfect} / {stats.done}
        </p>
        <p className="muted">실수 없이 끝낸 라인 / 전체로 둔 라인</p>
        <button className="btn primary" onClick={onExit}>
          홈으로
        </button>
      </section>
    )
  }

  // 마지막 수와, 그 직전의 내 수에 달린 설명을 함께 보여 줍니다(상대가 곧바로 응수해도 놓치지 않도록).
  const commentPlies = ply >= 2 && !isUserPly(ply - 1, color) ? [ply - 2, ply - 1] : ply >= 1 ? [ply - 1] : []
  const shownComments = commentPlies
    .map((p) => ({ p, text: lookupComment(comments, replay(moves, p).fen, moves[p]) }))
    .filter((c): c is { p: number; text: string } => !!c.text)
  // 복습 중에는 라인 이름이 정답을 알려 주지 않도록 끝날 때까지 감춥니다.
  const hideName = !finished && item.mode !== 'learn' && item.mode !== 'practice'
  const remaining = queue.length - qi

  let status: string
  if (finished) status = mistakes === 0 ? '완벽해요! 실수 없이 끝냈습니다.' : `라인 완료 — 실수 ${mistakes}번`
  else if (userTurn) status = item.mode === 'learn' ? '화살표를 따라 두어 보세요.' : '당신 차례입니다. 레퍼토리 수를 두세요.'
  else status = '상대가 두는 중…'

  return (
    <div className="trainer">
      <div className="trainer-board">
        <Board
          fen={fen}
          orientation={color}
          interactive={userTurn}
          arrows={arrows}
          lastMove={lastMove}
          flash={flash}
          onMove={handleMove}
        />
      </div>
      <section className="panel trainer-side">
        <div className="trainer-head">
          <span className={`badge badge-${color}`}>{color === 'white' ? '백' : '흑'}</span>
          <span className="badge">{MODE_LABEL[item.mode]}</span>
          <span className="muted small">{title} · 남은 라인 {remaining}</span>
        </div>
        <h2 className="line-title">{hideName ? '어떤 라인일까요?' : line.name}</h2>

        <p className={`status ${finished ? (mistakes === 0 ? 'ok' : 'warn') : ''}`}>{status}</p>
        {message && <p className={`message ${message.kind}`}>{message.text}</p>}
        {shownComments.map((c) => (
          <p className="comment" key={c.p}>
            <strong>{moveLabel(c.p, moves[c.p].san)}</strong> {c.text}
          </p>
        ))}

        <MoveList moves={moves} upto={ply} hideFuture />

        <div className="actions">
          {finished ? (
            <>
              <button className="btn primary" onClick={next}>
                {qi + 1 < queue.length ? '다음 라인 →' : '결과 보기'}
              </button>
              <button className="btn" onClick={restartLine}>
                한 번 더
              </button>
            </>
          ) : (
            <button className="btn" onClick={hint} disabled={!userTurn || revealed || item.mode === 'learn'}>
              힌트
            </button>
          )}
          <button className="btn ghost" onClick={onExit}>
            그만하기
          </button>
        </div>
      </section>
    </div>
  )
}

export function moveLabel(ply: number, san: string): string {
  const n = Math.floor(ply / 2) + 1
  return ply % 2 === 0 ? `${n}.${san}` : `${n}...${san}`
}
