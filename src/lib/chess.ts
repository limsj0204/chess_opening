import { Chess, type Square } from 'chess.js'
import type { ParsedMove } from './pgn'

export interface Replay {
  fen: string
  lastMove?: { from: string; to: string }
}

/** 처음부터 ply 수만큼 둔 포지션 */
export function replay(moves: ParsedMove[], ply: number): Replay {
  const chess = new Chess()
  let lastMove: Replay['lastMove']
  for (let i = 0; i < ply && i < moves.length; i++) {
    const m = chess.move(moves[i].san)
    lastMove = { from: m.from, to: m.to }
  }
  return { fen: chess.fen(), lastMove }
}

/** 이 포지션에서 from→to가 합법이면 SAN을 돌려줍니다. */
export function sanFor(fen: string, from: string, to: string): string | null {
  const chess = new Chess(fen)
  try {
    return chess.move({ from: from as Square, to: to as Square, promotion: 'q' }).san
  } catch {
    return null
  }
}

export function squaresFor(fen: string, san: string): { from: string; to: string } {
  const m = new Chess(fen).move(san)
  return { from: m.from, to: m.to }
}
