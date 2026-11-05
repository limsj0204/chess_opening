import type { ParsedMove } from '../lib/pgn'

interface Props {
  moves: ParsedMove[]
  /** 지금까지 둔 수의 개수 */
  upto: number
  /** true면 아직 두지 않은 수는 감춥니다(트레이닝용). */
  hideFuture?: boolean
  onSelect?: (ply: number) => void
}

export function MoveList({ moves, upto, hideFuture, onSelect }: Props) {
  const shown = hideFuture ? moves.slice(0, upto) : moves
  const rows: { no: number; white?: number; black?: number }[] = []
  shown.forEach((_, i) => {
    if (i % 2 === 0) rows.push({ no: i / 2 + 1, white: i })
    else rows[rows.length - 1].black = i
  })

  const cell = (i: number | undefined) => {
    if (i === undefined) return <span className="mv" />
    const cls = `mv ${i === upto - 1 ? 'current' : ''} ${i >= upto ? 'future' : ''}`
    return onSelect ? (
      <button className={cls} onClick={() => onSelect(i + 1)}>
        {moves[i].san}
      </button>
    ) : (
      <span className={cls}>{moves[i].san}</span>
    )
  }

  return (
    <div className="movelist" aria-label="수순">
      {rows.length === 0 && <span className="muted small">아직 둔 수가 없습니다.</span>}
      {rows.map((r) => (
        <div className="mv-row" key={r.no}>
          <span className="mv-no">{r.no}.</span>
          {cell(r.white)}
          {cell(r.black)}
        </div>
      ))}
    </div>
  )
}
