import { useEffect, useMemo, useState } from 'react'
import { replay } from '../lib/chess'
import { lookupComment, type Line } from '../lib/repertoire'
import { Board } from './Board'
import { MoveList } from './MoveList'
import { moveLabel } from './Trainer'

interface Props {
  line: Line
  comments: Map<string, string>
  onBack: () => void
  onPractice: () => void
}

/** 라인을 한 수씩 넘겨 보며 설명을 읽는 화면 */
export function Viewer({ line, comments, onBack, onPractice }: Props) {
  const [ply, setPly] = useState(0)
  const moves = line.moves
  const { fen, lastMove } = useMemo(() => replay(moves, ply), [moves, ply])
  const comment = ply > 0 ? lookupComment(comments, replay(moves, ply - 1).fen, moves[ply - 1]) : undefined

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setPly((p) => Math.min(p + 1, moves.length))
      if (e.key === 'ArrowLeft') setPly((p) => Math.max(p - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [moves.length])

  return (
    <div className="trainer">
      <div className="trainer-board">
        <Board fen={fen} orientation={line.color} lastMove={lastMove} />
        <div className="nav-buttons">
          <button className="btn" onClick={() => setPly(0)} aria-label="처음">⏮</button>
          <button className="btn" onClick={() => setPly((p) => Math.max(p - 1, 0))} aria-label="이전">◀</button>
          <button className="btn" onClick={() => setPly((p) => Math.min(p + 1, moves.length))} aria-label="다음">▶</button>
          <button className="btn" onClick={() => setPly(moves.length)} aria-label="끝">⏭</button>
        </div>
      </div>
      <section className="panel trainer-side">
        <div className="trainer-head">
          <span className={`badge badge-${line.color}`}>{line.color === 'white' ? '백' : '흑'}</span>
          <span className="badge">라인 보기</span>
        </div>
        <h2 className="line-title">{line.name}</h2>
        {comment ? (
          <p className="comment">
            <strong>{moveLabel(ply - 1, moves[ply - 1].san)}</strong> {comment}
          </p>
        ) : (
          <p className="muted small">
            {ply === 0 ? '▶ 버튼(또는 → 키)으로 한 수씩 넘겨 보세요.' : '이 수에는 설명이 없습니다.'}
          </p>
        )}
        <MoveList moves={moves} upto={ply} onSelect={setPly} />
        <div className="actions">
          <button className="btn primary" onClick={onPractice}>이 라인 연습하기</button>
          <button className="btn ghost" onClick={onBack}>뒤로</button>
        </div>
      </section>
    </div>
  )
}
