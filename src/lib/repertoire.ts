import { Chess } from 'chess.js'
import type { ChapterDef } from '../data/repertoire'
import { normalizeMoves, parsePgnLines, positionKey, type ParsedMove } from './pgn'
import type { Color } from './types'

export interface Line {
  id: string
  name: string
  chapterId: string
  color: Color
  moves: ParsedMove[]
  custom: boolean
}

export interface Chapter {
  id: string
  name: string
  color: Color
  description: string
  custom: boolean
  lines: Line[]
}

export interface CustomChapter {
  id: string
  name: string
  color: Color
  description: string
}

export interface CustomLine {
  id: string
  chapterId: string
  name: string
  pgn: string
}

export interface CustomData {
  chapters: CustomChapter[]
  lines: CustomLine[]
}

export const EMPTY_CUSTOM: CustomData = { chapters: [], lines: [] }

function lineFromPgn(
  id: string,
  name: string,
  pgn: string,
  chapterId: string,
  color: Color,
  custom: boolean,
): Line | null {
  try {
    const [first] = parsePgnLines(pgn)
    if (!first) return null
    return { id, name, chapterId, color, custom, moves: normalizeMoves(first) }
  } catch {
    return null
  }
}

export function buildChapters(builtin: ChapterDef[], custom: CustomData): Chapter[] {
  const chapters: Chapter[] = builtin.map((c) => ({
    id: c.id,
    name: c.name,
    color: c.color,
    description: c.description,
    custom: false,
    lines: [],
  }))
  for (const c of custom.chapters) chapters.push({ ...c, custom: true, lines: [] })
  const byId = new Map(chapters.map((c) => [c.id, c]))

  for (const c of builtin) {
    const ch = byId.get(c.id)!
    for (const l of c.lines) {
      const line = lineFromPgn(l.id, l.name, l.pgn, c.id, c.color, false)
      if (line) ch.lines.push(line)
    }
  }
  for (const l of custom.lines) {
    const ch = byId.get(l.chapterId)
    if (!ch) continue
    const line = lineFromPgn(l.id, l.name, l.pgn, ch.id, ch.color, true)
    if (line) ch.lines.push(line)
  }
  return chapters
}

/** 수 하나하나를 두어 보면서 (두기 전 포지션, 둔 수)를 차례로 넘겨 줍니다. */
export function walkLine(moves: ParsedMove[], fn: (fenBefore: string, move: ParsedMove, ply: number) => void) {
  const chess = new Chess()
  moves.forEach((m, ply) => {
    const fen = chess.fen()
    chess.move(m.san)
    fn(fen, m, ply)
  })
}

const commentKey = (fen: string, san: string) => `${positionKey(fen)}|${san}`

/** 같은 포지션의 같은 수라면 어느 라인에 적힌 설명이든 함께 보여 주기 위한 지도 */
export function buildCommentMap(lines: Line[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const line of lines) {
    walkLine(line.moves, (fen, m) => {
      const key = commentKey(fen, m.san)
      if (m.comment && !map.has(key)) map.set(key, m.comment)
    })
  }
  return map
}

export function lookupComment(map: Map<string, string>, fenBefore: string, move: ParsedMove): string | undefined {
  return move.comment ?? map.get(commentKey(fenBefore, move.san))
}

export function isUserPly(ply: number, color: Color): boolean {
  return (ply % 2 === 0) === (color === 'white')
}

export interface Conflict {
  position: string
  moveText: string
  a: { lineId: string; san: string }
  b: { lineId: string; san: string }
}

/**
 * 같은 색 레퍼토리 안에서 같은 포지션에 내 수가 둘 이상이면 충돌입니다.
 * (트레이너가 어떤 수가 정답인지 알 수 없기 때문)
 */
export function findConflicts(lines: Line[]): Conflict[] {
  const conflicts: Conflict[] = []
  for (const color of ['white', 'black'] as const) {
    const seen = new Map<string, { lineId: string; san: string }>()
    for (const line of lines) {
      if (line.color !== color) continue
      walkLine(line.moves, (fen, m, ply) => {
        if (!isUserPly(ply, color)) return
        const key = positionKey(fen)
        const prev = seen.get(key)
        if (!prev) {
          seen.set(key, { lineId: line.id, san: m.san })
        } else if (prev.san !== m.san) {
          const moveNo = Math.floor(ply / 2) + 1
          conflicts.push({
            position: key,
            moveText: `${moveNo}${ply % 2 === 0 ? '.' : '...'}`,
            a: prev,
            b: { lineId: line.id, san: m.san },
          })
        }
      })
    }
  }
  return conflicts
}
