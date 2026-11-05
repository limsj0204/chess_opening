import { Chess, type Square } from 'chess.js'
import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Chessboard, type Arrow } from 'react-chessboard'
import type { Color } from '../lib/types'

interface Props {
  fen: string
  orientation: Color
  interactive?: boolean
  arrows?: Arrow[]
  lastMove?: { from: string; to: string }
  flash?: 'wrong' | null
  /** 수를 두었을 때. true를 돌려주면 받아들인 수입니다. */
  onMove?: (from: string, to: string) => boolean
}

const LAST_MOVE = 'rgba(255, 214, 0, 0.42)'
const SELECTED = 'rgba(80, 160, 255, 0.5)'

export function Board({ fen, orientation, interactive = false, arrows = [], lastMove, flash, onMove }: Props) {
  const chess = useMemo(() => new Chess(fen), [fen])
  const [selected, setSelected] = useState<string | null>(null)

  useEffect(() => setSelected(null), [fen])

  const targets = useMemo(
    () => (selected ? chess.moves({ square: selected as Square, verbose: true }).map((m) => m.to as string) : []),
    [chess, selected],
  )

  const squareStyles: Record<string, CSSProperties> = {}
  if (lastMove) {
    squareStyles[lastMove.from] = { background: LAST_MOVE }
    squareStyles[lastMove.to] = { background: LAST_MOVE }
  }
  if (selected) squareStyles[selected] = { background: SELECTED }
  for (const t of targets) {
    const capture = !!chess.get(t as Square)
    squareStyles[t] = {
      ...squareStyles[t],
      backgroundImage: capture
        ? 'radial-gradient(circle, transparent 58%, rgba(0,0,0,0.28) 60%)'
        : 'radial-gradient(circle, rgba(0,0,0,0.28) 22%, transparent 24%)',
    }
  }

  const myTurnPiece = (pieceType: string) => pieceType[0] === chess.turn()

  function tryMove(from: string, to: string) {
    setSelected(null)
    return onMove ? onMove(from, to) : false
  }

  return (
    <div className={`board ${flash === 'wrong' ? 'board--wrong' : ''}`}>
      <Chessboard
        options={{
          position: fen,
          boardOrientation: orientation,
          arrows,
          squareStyles,
          allowDragging: interactive,
          allowDrawingArrows: false,
          animationDurationInMs: 220,
          darkSquareStyle: { backgroundColor: 'var(--board-dark)' },
          lightSquareStyle: { backgroundColor: 'var(--board-light)' },
          canDragPiece: ({ piece }) => interactive && myTurnPiece(piece.pieceType),
          onPieceDrop: ({ sourceSquare, targetSquare }) =>
            interactive && targetSquare ? tryMove(sourceSquare, targetSquare) : false,
          onSquareClick: ({ square }) => {
            if (!interactive) return
            if (selected && targets.includes(square)) {
              tryMove(selected, square)
              return
            }
            const piece = chess.get(square as Square)
            setSelected(piece && piece.color === chess.turn() && square !== selected ? square : null)
          },
        }}
      />
    </div>
  )
}
