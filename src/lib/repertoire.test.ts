import { describe, expect, it } from 'vitest'
import { BUILTIN_CHAPTERS } from '../data/repertoire'
import { normalizeMoves, parsePgnLines } from './pgn'
import { buildChapters, buildCommentMap, EMPTY_CUSTOM, findConflicts, isUserPly } from './repertoire'

describe('기본 레퍼토리', () => {
  const chapters = buildChapters(BUILTIN_CHAPTERS, EMPTY_CUSTOM)
  const lines = chapters.flatMap((c) => c.lines)

  it('모든 라인이 하나의 합법적인 수순으로 읽힌다', () => {
    for (const ch of BUILTIN_CHAPTERS) {
      for (const l of ch.lines) {
        const parsed = parsePgnLines(l.pgn)
        expect(parsed, l.id).toHaveLength(1)
        expect(() => normalizeMoves(parsed[0]), l.id).not.toThrow()
      }
    }
    const defined = BUILTIN_CHAPTERS.reduce((n, c) => n + c.lines.length, 0)
    expect(lines).toHaveLength(defined)
  })

  it('라인 id가 겹치지 않는다', () => {
    const ids = lines.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('모든 라인은 내 수로 끝난다', () => {
    for (const l of lines) {
      expect(isUserPly(l.moves.length - 1, l.color), l.id).toBe(true)
    }
  })

  it('같은 포지션에서 내 수가 둘로 갈리지 않는다', () => {
    expect(findConflicts(lines)).toEqual([])
  })

  it('백은 1.e4, 흑은 1...e5 / 1...Nf6로 둔다', () => {
    for (const l of lines) {
      if (l.color === 'white') expect(l.moves[0].san, l.id).toBe('e4')
      else expect(l.moves[1].san, l.id).toBe(l.moves[0].san === 'e4' ? 'e5' : 'Nf6')
    }
  })

  it('설명 지도는 다른 라인의 같은 수에도 설명을 붙여 준다', () => {
    const map = buildCommentMap(lines)
    expect(map.size).toBeGreaterThan(50)
  })
})

describe('PGN 파서', () => {
  it('변화를 여러 라인으로 나눈다', () => {
    const lines = parsePgnLines('1.e4 e5 (1...c5 2.Nf3) 2.Nf3 Nc6 (2...d6 3.d4) 3.Bc4 *')
    expect(lines.map((l) => l.map((m) => m.san).join(' '))).toEqual([
      'e4 e5 Nf3 Nc6 Bc4',
      'e4 e5 Nf3 d6 d4',
      'e4 c5 Nf3',
    ])
  })

  it('헤더, 설명, NAG, 결과를 처리한다', () => {
    const [line] = parsePgnLines('[Event "x"]\n1. e4! {좋은 수} $1 e5?! 2. Nf3 1-0')
    expect(line).toEqual([{ san: 'e4', comment: '좋은 수' }, { san: 'e5' }, { san: 'Nf3' }])
  })

  it('불가능한 수를 알려 준다', () => {
    expect(() => normalizeMoves(parsePgnLines('1.e4 e5 2.Ke3')[0])).toThrow(/2\.Ke3/)
  })

  it('충돌을 찾아낸다', () => {
    const custom = {
      chapters: [],
      lines: [{ id: 'x', chapterId: 'w-italian', name: 'x', pgn: '1.e4 e5 2.Nf3 Nc6 3.Bb5' }],
    }
    const lines = buildChapters(BUILTIN_CHAPTERS, custom).flatMap((c) => c.lines)
    const conflicts = findConflicts(lines)
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].b).toEqual({ lineId: 'x', san: 'Bb5' })
  })
})
